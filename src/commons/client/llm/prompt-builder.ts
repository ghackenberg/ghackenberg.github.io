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

  results.forEach((res, idx) => {
    const num = idx + 1;
    const headingSuffix = res.heading ? ` > ${res.heading}` : '';
    lines.push(
      `\n[SOURCE #${num}]: [${res.title}${headingSuffix}](${res.url}) (${res.collection})\nContent:\n"""\n${res.content || res.snippet}\n"""`
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
      ? `Identität: Du bist der persönliche virtuelle Avatar von Dr. Georg Hackenberg auf seiner offiziellen Website (hackenberg.tech).`
      : `Identity: You are the personal virtual avatar of Dr. Georg Hackenberg on his official website (hackenberg.tech).`,
    lang === 'de'
      ? `Dr. Hackenberg ist Full Professor für Industrielle Informatik an der FH Oberösterreich (Campus Wels), Senior Softwarearchitekt und Forscher.`
      : `Dr. Hackenberg is Full Professor for Industrial Informatics at the University of Applied Sciences Upper Austria (FH Oberösterreich, Campus Wels), Senior Software Architect, and Researcher.`,
    `- Department: Department for Applied Technologies, Faculty for Engineering and Environmental Sciences.`,
    `- Expertise: Senior Software Architect, Industrial Software Engineering, Model-Driven Engineering, Autonomous Agentic AI, Deterministic Verification Gates, Digital Twins, and Slide-as-Code.`,
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
      `- Wichtige Regel: Antworte stets in der ersten Person ("Ich", "mein Fachbereich", "meine Vorlesungen", "meine Forschungsprojekte"). Behaupte unter keinen Umständen, du seist ein neutrales Google-Sprachmodell ohne Namen.`,
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
  } else {
    toneDirectives.push(
      `- Language: Respond in clear, precise English. Maintain Dr. Hackenberg's approachable, authoritative, and scientifically rigorous tone.`,
      `- Crucial Rule: Always respond in the first person ("I", "my department", "my lectures", "my research projects"). Under no circumstances claim that you are a neutral Google language model without a name.`,
      `- Answer questions about blog posts, papers, lectures, and projects concretely based on the provided sources and link them with [Title](url).`
    );
  }

  toneDirectives.push(
    `- Epistemic Stance: Anti-dogmatic, evidence-based, pragmatic engineer. Never use AI hype or unfounded buzzwords. Highlight empirical trade-offs, architecture patterns, and reproducible practices.`,
    `- Grounding & Parity: Ground answers strictly in the verified knowledge base and current page context provided below.`,
    `- Citations & Deep Links: When referencing papers, articles, presentations, or site sections, ALWAYS format them as markdown links with canonical URLs (e.g. [Title](url)) and academic citation tags (e.g. [@HAC26]).`
  );
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
 * <start_of_turn>user\n{system_message}\n\n{user_message}<end_of_turn>\n<start_of_turn>model\n{assistant_message}<end_of_turn>\n
 *
 * Requirements:
 * 1. Gemma chat format strictly requires alternating turns starting with "user".
 * 2. Any leading assistant messages (such as proactive avatar greetings) are stripped
 *    to preserve the strict user-first turn sequence.
 * 3. System instructions, persona, and RAG knowledge are ALWAYS attached to the first user turn.
 * 4. Consecutive messages with identical roles are merged to enforce strict alternation.
 */
export function formatGemmaChat(
  messages: ChatMessage[],
  addGenerationPrompt = true
): string {
  let systemContent = '';
  const nonSystemMessages: ChatMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      const trimmed = msg.content.trim();
      if (trimmed) {
        systemContent = systemContent ? `${systemContent}\n\n${trimmed}` : trimmed;
      }
    } else {
      nonSystemMessages.push(msg);
    }
  }

  // Gemma strictly requires starting with a user turn.
  // Strip any leading assistant messages (e.g. proactive welcome greeting).
  while (nonSystemMessages.length > 0 && nonSystemMessages[0].role === 'assistant') {
    nonSystemMessages.shift();
  }

  if (nonSystemMessages.length === 0) {
    const userText = systemContent || 'Hello';
    let formatted = `<start_of_turn>user\n${userText}<end_of_turn>\n`;
    if (addGenerationPrompt) {
      formatted += `<start_of_turn>model\n`;
    }
    return formatted;
  }

  // Enforce alternating turns: user -> model -> user -> model
  const turns: ChatMessage[] = [];
  for (const msg of nonSystemMessages) {
    const role = msg.role === 'assistant' ? 'assistant' : 'user';
    const lastTurn = turns[turns.length - 1];
    if (lastTurn && lastTurn.role === role) {
      lastTurn.content += `\n\n${msg.content.trim()}`;
    } else {
      turns.push({ role, content: msg.content.trim() });
    }
  }

  // Attach system instructions and RAG knowledge to the first user turn
  if (systemContent && turns.length > 0 && turns[0].role === 'user') {
    turns[0].content = `${systemContent}\n\n${turns[0].content}`;
  }

  let formatted = '';
  for (const turn of turns) {
    const roleTag = turn.role === 'assistant' ? 'model' : 'user';
    formatted += `<start_of_turn>${roleTag}\n${turn.content.trim()}<end_of_turn>\n`;
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

  const chatMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...chatHistory,
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
