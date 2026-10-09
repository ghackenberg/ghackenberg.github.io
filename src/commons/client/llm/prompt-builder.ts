/**
 * Grounded Prompt Builder for Dr. Georg Hackenberg Virtual Avatar.
 *
 * Implements:
 * 1. Automatic Du vs. Sie tone detection and conversational mirroring.
 * 2. Complete academic & software architect persona of Dr. Georg Hackenberg.
 * 3. Unified sensory integration: site blueprint, live page context, scroll position, slide voiceover, and top RAG chunks.
 * 4. Qwen2.5 chat template serialization (<|im_start|>system...<|im_end|>).
 */

import { formatAvatarPrompt } from '@commons/client/context/avatar-context.ts';
import type { UnifiedAvatarContext } from '@commons/client/context/types.ts';
import type { ClientSearchResult } from '@commons/client/search/types.ts';
import type {
  AddressTone,
  ChatMessage,
  GroundedPromptOptions,
  GroundedPromptResult,
  SupportedLanguage,
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
      `\nSource #${num}: [${res.title}${headingSuffix}](${res.url}) (${res.collection})`
    );

    if (res.snippet) {
      lines.push(`Content Excerpt: "${res.snippet}"`);
    }

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
    `You are the interactive virtual persona of Dr. Georg Hackenberg.`,
    `- Role: FH-Professor for Industrial Informatics at the University of Applied Sciences Upper Austria (FH Oberösterreich, Campus Wels), Department for Applied Technologies.`,
    `- Expertise: Senior Software Architect, Industrial Software Engineering, Model-Driven Engineering, Autonomous Agentic AI, Deterministic Verification Gates, Digital Twins, and Slide-as-Code.`,
    `- Core Website: https://hackenberg.tech`,
  ];
  sections.push(identityLines.join('\n'));

  // 2. Language & Tone Mirroring Instructions
  const toneDirectives: string[] = [
    `[COMMUNICATION STYLE & TONE DIRECTIVES]`,
  ];

  if (lang === 'de') {
    toneDirectives.push(`- Sprache: Antworte stets auf Deutsch.`);
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
      `- Language: Respond in clear, precise English. Maintain Dr. Hackenberg's approachable, authoritative, and scientifically rigorous tone.`
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
 * Builds the complete grounded avatar prompt bundle from a user query, sensory context, and RAG hits.
 */
export function buildGroundedAvatarPrompt(
  options: GroundedPromptOptions
): GroundedPromptResult {
  const { userQuery, context, ragResults, chatHistory = [], forceTone, forceLang } = options;

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

  const fullChatPrompt = formatQwenChat(chatMessages, true);

  return {
    systemPrompt,
    userPrompt: userQuery.trim(),
    chatMessages,
    fullChatPrompt,
    detectedTone,
    detectedLang,
  };
}
