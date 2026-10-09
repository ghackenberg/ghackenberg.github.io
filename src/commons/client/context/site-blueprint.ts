import type { SiteBlueprint } from './types.ts';

/**
 * Canonical Site Architecture and Navigation Blueprint
 * Represents the structured taxonomy of Georg Hackenberg's personal portfolio website.
 */
export const CANONICAL_SITE_BLUEPRINT: SiteBlueprint = {
  siteName: 'Dr. Georg Hackenberg',
  author: 'Dr. Georg Hackenberg',
  affiliation: 'University of Applied Sciences Upper Austria (FH OÖ Campus Wels)',
  role: 'Full Professor for Industrial Informatics',
  canonicalUrl: 'https://hackenberg.tech',
  primaryTopics: [
    'Industrial Informatics',
    'Sovereign Agentic AI Workflows',
    'Cyber-Physical Systems & Simulation',
    'Model-Driven Engineering & CAD/CAM',
    'Slide-as-Code Presentations',
  ],
  collections: [
    {
      id: 'posts',
      name: 'Blog Posts & Deep Dives',
      path: '/posts/',
      description: 'Technical articles, research guides, and software engineering deep dives (DE/EN).',
    },
    {
      id: 'presentations',
      name: 'Slide Decks & Talks',
      path: '/presentations/',
      description: 'Interactive Slide-as-Code decks with synchronized Edge-TTS voiceovers and transcript timeline.',
    },
    {
      id: 'courses',
      name: 'University Courses',
      path: '/courses/',
      description: 'University courses at FH Upper Austria Campus Wels: Software Engineering, Systems Engineering, Digital Factory, Computer-Simulation, Internet of Things (IoT), Data Analysis, Python, Java, TypeScript/Firebase, MAUI/ASP.NET.',
    },
    {
      id: 'projects',
      name: 'Software Projects & Blueprints',
      path: '/projects/',
      description: 'Key software projects: CADdrive (CAD/CAM geometry engine), Slide-as-Code (synchronized presentation framework), robotics, and cyber-physical systems.',
    },
    {
      id: 'services',
      name: 'Professional Advisory & Services',
      path: '/services/',
      description: 'B2B systems architecture advisory, sovereign agentic AI integration, and executive consulting.',
    },
    {
      id: 'publications',
      name: 'Academic Publications',
      path: '/publications/',
      description: 'Peer-reviewed journal papers, conference proceedings, and academic literature with BibTeX records.',
    },
    {
      id: 'visualizations',
      name: 'Interactive Visualizations',
      path: '/visualizations/',
      description: 'Interactive 2D/3D WebGL graph engines, canvas simulations, and algorithmic data visualizers.',
    },
    {
      id: 'interests',
      name: 'Personal Interests & Explorations',
      path: '/interests/',
      description: 'Academic interests, technology frontiers, essays, and personal engineering hobbies.',
    },
  ],
  quickLinks: [
    { label: 'Home', url: '/' },
    { label: 'Posts', url: '/posts/' },
    { label: 'Presentations', url: '/presentations/' },
    { label: 'Courses', url: '/courses/' },
    { label: 'Projects', url: '/projects/' },
    { label: 'Services', url: '/services/' },
    { label: 'Publications', url: '/publications/' },
    { label: 'Visualizations', url: '/visualizations/' },
  ],
};

/**
 * Retrieves the canonical site blueprint
 */
export function getSiteBlueprint(): SiteBlueprint {
  return CANONICAL_SITE_BLUEPRINT;
}

/**
 * Formats the site blueprint into a compact, token-dense LLM system prompt envelope (~150 tokens).
 * Maximizes semantic density while minimizing token consumption.
 */
export function formatBlueprintEnvelope(blueprint: SiteBlueprint = CANONICAL_SITE_BLUEPRINT): string {
  const collectionLines = blueprint.collections
    .map((col) => `- ${col.path}: ${col.description}`)
    .join('\n');

  return `[SITE ARCHITECTURE]
Domain: ${blueprint.author} (${blueprint.role} @ ${blueprint.affiliation})
Base URL: ${blueprint.canonicalUrl}
Core Focus: ${blueprint.primaryTopics.join(', ')}
Site Taxonomy:
${collectionLines}`;
}
