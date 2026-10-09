import {
  CANONICAL_SITE_BLUEPRINT,
  getSiteBlueprint,
  formatBlueprintEnvelope,
} from '@commons/client/context/site-blueprint.ts';
import {
  detectCollectionType,
  extractPageEnvelope,
} from '@commons/client/context/page-context.ts';
import {
  ScrollTracker,
  extractSectionExcerpt,
  type HeadingLikeElement,
} from '@commons/client/context/scroll-tracker.ts';
import { SlideTracker } from '@commons/client/context/slide-tracker.ts';
import {
  AvatarContextProvider,
  formatAvatarPrompt,
} from '@commons/client/context/avatar-context.ts';
import type { UnifiedAvatarContext } from '@commons/client/context/types.ts';

function estimateTokens(text: string): number {
  // Common empirical heuristic: ~1 token per 4 characters or ~1.3 tokens per word
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(words * 1.3);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`);
    process.exit(1);
  }
}

async function runContextTests(): Promise<void> {
  console.log('='.repeat(80));
  console.log('🧪 VIRTUAL AVATAR CONTEXT & SENSORIK VERIFICATION SUITE');
  console.log('='.repeat(80));

  // --- Scenario 1: Site Blueprint & Compact LLM Envelope ---
  console.log('\n[1/5] Testing Site Blueprint & Prompt Envelope...');
  const blueprint = getSiteBlueprint();
  assert(blueprint.siteName === 'Dr. Georg Hackenberg', 'Blueprint siteName matches author');
  assert(blueprint.collections.length >= 7, 'Blueprint contains all canonical collections');
  assert(blueprint.canonicalUrl === 'https://hackenberg.tech', 'Canonical URL is correct');

  const blueprintPrompt = formatBlueprintEnvelope(blueprint);
  const bpTokens = estimateTokens(blueprintPrompt);
  console.log(`   Blueprint envelope length: ${blueprintPrompt.length} chars, ~${bpTokens} tokens`);
  assert(blueprintPrompt.includes('[SITE ARCHITECTURE]'), 'Contains architecture header');
  assert(blueprintPrompt.includes('/posts/'), 'Contains posts taxonomy');
  assert(blueprintPrompt.includes('/presentations/'), 'Contains presentations taxonomy');
  assert(bpTokens <= 200, `Blueprint envelope is token-efficient (~150 tokens target, got ${bpTokens})`);
  console.log('   ✅ Blueprint is semantically dense and token-efficient.');

  // --- Scenario 2: Collection Detection & SSR Page Envelope Extraction ---
  console.log('\n[2/5] Testing Collection Type Detection & SSR Envelope Fallback...');
  assert(detectCollectionType('/') === 'home', 'Detects home collection');
  assert(detectCollectionType('/posts/agentic-ai') === 'posts', 'Detects posts collection');
  assert(detectCollectionType('/presentations/ai-slides/') === 'presentations', 'Detects presentations collection');
  assert(detectCollectionType('/courses/industrial-informatics') === 'courses', 'Detects courses collection');
  assert(detectCollectionType('/projects/cad-tools') === 'projects', 'Detects projects collection');
  assert(detectCollectionType('/services/advisory') === 'services', 'Detects services collection');
  assert(detectCollectionType('/publications/ieee-2026') === 'publications', 'Detects publications collection');
  assert(detectCollectionType('/visualizations/force-graph') === 'visualizations', 'Detects visualizations collection');

  const ssrEnvelope = extractPageEnvelope(null, '/posts/agentic-ai');
  assert(ssrEnvelope.collectionType === 'posts', 'SSR envelope inherits correct collection type');
  assert(ssrEnvelope.url.includes('/posts/agentic-ai'), 'SSR envelope has valid URL');
  assert(Array.isArray(ssrEnvelope.toc), 'TOC is an array even in SSR fallback');
  console.log('   ✅ Page envelope extraction handles SSR/Node gracefully without errors.');

  // --- Scenario 3: Scroll Tracker & Excerpt Extraction ---
  console.log('\n[3/5] Testing Scroll Tracker & Excerpt Truncation...');
  const scrollTracker = new ScrollTracker();
  assert(scrollTracker.getActiveSection() === null, 'Initial active section is null');

  // Test excerpt extraction algorithm logic
  const mockHeading: HeadingLikeElement = {
    tagName: 'H2',
    nextElementSibling: {
      tagName: 'P',
      textContent: '   In this architectural deep dive, we explore autonomous agent pipelines for software delivery.   ',
      nextElementSibling: {
        tagName: 'P',
        textContent: 'We strictly decouple the control plane orchestrator from discrete worker agents.',
        nextElementSibling: {
          tagName: 'H2', // Stop tag
          textContent: 'Next Section',
          nextElementSibling: null,
        },
      },
    },
  };

  const extracted = extractSectionExcerpt(mockHeading, 150);
  assert(extracted.includes('In this architectural deep dive'), 'Excerpt includes first paragraph');
  assert(extracted.includes('decouple the control plane'), 'Excerpt includes second paragraph');
  assert(!extracted.includes('Next Section'), 'Excerpt stops before next H2 heading');
  assert(extracted.length <= 150, 'Excerpt respects maxChars constraint');

  scrollTracker.setActiveSection({
    id: 'control-plane-orchestration',
    title: 'Control Plane vs Data Plane',
    level: 'h2',
    excerpt: extracted,
  });

  assert(scrollTracker.getActiveSection()?.title === 'Control Plane vs Data Plane', 'Active section updated');
  console.log('   ✅ Scroll tracker and section excerpt extraction verified.');

  // --- Scenario 4: Slide Tracker & Slide Navigation Events ---
  console.log('\n[4/5] Testing Slide Deck Tracker & Metadata Extraction...');
  const slideTracker = new SlideTracker();
  assert(!slideTracker.isDeckPresent(null), 'Reports deck not present when DOM is empty');
  assert(slideTracker.getActiveSlide() === null, 'Active slide is null without deck');

  // Set active slide manually for testing
  slideTracker.setActiveSlide({
    deckId: 'sovereign-agentic-workflows',
    index: 2,
    totalSlides: 18,
    id: 'slide-03',
    title: 'Control Plane & Gatekeeper Architecture',
    layout: 'comparison',
    bodyText: 'Orchestrator enforces verification gates. Worker subagents execute code mutations.',
    voiceoverText: 'Welcome to slide three. Here we examine the strict boundary between orchestrator and worker.',
    notes: 'Emphasize zero-polling reactive messaging and token economics.',
    references: [
      {
        id: 'HAC26',
        label: 'HAC26',
        title: 'Architectural Patterns for Sovereign Agent Teams',
        author: 'Hackenberg, G.',
        year: 2026,
      },
    ],
  });

  const activeSlide = slideTracker.getActiveSlide();
  assert(activeSlide?.index === 2, 'Slide index verified');
  assert(activeSlide?.voiceoverText?.includes('slide three') === true, 'Voiceover text captured');
  assert(activeSlide?.references?.length === 1, 'Citations correctly structured');

  // Test jumpToSlide call in Node (safe no-op without window)
  slideTracker.jumpToSlide(3, true);
  console.log('   ✅ Slide tracker metadata extraction and event handling verified.');

  // --- Scenario 5: Unified Context Manager & Complete LLM Grounding Prompt ---
  console.log('\n[5/5] Testing Unified LLM Grounding Prompts across Realistic Scenarios...');

  const avatarProvider = AvatarContextProvider.getInstance();

  // Test Case A: User reading a technical blog post
  const blogContext: UnifiedAvatarContext = {
    timestamp: Date.now(),
    blueprint: CANONICAL_SITE_BLUEPRINT,
    page: {
      collectionType: 'posts',
      url: 'https://hackenberg.tech/posts/agentic-software-engineering/',
      title: 'Agentic Software Engineering: Architecting Autonomous AI Coding Workflows',
      description: 'An architectural blueprint for multi-agent workflows, deterministic verification gates, and sovereign AI pairs.',
      keywords: ['Agentic AI', 'Software Architecture', 'TypeScript', 'Astro'],
      lang: 'en',
      toc: [
        { id: 'introduction', title: '1. The Autonomous Agent Paradigm', level: 2 },
        { id: 'control-plane', title: '1.1 Control Plane vs. Data Plane', level: 3 },
        { id: 'verification-gates', title: '2. Deterministic Verification Gates', level: 2 },
      ],
    },
    activeSection: {
      id: 'control-plane',
      title: '1.1 Control Plane vs. Data Plane',
      level: 'h3',
      excerpt: 'The orchestrator maintains the top-level plan and gates, while subagents execute tasks in isolated workspaces.',
      index: 1,
    },
    activeSlide: null,
  };

  const blogPrompt = formatAvatarPrompt(blogContext);
  const blogTokens = estimateTokens(blogPrompt);
  console.log('\n--- SAMPLE BLOG POST GROUNDING PROMPT ---');
  console.log(blogPrompt);
  console.log('-----------------------------------------');
  console.log(`Blog prompt length: ${blogPrompt.length} chars, ~${blogTokens} tokens`);

  assert(blogPrompt.includes('[SITE ARCHITECTURE]'), 'Prompt includes site architecture');
  assert(blogPrompt.includes('[CURRENT PAGE CONTEXT]'), 'Prompt includes page context');
  assert(blogPrompt.includes('Collection: posts'), 'Prompt includes collection type');
  assert(blogPrompt.includes('[USER READING POSITION]'), 'Prompt includes active reading position');
  assert(blogPrompt.includes('1.1 Control Plane vs. Data Plane'), 'Prompt includes active section title');
  assert(!blogPrompt.includes('[ACTIVE PRESENTATION SLIDE]'), 'No slide block when no deck active');
  assert(blogTokens <= 450, `Grounding prompt is compact (~450 tokens target, got ${blogTokens})`);

  // Test Case B: User viewing an interactive Slide-as-Code deck
  const slideContext: UnifiedAvatarContext = {
    timestamp: Date.now(),
    blueprint: CANONICAL_SITE_BLUEPRINT,
    page: {
      collectionType: 'presentations',
      url: 'https://hackenberg.tech/presentations/sovereign-agentic-workflows/',
      title: 'Sovereign Agentic Workflows: From Prompt Engineering to System Synthesis',
      description: 'Keynote presentation on deterministic agent orchestration with Slide-as-Code.',
      lang: 'en',
      toc: [],
    },
    activeSection: null,
    activeSlide: {
      deckId: 'sovereign-agentic-workflows',
      index: 4,
      totalSlides: 22,
      id: 'slide-05',
      title: 'Deterministic Verification Gates',
      layout: 'standard',
      bodyText: 'Every subagent execution must satisfy zero-error compilation, strict linting, and contract verification.',
      voiceoverText: 'Moving on to slide five: why deterministic verification gates are essential for autonomous coding agents.',
      notes: 'Highlight npm run verify and zero-warning policy.',
      references: [
        {
          label: 'HAC26',
          title: 'Deterministic Verification Pipelines in Agentic Codebases',
          year: 2026,
        },
      ],
    },
  };

  const slidePrompt = formatAvatarPrompt(slideContext);
  const slideTokens = estimateTokens(slidePrompt);
  console.log('\n--- SAMPLE SLIDE PRESENTATION GROUNDING PROMPT ---');
  console.log(slidePrompt);
  console.log('--------------------------------------------------');
  console.log(`Slide prompt length: ${slidePrompt.length} chars, ~${slideTokens} tokens`);

  assert(slidePrompt.includes('[ACTIVE PRESENTATION SLIDE]'), 'Prompt includes slide block');
  assert(slidePrompt.includes('Deterministic Verification Gates'), 'Prompt includes slide title');
  assert(slidePrompt.includes('Spoken Voiceover:'), 'Prompt includes voiceover');
  assert(slidePrompt.includes('[HAC26]'), 'Prompt includes citation references');
  assert(slideTokens <= 450, `Slide grounding prompt is compact (~450 tokens target, got ${slideTokens})`);

  // Test Singleton provider
  assert(avatarProvider.isInitialized() === false, 'Provider starts uninitialized');
  avatarProvider.initialize(null, '/');
  assert(avatarProvider.isInitialized() === true, 'Provider is initialized');
  const defaultPrompt = avatarProvider.generateSystemPrompt();
  assert(defaultPrompt.includes('Collection: home'), 'Default provider generates home context');
  avatarProvider.destroy();

  console.log('\n' + '='.repeat(80));
  console.log('🎉 ALL VIRTUAL AVATAR CONTEXT GATES PASSED (5/5)');
  console.log('='.repeat(80));
}

runContextTests().catch((err) => {
  console.error('Fatal error during context tests:', err);
  process.exit(1);
});
