import { defineCollection, reference, type ImageFunction } from 'astro:content';
import { authorEntrySchema } from '@commons/shared/authors';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import fs from 'node:fs';
import path from 'node:path';

function getValidTagIds(): Set<string> {
  const tagsDir = path.resolve('./src/content/tags');
  if (!fs.existsSync(tagsDir)) return new Set();
  const entries = fs.readdirSync(tagsDir, { withFileTypes: true, recursive: true });
  const ids = new Set<string>();
  for (const entry of entries) {
    if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
      const relPath = path.relative(tagsDir, path.join(entry.parentPath ?? tagsDir, entry.name));
      const id = relPath
        .replace(/\\/g, '/')
        .replace(/\/index\.(md|mdx)$/, '')
        .replace(/\.(md|mdx)$/, '');
      ids.add(id);
    }
  }
  return ids;
}

const tagReference = z.string().superRefine((tagId, ctx) => {
  const validTags = getValidTagIds();
  if (!validTags.has(tagId)) {
    ctx.addIssue({
      code: 'custom',
      message: `Unknown tag "${tagId}". The tag is not defined in "src/content/tags/". Please create "src/content/tags/${tagId}.md" with a description or fix the tag reference.`
    });
  }
});

const coverImageSchema = ({ image }: { image: ImageFunction }) =>
  z.object({
    src: image(),
    title: z.string().min(3, "Image title must be at least 3 characters"),
    description: z.string().min(3, "Image description must be at least 3 characters"),
  }).refine((data) => data.title.trim().toLowerCase() !== data.description.trim().toLowerCase(), {
    message: "Image title and description must be distinct (no duplicate fallbacks)",
  });

export const organizationRefSchema = z.object({
  id: z.url(),
  name: z.string().min(1),
});

const baseReferenceFields = {
  id: z.string().min(1),
  label: z.string().optional(),
  authors: z.array(authorEntrySchema).min(1),
  title: z.string().min(1),
  url: z.url(),
  doi: z.string().optional(),
};

const rawReferenceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('inproceedings'),
    ...baseReferenceFields,
    booktitle: z.string().min(1),
    year: z.number().int(),
    pages: z.string().optional(),
    publisher: z.string().optional(),
  }),
  z.object({
    type: z.literal('article'),
    ...baseReferenceFields,
    journal: z.string().min(1),
    year: z.number().int(),
    volume: z.string().optional(),
    number: z.string().optional(),
    pages: z.string().optional(),
  }),
  z.object({
    type: z.literal('book'),
    ...baseReferenceFields,
    publisher: z.string().min(1),
    year: z.number().int(),
    edition: z.string().optional(),
    isbn: z.string().optional(),
  }),
  z.object({
    type: z.literal('online'),
    ...baseReferenceFields,
    year: z.number().int().optional(),
    siteName: z.string().optional(),
    urldate: z.string().optional(),
  }),
  z.object({
    type: z.literal('misc'),
    ...baseReferenceFields,
    year: z.number().int().optional(),
    howpublished: z.string().optional(),
    note: z.string().optional(),
  }),
]);

export const referenceSchema = rawReferenceSchema;

export const slideReferenceSchema = referenceSchema;
export type Reference = z.infer<typeof referenceSchema>;
export type SlideReference = Reference;

const posts = defineCollection({
  loader: glob({
    base: './src/content/posts',
    pattern: '**/index.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, '')
  }),
  schema: ({ image }) => z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    description: z.string().optional(),
    inLanguage: z.enum(['de', 'en']).default('de'),
    tags: z.array(tagReference).default([]),
    image: coverImageSchema({ image }),
    references: z.array(referenceSchema).default([]),
  }).strict(),
});

const publications = defineCollection({
  loader: glob({
    base: './src/content/publications',
    pattern: '**/index.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, '')
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      pubDate: z.coerce.date(),
      book: z.string().optional(),
      authors: z.array(authorEntrySchema).min(1),
      abstract: z.string().optional(),
      tags: z.array(tagReference).default([]),
      bibtex: z.string().optional(),
      image: coverImageSchema({ image }),
      publisherUrl: z.string().optional(),
    }).strict(),
});

