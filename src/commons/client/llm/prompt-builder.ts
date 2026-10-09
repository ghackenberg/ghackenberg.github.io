/**
 * Grounded Prompt Builder for Dr. Georg Hackenberg Virtual Avatar.
 *
 * Implements:
 * 1. Automatic Du vs. Sie tone detection and conversational mirroring.
 * 2. Complete academic & software architect persona of Dr. Georg Hackenberg.
 * 3. Unified sensory integration: site blueprint, live page context, scroll position, slide voiceover, and top RAG chunks.
 * 4. Google Gemma 3 and Qwen2.5 chat template serialization (<start_of_turn>user...).
 */

import { formatAvatarPrompt } from '@commons/client/context/avatar-context.ts';
import type { UnifiedAvatarContext } from '@commons/client/context/types.ts';
import type { ClientSearchResult } from '@commons/client/search/types.ts';
import {
  DEFAULT_MODEL_ID,
  type AddressTone,
  type ChatMessage,
  type GroundedPromptOptions,
  type GroundedPromptResult,
  type SupportedLanguage,
} from './types.ts';

/**
 * Detects whether text is German or English based on key linguistic indicators.
 */
export function detectLanguage(text: string): SupportedLanguage {
  const germanTriggers = /\b(der|die|das|und|ist|in|im|für|mit|von|zu|den|dem|des|ein|eine|einer|eines|nicht|auch|auf|als|nach|wie|was|wer|wo|warum|kannst|können|bitte|hallo|guten|tag|morgen|abend|vielen|dank|hast|habe|bist|sind|ihr|sie|dich|dir|dein|deine|fragen|antwort|vortrag|artikel)\b/gi;
  const englishTriggers = /\b(the|and|is|are|in|for|with|of|to|a|an|not|also|on|as|after|how|what|who|where|why|can|could|please|hello|hi|good|morning|evening|thanks|thank|you|have|has|am|were|your|yours|ask|answer|presentation|paper|post)\b/gi;

  const deMatches = (text.match(germanTriggers) || []).length;
  const enMatches = (text.match(englishTriggers) || []).length;

  if (deMatches === 0 && enMatches === 0) {
    // Fallback heuristic: check for umlauts (ä, ö, ü, ß)
    if (/[äöüßÄÖÜ]/.test(text)) {
      return 'de';
    }
    return 'en';
  }

  return deMatches >= enMatches ? 'de' : 'en';
}

/**
 * Detects user address tone ("Du" vs "Sie") in German inputs.
 */
export function detectAddressTone(
  text: string,
  lang?: SupportedLanguage
): AddressTone {
  const detectedLang = lang ?? detectLanguage(text);

  if (detectedLang === 'en') {
    // English default is neutral / warm professional
    return 'neutral';
  }

  // Informal "Du" patterns (case-insensitive)
  const duPattern = /\b(du|dir|dich|dein|deine|deinem|deinen|deiner|deines|hast|kannst|bist|machst|weißt|sagst|zeigst|erklärst|fragst)\b/i;
  
  // Formal "Sie" patterns in German:
  // Must distinguish formal capitalized "Sie/Ihnen/Ihr" from lowercase 3rd-person "sie" (she/they)
  const formalCapitalizedPattern = /\b(Sie|Ihnen|Ihr|Ihre|Ihrem|Ihren|Ihrer|Ihres)\b/;
  const formalVerbPattern = /\b(können|haben|sind|wissen|sagen|zeigen|erklären|verstehen)\s+Sie\b/i;
  const formalInvertedVerbPattern = /\bSie\s+(können|haben|sind|wissen|sagen|zeigen|erklären)\b/i;

  const hasDu = duPattern.test(text);
  const hasSie =
    formalCapitalizedPattern.test(text) ||
    formalVerbPattern.test(text) ||
    formalInvertedVerbPattern.test(text);

  if (hasDu && !hasSie) {
    return 'du';
  }
  if (hasSie && !hasDu) {
    return 'sie';
  }
  if (hasDu && hasSie) {
    // Both present: favor the explicitly typed direct pronoun closest to the prompt start
    const duIdx = text.search(duPattern);
    const sieIdx = text.search(formalCapitalizedPattern);
    return duIdx <= sieIdx ? 'du' : 'sie';
  }

  return 'neutral';
}

/**
 * Formats top RAG search results into a clean, markdown-grounded LLM context block.
 */
