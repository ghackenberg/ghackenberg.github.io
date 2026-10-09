/**
 * Comprehensive Verification Suite for WebGPU In-Browser LLM Runtime.
 *
 * Validates:
 * 1. German Du vs. Sie tone detection & English language detection.
 * 2. Complete academic & architect persona for Dr. Georg Hackenberg.
 * 3. Sensory context integration (blueprint, live page, scroll excerpt, slide voiceover).
 * 4. Grounded RAG knowledge citations and deep link formatting.
 * 5. Qwen2.5 chat template serialization and multi-turn payloads.
 * 6. Model cache and storage quota safety in Node/SSR environments.
 */

import {
  detectAddressTone,
  detectLanguage,
  buildSystemPersonaPrompt,
  formatRagEnvelope,
  formatQwenChat,
  formatGemmaChat,
  buildGroundedAvatarPrompt,
} from '@commons/client/llm/prompt-builder.ts';
import {
  getStorageQuota,
  isCacheApiSupported,
  isModelCached,
  purgeModelCache,
} from '@commons/client/llm/model-cache.ts';
import {
  CANONICAL_SITE_BLUEPRINT,
} from '@commons/client/context/site-blueprint.ts';
import type { UnifiedAvatarContext } from '@commons/client/context/types.ts';
import type { ClientSearchResult } from '@commons/client/search/types.ts';
import {
  SUPPORTED_MODELS,
  DEFAULT_MODEL_ID,
  getModelConfig,
  type ChatMessage,
} from '@commons/client/llm/types.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`);
    process.exit(1);
  }
}

function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(words * 1.3);
}