const visualizations = defineCollection({
  loader: glob({
    base: './src/content/visualizations',
    pattern: '**/index.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, '')
  }),
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string(),
    image: coverImageSchema({ image }),
    pubDate: z.coerce.date().optional(),
    tags: z.array(tagReference).default([]),
    specs: z.object({
      renderingBackend: z.string(),
      spatialTopology: z.string(),
      nodeCapacity: z.string(),
      physicsSolver: z.string(),
      computationalComplexity: z.string(),
      primaryStrength: z.string(),
      tradeOff: z.string(),
      bestUseCase: z.string(),
    }).strict(),
  }).strict(),
});

const experiences = defineCollection({
  loader: glob({ base: './src/content/experiences', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    organization: organizationRefSchema,
    employmentType: z.string().optional(),
    startMonth: z.number(),
    startYear: z.number(),
    endMonth: z.number().nullable().optional(),
    endYear: z.number().nullable().optional(),
    location: z.string().optional(),
    color: z.enum(['blue', 'yellow', 'purple', 'green']).default('blue'),
    order: z.number().optional(),
    occupationalCategory: z.string().optional(),
  }).strict(),
});

const degrees = defineCollection({
  loader: glob({ base: './src/content/degrees', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    degree: z.string(),
    program: z.string(),
    organization: organizationRefSchema,
    startYear: z.number(),
    endYear: z.number().nullable().optional(),
    location: z.string().optional(),
    color: z.enum(['blue', 'yellow', 'purple', 'green']).default('blue'),
    order: z.number().optional(),
  }).strict(),
});

const profiles = defineCollection({
  loader: glob({ base: './src/content/profiles', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    name: z.string(),
    handle: z.string(),
    url: z.url(),
    icon: z.enum(['github', 'linkedin', 'youtube', 'scholar', 'orcid', 'wikidata']),
    order: z.number().default(0),
  }).strict(),
});

const projects = defineCollection({
  loader: glob({
    base: './src/content/projects',
    pattern: '**/index.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, '')
  }),
  schema: ({ image }) => z.object({
    title: z.string(),
    trl: z.number().int().min(1).max(9),
    description: z.string(),
    href: z.url(),
    tags: z.array(tagReference).default([]),
    accentColor: z.enum(['blue', 'yellow', 'purple', 'green']).default('blue'),
    order: z.number().default(0),
    repoName: z.string().optional(),
    image: coverImageSchema({ image }),
    screenshots: z.array(coverImageSchema({ image })).default([]),
    pubDate: z.coerce.date().optional(),
    challenge: z.string().optional(),
    solution: z.string().optional(),
    keyCapabilities: z.array(z.object({
      title: z.string(),
      description: z.string(),
      icon: z.string().default('🚀'),
    })).default([]),
    techStackHighlights: z.array(z.object({
      category: z.string(),
      technologies: z.array(z.string()),
    })).default([]),
    outcomes: z.array(z.string()).default([]),
  }).strict(),
});

const courses = defineCollection({
  loader: glob({
    base: './src/content/courses',
    pattern: '*/index.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, '')
  }),
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string().optional(),
    repoName: z.string(),
    learningGoals: z.array(z.string()).default([]),
    terms: z.array(z.string()).default([]),
    inLanguage: z.enum(['de', 'en']).default('de'),
    image: coverImageSchema({ image }),
    tags: z.array(tagReference).default([]),
    pubDate: z.coerce.date().optional(),
    overview: z.string().optional(),
    targetAudience: z.string().optional(),
    prerequisites: z.array(z.string()).default([]),
    competencies: z.array(z.object({
      title: z.string(),
      description: z.string(),
      icon: z.string().default('🎯'),
    })).default([]),
    syllabus: z.array(z.object({
      moduleNumber: z.string(),
      title: z.string(),
      description: z.string(),
      topics: z.array(z.string()).default([]),
      tools: z.array(z.string()).default([]),
    })).default([]),
  }).strict(),
});