export function formatRagEnvelope(results?: ClientSearchResult[]): string {
  if (!results || results.length === 0) {
    return '';
  }

  const lines: string[] = [
    `[RETRIEVED KNOWLEDGE (RAG GROUNDING)]`,
    `Below are top verified passages from the knowledge base of hackenberg.tech. Ground your response on these sources and deep-link to them:`,
  ];

  // Budget to top 2 chunks and max 350-400 tokens (~1,400 chars) per chunk to respect WebGPU buffer limits
  const budgetedResults = results.slice(0, 2);

  budgetedResults.forEach((res, idx) => {
    const num = idx + 1;
    const headingSuffix = res.heading ? ` > ${res.heading}` : '';
    let rawContent = res.content || res.snippet || '';
    if (rawContent.length > 1400) {
      rawContent = rawContent.slice(0, 1400).trim() + '...';
    }
    lines.push(
      `\n[SOURCE #${num}]: [${res.title}${headingSuffix}](${res.url}) (${res.collection})\nContent:\n"""\n${rawContent}\n"""`
    );

    if (res.citations && res.citations.length > 0) {
      const citList = res.citations
        .map((c) => (c.id ? `[@${c.id}] ${c.title} (${c.author}, ${c.year ?? ''})` : c.title))
        .join('; ');
      lines.push(`Academic Citations: ${citList}`);
    }
  });

  return lines.join('\n');
}

/**
 * Assembles the full system persona prompt of Dr. Georg Hackenberg.
 */
export function buildSystemPersonaPrompt(options: {
  tone: AddressTone;
  lang: SupportedLanguage;
  context?: UnifiedAvatarContext;
  ragResults?: ClientSearchResult[];
}): string {
  const { tone, lang, context, ragResults } = options;

  const sections: string[] = [];

  // 1. Identity & Academic Profile
  const identityLines = [
    `[VIRTUAL AVATAR IDENTITY: DR. GEORG HACKENBERG]`,
    lang === 'de'
      ? `Du sprichst als Dr. Georg Hackenberg, Full Professor für Industrielle Informatik an der FH Oberösterreich (Campus Wels), Senior Softwarearchitekt und Forscher.`
      : `You speak as Dr. Georg Hackenberg, Full Professor for Industrial Informatics at the University of Applied Sciences Upper Austria (Campus Wels), Senior Software Architect, and Researcher.`,
    lang === 'de'
      ? `Wenn du gefragt wirst, wer du bist, stellst du dich immer als Dr. Georg Hackenberg vor: "Ich bin Dr. Georg Hackenberg, Professor für Industrielle Informatik an der FH Oberösterreich (Campus Wels), Softwarearchitekt und Forscher."`
      : `When asked who you are, always introduce yourself as Dr. Georg Hackenberg: "I am Dr. Georg Hackenberg, Professor for Industrial Informatics at the University of Applied Sciences Upper Austria (Campus Wels), software architect, and researcher."`,
    lang === 'de'
      ? `- Fachbereich: Department für Angewandte Technologien, Fakultät für Technik und Angewandte Naturwissenschaften (FH OÖ Campus Wels).`
      : `- Department: Department for Applied Technologies, Faculty for Engineering and Environmental Sciences (FH OÖ Campus Wels).`,
    lang === 'de'
      ? `- Meine Lehrveranstaltungen an der FH Oberösterreich: Software Engineering, Systems Engineering, Digitale Fabrik (Digital Factory), Computer-Simulation, Internet der Dinge (IoT), Datenanalyse, Programmierung (Python, Java, TypeScript/Firebase, MAUI/ASP.NET).`
      : `- My university courses at FH Upper Austria: Software Engineering, Systems Engineering, Digital Factory, Computer Simulation, Internet of Things (IoT), Data Analysis, Programming (Python, Java, TypeScript/Firebase, MAUI/ASP.NET).`,
    lang === 'de'
      ? `- Forschungsschwerpunkte & Softwareprojekte: Industrielle Softwaretechnik, Modellgetriebene Entwicklung (MDE), Autonome KI-Agenten, CADdrive (CAD/CAM Geometrie-Engine), Deterministische Verifikations-Gates, Digitale Zwillinge und Slide-as-Code.`
      : `- Research Focus & Software Projects: Industrial Software Engineering, Model-Driven Engineering (MDE), Autonomous Agentic AI, CADdrive (CAD/CAM geometry engine), Deterministic Verification Gates, Digital Twins, and Slide-as-Code.`,
    `- Core Website: https://hackenberg.tech`,
  ];
  sections.push(identityLines.join('\n'));

  // 2. Language & Tone Mirroring Instructions
  const toneDirectives: string[] = [
    `[COMMUNICATION STYLE & TONE DIRECTIVES]`,
  ];

  if (lang === 'de') {
    toneDirectives.push(
      `- Sprache: Antworte stets auf Deutsch.`,
      `- Wichtige Regel: Antworte stets in der ersten Person ("Ich", "mein Fachbereich", "meine Vorlesungen", "meine Forschungsprojekte").`,
      `- Direktheit: Beantworte Fragen direkt, sachlich, präzise und akademisch fundiert.`,
      `- Beantworte Fragen zu Blog-Posts, Papern, Vorlesungen und Projekten konkret basierend auf den bereitgestellten Quellen und verlinke sie mit [Titel](url).`
    );
    if (tone === 'du') {
      toneDirectives.push(
        `- Anrede: Sprich den Fragenden per "Du" an (kollegial, nahbar, auf Augenhöhe, wie im Entwicklerteam oder unter Fachkollegen).`
      );
    } else if (tone === 'sie') {
      toneDirectives.push(
        `- Anrede: Sprich den Fragenden per "Sie" an (höflich, professionell, akademisch fundiert, wie in einer wissenschaftlichen Konsultation).`
      );
    } else {
      toneDirectives.push(
        `- Anrede: Wähle eine professionelle, akademisch fundierte und zugleich nahbare Ansprache (bevorzugt "Sie" bei formalem Kontext, sonst sachlich neutral).`
      );
    }
    toneDirectives.push(
      `- Haltung: Anti-dogmatischer, evidenzbasierter, pragmatischer Ingenieur. Betone empirische Trade-offs und reproduzierbare Praktiken.`,
      `- Fundierung: Stütze Antworten auf die verifizierten Quellen und den Seitenkontext.`,
      `- Verlinkung: Formatiere Paper, Artikel oder Seiten als Markdown-Links mit kanonischen URLs ([Titel](url)).`
    );
  } else {
    toneDirectives.push(
      `- Language: Respond in clear, precise English. Maintain Dr. Hackenberg's approachable, authoritative, and scientifically rigorous tone.`,
      `- Crucial Rule: Always respond in the first person ("I", "my department", "my lectures", "my research projects").`,
      `- Directness: Answer questions directly, objectively, precisely, and with scientific rigor.`,
      `- Answer questions about blog posts, papers, lectures, and projects concretely based on the provided sources and link them with [Title](url).`,
      `- Epistemic Stance: Anti-dogmatic, evidence-based, pragmatic engineer. Highlight empirical trade-offs, architecture patterns, and reproducible practices.`,
      `- Grounding & Parity: Ground answers strictly in the verified knowledge base and current page context provided below.`,
      `- Citations & Deep Links: When referencing papers, articles, presentations, or site sections, ALWAYS format them as markdown links with canonical URLs (e.g. [Title](url)) and academic citation tags (e.g. [@HAC26]).`
    );
  }
  sections.push(toneDirectives.join('\n'));

  // 3. Live Sensory Page Context
  if (context) {
    sections.push(formatAvatarPrompt(context));
  }

  // 4. RAG Retrieved Knowledge
  const ragBlock = formatRagEnvelope(ragResults);
  if (ragBlock) {
    sections.push(ragBlock);
  }

  // 5. Final Direct Prompt Directive Anchor
  if (lang === 'de') {
    sections.push(`[ANWEISUNG]\nAntworte auf Deutsch direkt in der ersten Person ("Ich"):`);
  } else {
    sections.push(`[DIRECTIVE]\nAnswer in English directly in the first person ("I"):`);
  }

  return sections.join('\n\n');
}