async function runLLMTests(): Promise<void> {
  console.log('='.repeat(80));
  console.log('🧠 WEBGPU LLM RUNTIME & GROUNDED PROMPT VERIFICATION SUITE');
  console.log('='.repeat(80));

  // --------------------------------------------------------------------------
  // Scenario 1: Model Configurations & Registry
  // --------------------------------------------------------------------------
  console.log('\n[1/6] Validating Model Registry & Configurations...');
  assert(!SUPPORTED_MODELS['qwen-0.5b'], 'qwen-0.5b model is not registered (exclusive Gemma 3)');
  assert(Boolean(SUPPORTED_MODELS['gemma-3-1b']), 'gemma-3-1b model registered');
  assert(DEFAULT_MODEL_ID === 'onnx-community/gemma-3-1b-it-ONNX-GQA', 'Default model ID is onnx-community/gemma-3-1b-it-ONNX-GQA');
  assert(SUPPORTED_MODELS['gemma-3-1b'].sizeBytes === 750_000_000, 'Gemma 3 1B size is ~750MB');
  assert(SUPPORTED_MODELS['gemma-3-1b'].dtype === 'q4', 'gemma-3-1b model is configured for q4 quantization');
  assert(SUPPORTED_MODELS['gemma-3-1b'].id === 'onnx-community/gemma-3-1b-it-ONNX-GQA', 'gemma-3-1b model ID is accurate');
  assert(SUPPORTED_MODELS['gemma-3-1b'].contextLength === 8_192, 'gemma-3-1b context length is 8,192');
  assert(getModelConfig('gemma-3-1b').id === 'onnx-community/gemma-3-1b-it-ONNX-GQA', 'getModelConfig resolves key');
  assert(getModelConfig('onnx-community/gemma-3-1b-it-ONNX-GQA').name.includes('Gemma-3'), 'getModelConfig resolves HF id');
  assert(Object.keys(SUPPORTED_MODELS).length === 1, 'Gemma 3 1B is the sole registered model');
  console.log('   ✅ Model registry and quantizations verified.');

  // --------------------------------------------------------------------------
  // Scenario 2: Language & Address Tone Detection (Du vs. Sie vs. EN)
  // --------------------------------------------------------------------------
  console.log('\n[2/6] Validating Language & Du/Sie Address Tone Detection...');

  // German Du cases
  const duQueries = [
    'Kannst du mir die Architektur deines Frameworks erklären?',
    'Was hältst du von Digital Twins in der industriellen Produktion?',
    'Hallo Georg, wie hast du die Verifikations-Gates implementiert?',
    'Zeig mir bitte deine neuesten Publikationen.',
  ];

  for (const q of duQueries) {
    const lang = detectLanguage(q);
    const tone = detectAddressTone(q, lang);
    assert(lang === 'de', `Expected German language for: "${q}", got ${lang}`);
    assert(tone === 'du', `Expected Du tone for: "${q}", got ${tone}`);
  }

  // German Sie cases
  const sieQueries = [
    'Könnten Sie bitte Ihre Publikationen zu Softwarearchitektur vorstellen?',
    'Welche Forschungsschwerpunkte verfolgen Sie an der FH Oberösterreich?',
    'Was empfehlen Sie für industrielle Steuerungssysteme?',
    'Haben Sie Erfahrungen mit deterministischer Multi-Agenten-Orchestrierung?',
  ];

  for (const q of sieQueries) {
    const lang = detectLanguage(q);
    const tone = detectAddressTone(q, lang);
    assert(lang === 'de', `Expected German language for: "${q}", got ${lang}`);
    assert(tone === 'sie', `Expected Sie tone for: "${q}", got ${tone}`);
  }

  // English cases
  const enQueries = [
    'How does the sovereign agentic workflow achieve deterministic verification?',
    'Could you explain the difference between the control plane and data plane?',
    'What courses do you teach at Campus Wels?',
    'Where can I find the Slide-as-Code presentation on agent orchestration?',
  ];

  for (const q of enQueries) {
    const lang = detectLanguage(q);
    const tone = detectAddressTone(q, lang);
    assert(lang === 'en', `Expected English language for: "${q}", got ${lang}`);
    assert(tone === 'neutral', `Expected neutral/standard tone for English: "${q}", got ${tone}`);
  }

  console.log('   ✅ Tone detection correctly distinguishes German Du, Sie, and English queries.');

  // --------------------------------------------------------------------------
  // Scenario 3: Persona Construction & Tone Mirroring Directives
  // --------------------------------------------------------------------------
  console.log('\n[3/6] Validating Dr. Georg Hackenberg Persona & Tone Mirroring Directives...');

  const duPrompt = buildSystemPersonaPrompt({ tone: 'du', lang: 'de' });
  assert(duPrompt.includes('Dr. Georg Hackenberg'), 'Includes persona identity');
  assert(duPrompt.includes('Full Professor für Industrielle Informatik'), 'Includes academic title');
  assert(duPrompt.includes('Campus Wels'), 'Includes FH campus');
  assert(duPrompt.includes('Sprich den Fragenden per "Du" an'), 'Includes Du mirroring directive');
  assert(duPrompt.includes('https://hackenberg.tech'), 'Includes site URL');
  assert(duPrompt.includes('Wichtige Regel: Antworte stets in der ersten Person'), 'Includes German first-person directive');
  assert(duPrompt.includes('Beantworte Fragen zu Blog-Posts, Papern, Vorlesungen und Projekten konkret'), 'Includes grounded source linking rule');

  const siePrompt = buildSystemPersonaPrompt({ tone: 'sie', lang: 'de' });
  assert(siePrompt.includes('Sprich den Fragenden per "Sie" an'), 'Includes Sie mirroring directive');

  const enPrompt = buildSystemPersonaPrompt({ tone: 'neutral', lang: 'en' });
  assert(enPrompt.includes('Respond in clear, precise English'), 'Includes English directive');
  assert(enPrompt.includes('Crucial Rule: Always respond in the first person'), 'Includes English first-person directive');
  assert(enPrompt.includes('Anti-dogmatic, evidence-based'), 'Includes anti-dogmatic epistemic stance');

  console.log('   ✅ Persona directives enforce tone mirroring and academic rigor.');

  // --------------------------------------------------------------------------
  // Scenario 4: Live Context Integration & RAG Citation Grounding
  // --------------------------------------------------------------------------
  console.log('\n[4/6] Validating Unified Context & Grounded RAG Formatting...');

  const mockBlogContext: UnifiedAvatarContext = {
    timestamp: Date.now(),
    blueprint: CANONICAL_SITE_BLUEPRINT,
    page: {
      collectionType: 'posts',
      url: 'https://hackenberg.tech/posts/agentic-software-engineering/',
      title: 'Agentic Software Engineering',
      description: 'Architecting autonomous AI coding workflows.',
      keywords: ['AI', 'Architecture'],
      lang: 'en',
      toc: [
        { id: 'control-plane', title: '1. Control Plane vs Data Plane', level: 2 },
      ],
    },
    activeSection: {
      id: 'control-plane',
      title: '1. Control Plane vs Data Plane',
      level: 'h2',
      excerpt: 'Orchestrators supervise gates while subagents mutate code.',
    },
    activeSlide: null,
  };

  const mockRagResults: ClientSearchResult[] = [
    {
      id: 'chunk_posts_agentic_01',
      sourceId: 'agentic-software-engineering',
      collection: 'posts',
      title: 'Agentic Software Engineering',
      heading: 'Control Plane vs Data Plane',
      url: 'https://hackenberg.tech/posts/agentic-software-engineering/#control-plane',
      snippet: 'The orchestrator maintains the top-level plan and gates, while subagents execute tasks.',
      content: 'The orchestrator maintains the top-level plan and gates, while subagents execute tasks. Full unclipped chunk text passing complete architecture semantics.',
      tags: ['Agentic AI', 'Architecture'],
      lang: 'en',
      score: 0.95,
      citations: [
        {
          id: 'HAC26',
          title: 'Deterministic Verification Pipelines in Agentic Codebases',
          author: 'Hackenberg, G.',
          year: 2026,
        },
      ],
    },
  ];

  const ragEnvelope = formatRagEnvelope(mockRagResults);
  assert(ragEnvelope.includes('[RETRIEVED KNOWLEDGE (RAG GROUNDING)]'), 'Includes RAG envelope header');
  assert(ragEnvelope.includes('[SOURCE #1]: [Agentic Software Engineering > Control Plane vs Data Plane](https://hackenberg.tech/posts/agentic-software-engineering/#control-plane) (posts)'), 'Includes deep-link markdown title');
  assert(ragEnvelope.includes('Content:\n"""\nThe orchestrator maintains the top-level plan and gates, while subagents execute tasks. Full unclipped chunk text passing complete architecture semantics.\n"""'), 'Includes full unclipped content wrapped in triple quotes');
  assert(ragEnvelope.includes('[@HAC26]'), 'Includes semantic academic citation');

  const groundedResult = buildGroundedAvatarPrompt({
    userQuery: 'Kannst du mir erklären, wie die Trennung zwischen Control Plane und Data Plane funktioniert?',
    context: mockBlogContext,
    ragResults: mockRagResults,
  });

  assert(groundedResult.detectedTone === 'du', 'Detected Du from user query');
  assert(groundedResult.detectedLang === 'de', 'Detected German language');
  assert(groundedResult.systemPrompt.includes('[SITE ARCHITECTURE]'), 'System prompt includes site architecture');
  assert(groundedResult.systemPrompt.includes('[CURRENT PAGE CONTEXT]'), 'System prompt includes page context');
  assert(groundedResult.systemPrompt.includes('[USER READING POSITION]'), 'System prompt includes scroll position');
  assert(groundedResult.systemPrompt.includes('[@HAC26]'), 'System prompt includes RAG citations');

  const promptTokens = estimateTokens(groundedResult.fullChatPrompt);
  console.log(`   Grounded prompt token estimate: ~${promptTokens} tokens`);
  assert(promptTokens < 1200, `Prompt remains compact and token-efficient (target <1200, got ${promptTokens})`);

  console.log('   ✅ Grounded sensory context and RAG citation envelopes successfully synthesized.');

  // --------------------------------------------------------------------------
  // Scenario 5: Chat Template Serialization (Qwen ChatML & Google Gemma)
  // --------------------------------------------------------------------------
  console.log('\n[5/6] Validating Chat Template Serialization (Qwen & Gemma)...');

  const messages: ChatMessage[] = [
    { role: 'system', content: 'You are Dr. Georg Hackenberg.' },
    { role: 'user', content: 'What is Slide-as-Code?' },
    { role: 'assistant', content: 'Slide-as-Code treats presentations as software engineering artifacts.' },
    { role: 'user', content: 'Can you show me an example?' },
  ];

  const qwenSerialized = formatQwenChat(messages, true);
  assert(qwenSerialized.startsWith('<|im_start|>system\nYou are Dr. Georg Hackenberg.<|im_end|>\n'), 'System turn formatted for Qwen');
  assert(qwenSerialized.includes('<|im_start|>user\nWhat is Slide-as-Code?<|im_end|>\n'), 'User turn 1 formatted for Qwen');
  assert(qwenSerialized.includes('<|im_start|>assistant\nSlide-as-Code treats presentations as software engineering artifacts.<|im_end|>\n'), 'Assistant turn formatted for Qwen');
  assert(qwenSerialized.includes('<|im_start|>user\nCan you show me an example?<|im_end|>\n'), 'User turn 2 formatted for Qwen');
  assert(qwenSerialized.endsWith('<|im_start|>assistant\n'), 'Ends with Qwen generation prompt');

  const gemmaSerialized = formatGemmaChat(messages, true);
  assert(gemmaSerialized.startsWith('<start_of_turn>user\nYou are Dr. Georg Hackenberg.\n\nWhat is Slide-as-Code?<end_of_turn>\n'), 'System + user turn combined for Gemma');
  assert(gemmaSerialized.includes('<start_of_turn>model\nSlide-as-Code treats presentations as software engineering artifacts.<end_of_turn>\n'), 'Model turn formatted for Gemma');
  assert(gemmaSerialized.includes('<start_of_turn>user\nCan you show me an example?<end_of_turn>\n'), 'User turn 2 formatted for Gemma');
  assert(gemmaSerialized.endsWith('<start_of_turn>model\n'), 'Ends with Gemma generation prompt');

  // Verify Gemma chat template with proactive assistant greeting bug fix
  const messagesWithGreeting: ChatMessage[] = [
    { role: 'system', content: 'You are Dr. Georg Hackenberg.' },
    { role: 'assistant', content: 'Hello! I am the virtual avatar of Dr. Georg Hackenberg.' },
    { role: 'user', content: 'What is Slide-as-Code?' },
  ];
  const gemmaWithGreeting = formatGemmaChat(messagesWithGreeting, true);
  assert(gemmaWithGreeting.startsWith('<start_of_turn>user\nYou are Dr. Georg Hackenberg.\n\nWhat is Slide-as-Code?<end_of_turn>\n'), 'System prefix attached to user turn despite initial assistant greeting');
  assert(gemmaWithGreeting.endsWith('<start_of_turn>model\n'), 'Ends with Gemma generation prompt');
  assert(!gemmaWithGreeting.includes('<start_of_turn>model\nHello! I am the virtual avatar'), 'Leading assistant greeting is stripped to ensure first turn is user');

  console.log('   ✅ Qwen and Gemma chat templates follow exact model specifications.');

  // --------------------------------------------------------------------------
  // Scenario 6: Model Cache & Storage Quota Node/SSR Safety
  // --------------------------------------------------------------------------
  console.log('\n[6/6] Validating Model Cache & Storage Quota Node Fallbacks...');

  assert(isCacheApiSupported() === false, 'Cache API correctly reports unsupported in Node environment');
  const quota = await getStorageQuota();
  assert(quota.quota === 0 && quota.usage === 0, 'Storage quota returns safe zeros in Node environment');

  const cached = await isModelCached(DEFAULT_MODEL_ID);
  assert(cached === false, 'isModelCached returns false gracefully without throwing in Node');

  const purged = await purgeModelCache();
  assert(purged === false, 'purgeModelCache returns false gracefully without throwing in Node');

  console.log('   ✅ Model cache functions are SSR-safe and do not crash outside browser environments.');

  console.log('\n' + '='.repeat(80));
  console.log('🎉 ALL WEBGPU LLM RUNTIME TESTS PASSED (6/6)');
  console.log('='.repeat(80));
}

runLLMTests().catch((err: Error) => {
  console.error('Fatal error during LLM tests:', err);
  process.exit(1);
});