const courseModules = defineCollection({
  loader: glob({
    base: './src/content/courses',
    pattern: '*/modules/*/index.{md,mdx}',
    generateId: ({ entry }) => {
      return entry.replace(/\/index\.(md|mdx)$/, '').replace('/modules/', '/');
    }
  }),
  schema: ({ image }) => z.object({
    title: z.string(),
    courseId: z.string(),
    moduleNumber: z.string().optional(),
    description: z.string(),
    order: z.number().default(0),
    topics: z.array(z.string()).default([]),
    tools: z.array(z.string()).default([]),
    competencies: z.array(z.string()).default([]),
    image: coverImageSchema({ image }).optional(),
    pubDate: z.coerce.date().optional(),
  }).strict()
});

const services = defineCollection({
  loader: glob({
    base: './src/content/services',
    pattern: '*/index.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, '')
  }),
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string(),
    order: z.number().default(0),
    ctaText: z.string().default('Inquire Now'),
    tags: z.array(tagReference).default([]),
    pubDate: z.coerce.date().optional(),
    image: coverImageSchema({ image }),
    targetAudience: z.array(z.string()).default([]),
    guidingPrinciples: z.array(z.object({
      title: z.string(),
      description: z.string(),
    })).default([]),
    strategicPillars: z.array(z.string()).default([]),
    techFoundations: z.array(z.string()).default([]),
    engagementFormats: z.array(z.object({
      title: z.string(),
      duration: z.string(),
      description: z.string(),
    })).optional(),
    keyOutcomes: z.array(z.string()).optional(),
  }).strict()
});

const serviceModules = defineCollection({
  loader: glob({
    base: './src/content/services',
    pattern: '*/modules/*/index.{md,mdx}',
    generateId: ({ entry }) => {
      return entry.replace(/\/index\.(md|mdx)$/, '').replace('/modules/', '/');
    }
  }),
  schema: ({ image }) => z.object({
    title: z.string(),
    serviceId: z.string(),
    description: z.string(),
    ctaText: z.string().default('Inquire about this Module'),
    highlights: z.array(z.string()).default([]),
    inputs: z.array(z.string()).default([]),
    outputs: z.array(z.string()).default([]),
    duration: z.string().optional(),
    format: z.string().optional(),
    delivery: z.string().optional(),
    methodologyDescription: z.string().optional(),
    methodologyPhases: z.array(z.object({
      title: z.string(),
      description: z.string(),
    })).optional(),
    order: z.number().default(0),
    pubDate: z.coerce.date().optional(),
    image: coverImageSchema({ image }).optional(),
  }).strict()
});

const tags = defineCollection({
  loader: glob({
    base: './src/content/tags',
    pattern: '**/*.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, '').replace(/\.(md|mdx)$/, '')
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
  }).strict(),
});

const characters = defineCollection({
  loader: glob({
    base: './src/content/characters',
    pattern: '**/index.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, '')
  }),
  schema: ({ image }) => z.object({
    name: z.string(),
    role: z.string(),
    canonicalPrompt: z.string(),
    appearance: z.object({
      hair: z.string(),
      eyes: z.string(),
      facialHair: z.string().optional(),
      build: z.string().optional(),
      glasses: z.boolean().default(false),
    }).optional(),
    referenceImage: image(),
    variants: z.array(z.object({
      name: z.string(),
      image: image(),
      promptSnippet: z.string(),
    })).default([]),
    environments: z.array(reference('environments')).default([]),
    objects: z.array(reference('objects')).default([]),
    tags: z.array(z.string()).default([]),
  }),
});

const objects = defineCollection({
  loader: glob({
    base: './src/content/objects',
    pattern: '**/index.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, '')
  }),
  schema: ({ image }) => z.object({
    name: z.string(),
    category: z.string(),
    canonicalPrompt: z.string(),
    referenceImage: image(),
    geometry: z.object({
      form: z.string(),
      materials: z.string(),
      colors: z.array(z.string()).default([]),
    }).optional(),
    variants: z.array(z.object({
      name: z.string(),
      image: image(),
      promptSnippet: z.string(),
    })).default([]),
    environments: z.array(reference('environments')).default([]),
    characters: z.array(reference('characters')).default([]),
    tags: z.array(z.string()).default([]),
  }),
});