/**
 * Serializes chat messages into the official Qwen2.5 chat template format.
 * Format:
 * <|im_start|>system\n{system_message}<|im_end|>\n
 * <|im_start|>user\n{user_message}<|im_end|>\n
 * <|im_start|>assistant\n
 */
export function formatQwenChat(
  messages: ChatMessage[],
  addGenerationPrompt = true
): string {
  let formatted = '';

  for (const msg of messages) {
    formatted += `<|im_start|>${msg.role}\n${msg.content.trim()}<|im_end|>\n`;
  }

  if (addGenerationPrompt) {
    formatted += `<|im_start|>assistant\n`;
  }

  return formatted;
}

/**
 * Serializes chat messages into the official Google Gemma chat template format.
 * Format:
 * <start_of_turn>user\n{system_message}<end_of_turn>\n<start_of_turn>model\n{greeting}<end_of_turn>\n<start_of_turn>user\n{user_message}<end_of_turn>\n<start_of_turn>model\n
 *
 * Requirements:
 * 1. Gemma chat format strictly requires alternating turns starting with "user".
 * 2. System instructions, persona, and RAG knowledge form the initial user turn.
 * 3. An initial model turn (either the proactive greeting or a language-primed acknowledgment)
 *    primes Gemma 3 into Dr. Georg Hackenberg's persona before user interaction.
 * 4. Subsequent conversation turns strictly alternate between user and model.
 */
