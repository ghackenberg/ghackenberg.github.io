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
  assert(Boolean(SUPPORTED_MODELS['qwen-0.5b']), 'qwen-0.5b model registered');
  assert(Boolean(SUPPORTED_MODELS['qwen-1.5b']), 'qwen-1.5b model registered');
  assert(DEFAULT_MODEL_ID === 'Qwen/Qwen2.5-0.5B-Instruct', 'Default model ID is Qwen2.5-0.5B-Instruct');
  assert(SUPPORTED_MODELS['qwen-0.5b'].sizeBytes < 500_000_000, '0.5B q4 model size estimate is under 500MB');
  assert(SUPPORTED_MODELS['qwen-1.5b'].dtype === 'q4', '1.5B model is configured for q4 quantization');
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
  assert(duPrompt.includes('FH-Professor for Industrial Informatics'), 'Includes academic title');
  assert(duPrompt.includes('Campus Wels'), 'Includes FH campus');
  assert(duPrompt.includes('Sprich den Fragenden per "Du" an'), 'Includes Du mirroring directive');
  assert(duPrompt.includes('https://hackenberg.tech'), 'Includes site URL');

  const siePrompt = buildSystemPersonaPrompt({ tone: 'sie', lang: 'de' });
  assert(siePrompt.includes('Sprich den Fragenden per "Sie" an'), 'Includes Sie mirroring directive');

  const enPrompt = buildSystemPersonaPrompt({ tone: 'neutral', lang: 'en' });
  assert(enPrompt.includes('Respond in clear, precise English'), 'Includes English directive');
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
  assert(ragEnvelope.includes('Source #1: [Agentic Software Engineering > Control Plane vs Data Plane]'), 'Includes deep-link markdown title');
  assert(ragEnvelope.includes('https://hackenberg.tech/posts/agentic-software-engineering/#control-plane'), 'Includes deep link anchor URL');
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
  // Scenario 5: Qwen2.5 Chat Template Serialization & Multi-Turn History
  // --------------------------------------------------------------------------
  console.log('\n[5/6] Validating Qwen2.5 Chat Template Serialization...');

  const messages: ChatMessage[] = [
    { role: 'system', content: 'You are Dr. Georg Hackenberg.' },
    { role: 'user', content: 'What is Slide-as-Code?' },
    { role: 'assistant', content: 'Slide-as-Code treats presentations as software engineering artifacts.' },
    { role: 'user', content: 'Can you show me an example?' },
  ];

  const serialized = formatQwenChat(messages, true);

  assert(serialized.startsWith('<|im_start|>system\nYou are Dr. Georg Hackenberg.<|im_end|>\n'), 'System turn formatted');
  assert(serialized.includes('<|im_start|>user\nWhat is Slide-as-Code?<|im_end|>\n'), 'User turn 1 formatted');
  assert(serialized.includes('<|im_start|>assistant\nSlide-as-Code treats presentations as software engineering artifacts.<|im_end|>\n'), 'Assistant turn formatted');
  assert(serialized.includes('<|im_start|>user\nCan you show me an example?<|im_end|>\n'), 'User turn 2 formatted');
  assert(serialized.endsWith('<|im_start|>assistant\n'), 'Ends with generation prompt');

  console.log('   ✅ Qwen2.5 chat template follows exact ChatML specification.');

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