const environments = defineCollection({
  loader: glob({
    base: './src/content/environments',
    pattern: '**/index.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, '')
  }),
  schema: ({ image }) => z.object({
    name: z.string(),
    category: z.string(),
    canonicalPrompt: z.string(),
    referenceImage: image(),
    dna: z.object({
      architecture: z.string(),
      materials: z.object({
        walls: z.string(),
        ceiling: z.string(),
        flooring: z.string(),
      }),
      lighting: z.string(),
      palette: z.array(z.string()).default([]),
      view: z.string().optional(),
    }).optional(),
    variants: z.array(z.object({
      name: z.string(),
      image: image(),
      shotType: z.enum(['three-quarters', 'wide-angle', 'close-up', 'over-the-shoulder', 'top-down', 'eye-level']).default('eye-level'),
      cameraAngle: z.string().optional(),
      focalTarget: z.string().optional(),
      maxCharacters: z.number().int().min(0).optional(),
      characterSlots: z.array(z.object({
        id: z.string(),
        role: z.string().optional(),
        priority: z.number().int().default(1),
        required: z.boolean().default(false),
        spatialPlacement: z.string(),
        allowedPoses: z.array(z.string()).default([]),
        prohibitedPoses: z.array(z.string()).default([]),
        defaultAction: z.string().optional(),
        cutline: z.string().optional(),
      })).default([]),
      visibleObjects: z.array(reference('objects')).default([]),
      depthLayers: z.object({
        foreground: z.string(),
        midground: z.string(),
        background: z.string(),
      }).optional(),
      promptSnippet: z.string(),
    })).default([]),
    characters: z.array(reference('characters')).default([]),
    objects: z.array(reference('objects')).default([]),
    tags: z.array(z.string()).default([]),
  }),
});


const presentations = defineCollection({
  loader: glob({
    base: './src/content/presentations',
    pattern: '*/index.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, '')
  }),
  schema: ({ image }) => z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    pubDate: z.coerce.date(),
    audience: z.string().optional(),
    inLanguage: z.enum(['de', 'en']).default('de'),
    description: z.string().optional(),
    tags: z.array(tagReference).default([]),
    image: coverImageSchema({ image }),
  }).strict(),
});



const slides = defineCollection({
  loader: glob({
    base: './src/content/presentations',
    pattern: '*/slides/*.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\.(md|mdx)$/, '')
  }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    number: z.string().optional(),
    slideLayout: z.string().default('custom'),
    voiceover: z.string().default(''),
    notes: z.string().default(''),
    references: z.array(slideReferenceSchema).default([]),
    durationSec: z.number().optional(),
  }).strict(),
});

const newsletters = defineCollection({
  loader: glob({
    base: './src/content/newsletters',
    pattern: '*/index.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, '')
  }),
  schema: ({ image }) => z.object({
    issueNumber: z.number().int().positive(),
    title: z.string(),
    subtitle: z.string().optional(),
    description: z.string(),
    pubDate: z.coerce.date(),
    image: coverImageSchema({ image }),
    tags: z.array(tagReference).default([]),
    featuredPosts: z.array(reference('posts')).default([]),
    featuredPresentations: z.array(reference('presentations')).default([]),
    featuredPublications: z.array(reference('publications')).default([]),
    featuredCourses: z.array(reference('courses')).default([]),
    featuredProjects: z.array(reference('projects')).default([]),
    featuredVisualizations: z.array(reference('visualizations')).default([]),
  }).strict(),
});

export const collections = {
  'posts': posts,
  'publications': publications,
  'visualizations': visualizations,
  'experiences': experiences,
  'degrees': degrees,
  'profiles': profiles,
  'projects': projects,
  'courses': courses,
  'course-modules': courseModules,
  'services': services,
  'service-modules': serviceModules,
  'tags': tags,
  'characters': characters,
  'objects': objects,
  'environments': environments,
  'presentations': presentations,
  'slides': slides,
  'newsletters': newsletters,
};