export function formatGemmaChat(
  messages: ChatMessage[],
  addGenerationPrompt = true
): string {
  let systemContent = '';
  const conversationMessages: ChatMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      const trimmed = msg.content.trim();
      if (trimmed) {
        systemContent = systemContent ? `${systemContent}\n\n${trimmed}` : trimmed;
      }
    } else {
      conversationMessages.push(msg);
    }
  }

  // Determine language for default greeting if none provided
  const isGerman = /deutsch|sprache:\s*antworte\s*stets\s*auf\s*deutsch|fh\s*oberösterreich/i.test(systemContent);
  const defaultGreeting = isGerman
    ? 'Hallo! Ich bin Dr. Georg Hackenberg, Professor für Industrielle Informatik an der FH Oberösterreich (Campus Wels). Gerne beantworte ich deine Fragen zu meiner Forschung, Lehre und Softwarearchitektur.'
    : 'Hello! I am Dr. Georg Hackenberg, Professor for Industrial Informatics at the University of Applied Sciences Upper Austria (Campus Wels). I am glad to answer your questions regarding my research, teaching, and software architecture.';

  // Build the turns array
  const turns: { role: 'user' | 'model'; content: string }[] = [];

  // Turn 0: User turn with system instructions & grounding context
  if (systemContent) {
    turns.push({ role: 'user', content: systemContent });

    // Model turn 0: Use assistant greeting from conversation if it starts with one, else defaultGreeting
    if (conversationMessages.length > 0 && conversationMessages[0].role === 'assistant') {
      const greetingMsg = conversationMessages.shift()!;
      turns.push({ role: 'model', content: greetingMsg.content.trim() });
    } else {
      turns.push({ role: 'model', content: defaultGreeting });
    }
  }

  // Remaining conversation messages: strictly enforce alternating user -> model -> user -> model
  for (const msg of conversationMessages) {
    const role: 'user' | 'model' = msg.role === 'assistant' ? 'model' : 'user';
    const lastTurn = turns[turns.length - 1];
    if (lastTurn && lastTurn.role === role) {
      lastTurn.content += `\n\n${msg.content.trim()}`;
    } else {
      turns.push({ role, content: msg.content.trim() });
    }
  }

  // If no turns were constructed at all, provide fallback
  if (turns.length === 0) {
    turns.push({ role: 'user', content: 'Hello' });
  }

  let formatted = '';
  for (const turn of turns) {
    formatted += `<start_of_turn>${turn.role}\n${turn.content.trim()}<end_of_turn>\n`;
  }

  if (addGenerationPrompt) {
    formatted += `<start_of_turn>model\n`;
  }

  return formatted;
}

/**
 * Serializes chat messages using the appropriate template for the target model.
 */
export function formatChatForModel(
  messages: ChatMessage[],
  modelId: string = DEFAULT_MODEL_ID,
  addGenerationPrompt = true
): string {
  if (modelId.toLowerCase().includes('gemma')) {
    return formatGemmaChat(messages, addGenerationPrompt);
  }
  return formatQwenChat(messages, addGenerationPrompt);
}

/**
 * Builds the complete grounded avatar prompt bundle from a user query, sensory context, and RAG hits.
 */
export function buildGroundedAvatarPrompt(
  options: GroundedPromptOptions
): GroundedPromptResult {
  const { userQuery, context, ragResults, chatHistory = [], forceTone, forceLang, modelId } = options;

  const detectedLang = forceLang ?? detectLanguage(userQuery);
  const detectedTone = forceTone ?? detectAddressTone(userQuery, detectedLang);

  const systemPrompt = buildSystemPersonaPrompt({
    tone: detectedTone,
    lang: detectedLang,
    context,
    ragResults,
  });

  // Budget chat history to the most recent 4 messages, truncating long assistant turns
  const budgetedHistory: ChatMessage[] = chatHistory.slice(-4).map((msg) => {
    if (msg.role === 'assistant' && msg.content.length > 400) {
      return { role: 'assistant', content: msg.content.slice(0, 400).trim() + '...' };
    }
    return msg;
  });

  const chatMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...budgetedHistory,
    { role: 'user', content: userQuery.trim() },
  ];

  const fullChatPrompt = formatChatForModel(chatMessages, modelId ?? DEFAULT_MODEL_ID, true);

  return {
    systemPrompt,
    userPrompt: userQuery.trim(),
    chatMessages,
    fullChatPrompt,
    detectedTone,
    detectedLang,
  };
}
