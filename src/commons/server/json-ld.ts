import fs from 'node:fs';
import path from 'node:path';
import { DOMAIN_METADATA, CONTENT_DOMAINS, type ContentDomain } from '@commons/shared/domain-themes';
import type { CollectionEntry } from 'astro:content';
import type { AuthorEntry } from '@commons/shared/authors';

export const PERSON_ID = 'https://hackenberg.tech/#person';
export const WEBSITE_ID = 'https://hackenberg.tech/#website';
export const NAVIGATION_ID = 'https://hackenberg.tech/#navigation';

export const PERSON_REF = {
  '@type': 'Person',
  '@id': PERSON_ID,
  name: 'Dr. Georg Hackenberg',
  url: 'https://hackenberg.tech/about/'
};

export const WEBSITE_REF = {
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  name: 'Dr. Georg Hackenberg',
  url: 'https://hackenberg.tech/'
};

export const FH_OOW_REF = {
  '@type': 'EducationalOrganization',
  '@id': 'https://www.wikidata.org/wiki/Q1388312',
  name: 'University of Applied Sciences Upper Austria',
  sameAs: 'https://www.fh-ooe.at/'
};

export type JsonLdPrimitive = string | number | boolean | null | undefined;
export type JsonLdValue = JsonLdPrimitive | { [key: string]: JsonLdValue } | JsonLdValue[];
export type JsonLdNode = Record<string, JsonLdValue>;

export const OFFICIAL_ORG_LABELS: Record<string, { name: string; isEducational?: boolean; sameAs?: string }> = {
  'https://www.wikidata.org/wiki/Q1388312': {
    name: 'University of Applied Sciences Upper Austria',
    isEducational: true,
    sameAs: 'https://www.fh-ooe.at/'
  },
  'https://www.wikidata.org/wiki/Q157808': { name: 'Technical University of Munich', isEducational: true },
  'https://www.wikidata.org/wiki/Q273263': { name: 'RWTH Aachen University', isEducational: true },
  'https://www.wikidata.org/wiki/Q317070': { name: 'University of Mannheim', isEducational: true },
  'https://www.wikidata.org/wiki/Q2145077': { name: 'Reply' },
  'https://www.wikidata.org/wiki/Q262760': { name: 'EPFL', isEducational: true },
  'https://www.wikidata.org/wiki/Q1451984': { name: 'Fraunhofer FIT' },
  'https://www.wikidata.org/wiki/Q81230': { name: 'Siemens' }
};

let tagTitleCache: Map<string, string> | null = null;

function getTagTitle(tagId: string): string {
  if (!tagTitleCache) {
    tagTitleCache = new Map<string, string>();
    try {
      const tagsDir = path.resolve(process.cwd(), 'src/content/tags');
      if (fs.existsSync(tagsDir)) {
        for (const file of fs.readdirSync(tagsDir)) {
          if (!file.endsWith('.md')) continue;
          const id = file.replace(/\.md$/, '');
          const raw = fs.readFileSync(path.join(tagsDir, file), 'utf-8');
          const match = raw.match(/^title:\s*(?:"([^"]+)"|'([^']+)'|([^\r\n]+))/m);
          if (match) {
            const title = (match[1] ?? match[2] ?? match[3] ?? '').trim();
            if (title) tagTitleCache.set(id, title);
          }
        }
      }
    } catch {
      // Fallback if filesystem is unavailable
    }
  }
  return tagTitleCache.get(tagId) || tagId;
}

export function getCanonicalEntityId(domain: string, slug: string, siteUrl = 'https://hackenberg.tech'): string {
  const cleanSlug = slug.replace(/^\/|\/$/g, '');
  const url = `${siteUrl}/${domain}/${cleanSlug}/`;
  switch (domain) {
    case 'posts':
    case 'publications':
    case 'newsletters':
      return `${url}#article`;
    case 'presentations':
      return `${url}#presentation`;
    case 'courses':
      return `${url}#course`;
    case 'course-modules':
      return `${url}#module`;
    case 'projects':
      return `${url}#software`;
    case 'services':
    case 'modules':
      return `${url}#service`;
    case 'visualizations':
      return `${url}#application`;
    case 'tags':
      return `${url}#term`;
    default:
      return `${url}#webpage`;
  }
}

export function buildTagAboutRefs(tags?: string[]) {
  return tags?.length
    ? tags.map((t) => ({
        '@type': 'DefinedTerm',
        '@id': `https://hackenberg.tech/tags/${t}/#term`,
        name: getTagTitle(t),
        url: `https://hackenberg.tech/tags/${t}/`
      }))
    : undefined;
}

export function buildWebsiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: 'https://hackenberg.tech/',
    name: 'Dr. Georg Hackenberg',
    description: 'Personal website of Dr. Georg Hackenberg, Full Professor for Industrial Informatics, software engineer, digital entrepreneur, and researcher.',
    publisher: PERSON_REF
  };
}

export function buildNavigationSchema() {
  return {
    '@type': 'ItemList',
    '@id': NAVIGATION_ID,
    name: 'Primary Navigation',
    itemListElement: CONTENT_DOMAINS.map((domain, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: DOMAIN_METADATA[domain].label,
      url: `https://hackenberg.tech/${domain}/`
    }))
  };
}

export interface CollectionItem {
  id: string;
}

export function buildCollectionPageSchema(
  domain: ContentDomain,
  items: Array<CollectionItem | string>,
  siteUrl = 'https://hackenberg.tech'
) {
  const meta = DOMAIN_METADATA[domain];
  const url = `${siteUrl}/${domain}/`;
  const id = `${siteUrl}/${domain}/#collectionpage`;

  return {
    '@type': 'CollectionPage',
    '@id': id,
    url,
    name: meta.label,
    description: meta.navDescription || meta.label,
    isPartOf: WEBSITE_REF,
    author: PERSON_REF,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: items.map((item, idx) => {
        const rawId = typeof item === 'string' ? item : item.id;
        const targetId = rawId.startsWith('http')
          ? rawId
          : getCanonicalEntityId(domain, rawId, siteUrl);
        return {
          '@type': 'ListItem',
          position: idx + 1,
          item: {
            '@id': targetId
          }
        };
      })
    }
  };
}

export function buildAboutPageSchemas(params: {
  degrees: Array<CollectionEntry<'degrees'>>;
  experiences: Array<CollectionEntry<'experiences'>>;
  profiles?: Array<CollectionEntry<'profiles'>>;
  imageUrl?: string;
}) {
  const { degrees, experiences, profiles, imageUrl } = params;
  const sortedDegrees = degrees.slice().sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const activeExperiences = experiences
    .filter((e) => e.data.endYear === null)
    .sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const sortedProfiles = profiles
    ? profiles.slice().sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0))
    : [];

  const orgMap = new Map<string, Record<string, string | undefined>>();

  for (const d of sortedDegrees) {
    const org = d.data.organization;
    const id = org?.id;
    if (id && !orgMap.has(id)) {
      const meta = OFFICIAL_ORG_LABELS[id];
      orgMap.set(id, {
        '@type': meta?.isEducational ? 'EducationalOrganization' : 'Organization',
        '@id': id,
        name: meta?.name || org.name,
        ...(meta?.sameAs ? { sameAs: meta.sameAs } : {})
      });
    }
  }

  for (const e of activeExperiences) {
    const org = e.data.organization;
    const id = org?.id;
    if (id && !orgMap.has(id)) {
      const meta = OFFICIAL_ORG_LABELS[id];
      orgMap.set(id, {
        '@type': meta?.isEducational ? 'EducationalOrganization' : 'Organization',
        '@id': id,
        name: meta?.name || org.name,
        ...(meta?.sameAs ? { sameAs: meta.sameAs } : {})
      });
    }
  }

  const distinctOrgs = Array.from(orgMap.values());

  const pastOrgIds = new Set<string>();
  for (const d of sortedDegrees) {
    if (d.data.organization?.id) pastOrgIds.add(d.data.organization.id);
  }
  const alumniOfList = Array.from(pastOrgIds).map((id) => orgMap.get(id) ?? { '@id': id });

  const worksForOrgs = Array.from(
    new Map(
      activeExperiences
        .filter((e) => e.data.organization?.id)
        .map((e) => {
          const id = e.data.organization!.id!;
          return [id, orgMap.get(id) ?? { '@id': id }];
        })
    ).values()
  );

  const personSchema = {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: 'Dr. Georg Hackenberg',
    givenName: 'Georg',
    familyName: 'Hackenberg',
    honorificPrefix: 'Dr.',
    jobTitle: 'Professor for Industrial Informatics',
    description:
      'Full Professor for Industrial Informatics at FH OÖ Campus Wels, software engineer, digital entrepreneur, and researcher.',
    url: 'https://hackenberg.tech/about/',
    ...(imageUrl ? { image: imageUrl } : {}),
    email: 'mailto:mail@georghackenberg.com',
    telephone: '+43 50804 43250',
    workLocation: {
      '@type': 'Place',
      name: 'University of Applied Sciences Upper Austria (FH OÖ Campus Wels)',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Stelzhamerstraße 23',
        addressLocality: 'Wels',
        postalCode: '4600',
        addressCountry: 'AT'
      }
    },
    ...(sortedProfiles.length > 0 ? { sameAs: sortedProfiles.map((p) => p.data.url) } : {}),
    worksFor: worksForOrgs,
    hasOccupation: activeExperiences.map((e) => ({
      '@type': 'Occupation',
      name: e.data.title,
      ...(e.data.occupationalCategory ? { occupationalCategory: e.data.occupationalCategory } : {})
    })),
    alumniOf: alumniOfList,
    hasCredential: sortedDegrees.map((d) => ({
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: 'degree',
      name: `${d.data.degree} in ${d.data.program}`,
      ...(d.data.organization?.id
        ? { recognizedBy: orgMap.get(d.data.organization.id) ?? { '@id': d.data.organization.id } }
        : {
            recognizedBy: {
              '@type': 'EducationalOrganization',
              name: d.data.organization.name
            }
          })
    }))
  };

  const profilePageSchema = {
    '@type': 'ProfilePage',
    '@id': 'https://hackenberg.tech/about/#profilepage',
    url: 'https://hackenberg.tech/about/',
    name: 'About Dr. Georg Hackenberg',
    isPartOf: WEBSITE_REF,
    mainEntity: PERSON_REF
  };

  return [profilePageSchema, personSchema, ...distinctOrgs];
}

export function buildContactPageSchemas(params: {
  profiles: Array<CollectionEntry<'profiles'>>;
}) {
  const { profiles } = params;
  const sortedProfiles = profiles.slice().sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const contactPageSchema = {
    '@type': 'ContactPage',
    '@id': 'https://hackenberg.tech/contact/#contactpage',
    url: 'https://hackenberg.tech/contact/',
    name: 'Contact Dr. Georg Hackenberg',
    isPartOf: WEBSITE_REF,
    mainEntity: PERSON_REF
  };

  const personSchema = {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: 'Dr. Georg Hackenberg',
    url: 'https://hackenberg.tech/about/',
    email: 'mailto:mail@georghackenberg.com',
    telephone: '+43 50804 43250',
    workLocation: {
      '@type': 'Place',
      name: 'University of Applied Sciences Upper Austria (FH OÖ Campus Wels)',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Stelzhamerstraße 23',
        addressLocality: 'Wels',
        postalCode: '4600',
        addressCountry: 'AT'
      }
    },
    sameAs: sortedProfiles.map((p) => p.data.url)
  };

  return [contactPageSchema, personSchema];
}

export function buildTagsOverviewSchemas(params: {
  tags: Array<{ id: string }>;
}) {
  const { tags } = params;
  const collectionPageSchema = {
    '@type': ['CollectionPage', 'DefinedTermSet'],
    '@id': 'https://hackenberg.tech/tags/#collectionpage',
    url: 'https://hackenberg.tech/tags/',
    name: 'Taxonomy & Topic Cloud',
    description: 'Explore topics, skills, technologies, and concepts across computer science, engineering, and digital systems.',
    isPartOf: WEBSITE_REF,
    author: PERSON_REF,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: tags.map((tag, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        item: {
          '@type': 'DefinedTerm',
          '@id': `https://hackenberg.tech/tags/${tag.id}/#term`,
          name: getTagTitle(tag.id),
          url: `https://hackenberg.tech/tags/${tag.id}/`
        }
      }))
    }
  };

  const personSchema = {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: 'Dr. Georg Hackenberg',
    url: 'https://hackenberg.tech/about/',
    knowsAbout: buildTagAboutRefs(tags.map((t) => t.id))
  };

  return [collectionPageSchema, personSchema];
}

interface NestedImageLike {
  src?: string | { src?: string };
}

function extractImageSrc(image?: string | NestedImageLike | null): string | undefined {
  if (!image) return undefined;
  if (typeof image === 'string') return image;
  if (typeof image === 'object' && 'src' in image) {
    const src = image.src;
    if (typeof src === 'string') return src;
    if (typeof src === 'object' && src !== null && 'src' in src && typeof src.src === 'string') {
      return src.src;
    }
  }
  return undefined;
}

export function buildTagDetailSchemas(params: {
  tag: CollectionEntry<'tags'>;
  items: Array<{ id: string; url: string; title: string }>;
}) {
  const { tag, items } = params;
  const termUrl = `https://hackenberg.tech/tags/${tag.id}/`;
  const definedTermSetRef = {
    '@type': ['CollectionPage', 'DefinedTermSet'],
    '@id': 'https://hackenberg.tech/tags/#collectionpage',
    name: 'Taxonomy & Topic Cloud',
    url: 'https://hackenberg.tech/tags/'
  };

  const definedTermSchema = {
    '@type': 'DefinedTerm',
    '@id': `${termUrl}#term`,
    name: tag.data.title,
    description: tag.data.description || `Articles, publications, and projects related to ${tag.data.title}.`,
    inDefinedTermSet: definedTermSetRef,
    url: termUrl
  };

  const collectionPageSchema = {
    '@type': 'CollectionPage',
    '@id': `${termUrl}#collectionpage`,
    url: termUrl,
    name: `Topics in ${tag.data.title}`,
    description: tag.data.description || `Browse all resources tagged with ${tag.data.title}.`,
    isPartOf: definedTermSetRef,
    about: {
      '@type': 'DefinedTerm',
      '@id': `${termUrl}#term`,
      name: tag.data.title,
      url: termUrl
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: items.map((item, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        item: {
          '@id': item.id,
          name: item.title,
          url: item.url
        }
      }))
    }
  };

  return [definedTermSchema, collectionPageSchema];
}

export function buildCitationList(
  references?: Array<{
    id: string;
    title: string;
    authors?: Array<string | AuthorEntry>;
    author?: string;
    year?: number;
    venue?: string;
    booktitle?: string;
    journal?: string;
    publisher?: string;
    doi?: string;
    url?: string;
    isbn?: string;
  }>
) {
  if (!references || references.length === 0) return [];
  return references.map((ref) => {
    const doiClean = ref.doi ? ref.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '') : undefined;
    const itemUrl = doiClean ? `https://doi.org/${doiClean}` : ref.url;

    let schemaType = 'CreativeWork';
    if (ref.journal || ref.booktitle || ref.venue || ref.doi) {
      schemaType = 'ScholarlyArticle';
    } else if (ref.isbn || (ref.publisher && !ref.url)) {
      schemaType = 'Book';
    } else if (ref.url && (!ref.authors || ref.authors.length === 0)) {
      schemaType = 'WebPage';
    }

    let authorList: Array<JsonLdNode> = [];
    if (ref.authors && Array.isArray(ref.authors) && ref.authors.length > 0) {
      authorList = ref.authors.map((a) => {
        if (typeof a === 'string') {
          const trimmed = a.trim();
          const isGeorg = /Georg Hackenberg/i.test(trimmed);
          return isGeorg ? PERSON_REF : { '@type': 'Person', name: trimmed };
        }
        if (a && typeof a === 'object') {
          const isGeorg =
            a.id === PERSON_ID ||
            a.id === 'https://orcid.org/0000-0002-0096-2484' ||
            /Georg Hackenberg/i.test(a.name);
          if (isGeorg) return PERSON_REF;
          const authorType = a.type || 'Person';
          return {
            '@type': authorType,
            name: a.name,
            ...(a.id ? { sameAs: a.id } : {})
          };
        }
        return { '@type': 'Person', name: String(a) };
      });
    }

    const venueName = ref.venue || ref.booktitle || ref.journal;

    return {
      '@type': schemaType,
      name: ref.title,
      ...(authorList.length > 0 ? { author: authorList } : {}),
      ...(ref.year ? { datePublished: String(ref.year) } : {}),
      ...(venueName ? { isPartOf: { '@type': 'Periodical', name: venueName } } : {}),
      ...(ref.publisher ? { publisher: { '@type': 'Organization', name: ref.publisher } } : {}),
      ...(ref.isbn ? { isbn: ref.isbn } : {}),
      ...(itemUrl ? { url: itemUrl } : {})
    };
  });
}

export function buildPostSchema(params: {
  post: CollectionEntry<'posts'>;
  readingTime: { minutes: number; words: number };
  siteUrl?: string;
}) {
  const { post, readingTime, siteUrl = 'https://hackenberg.tech' } = params;
  const postUrl = `${siteUrl}/posts/${post.id}/`;
  const iconSrc = extractImageSrc(post.data.image);

  const citations = buildCitationList(post.data.references);

  const blogPostingSchema = {
    '@type': 'BlogPosting',
    '@id': `${postUrl}#article`,
    headline: post.data.title,
    name: post.data.title,
    description: post.data.description,
    url: postUrl,
    inLanguage: post.data.inLanguage || 'de',
    timeRequired: `PT${readingTime.minutes}M`,
    wordCount: readingTime.words,
    datePublished: post.data.pubDate.toISOString(),
    author: PERSON_REF,
    publisher: PERSON_REF,
    isPartOf: {
      '@id': 'https://hackenberg.tech/posts/#collectionpage'
    },
    about: buildTagAboutRefs(post.data.tags),
    ...(citations.length > 0 ? { citation: citations } : {}),
    image: iconSrc ? new URL(iconSrc, siteUrl).href : undefined
  };

  return blogPostingSchema;
}

export function buildPublicationSchema(params: {
  pub: CollectionEntry<'publications'>;
  siteUrl?: string;
}) {
  const { pub, siteUrl = 'https://hackenberg.tech' } = params;
  const pubUrl = `${siteUrl}/publications/${pub.id}/`;
  const cleanAbstract = pub.data.abstract ? pub.data.abstract.replace(/\s+/g, ' ').trim() : '';
  const imageSrc = extractImageSrc(pub.data.image);

  const mappedAuthors = pub.data.authors.map((a) => {
    const isGeorg =
      a.id === PERSON_ID ||
      /Georg Hackenberg/i.test(a.name);
    if (isGeorg) return PERSON_REF;
    return {
      '@type': a.type || 'Person',
      name: a.name,
      ...(a.id ? { sameAs: a.id } : {})
    };
  });

  const authorPlain = pub.data.authors.map((a) => a.name).join(', ');

  const sameAsList: string[] = [];
  if (pub.data.publisherUrl) sameAsList.push(pub.data.publisherUrl);
  // Publication doi from schema
  const pubEntry = pub.data as { doi?: string };
  if (pubEntry.doi) sameAsList.push(`https://doi.org/${pubEntry.doi}`);

  const scholarlyArticleSchema: JsonLdNode = {
    '@type': 'ScholarlyArticle',
    '@id': `${pubUrl}#article`,
    headline: pub.data.title,
    name: pub.data.title,
    url: pubUrl,
    inLanguage: 'en',
    author: mappedAuthors,
    publisher: PERSON_REF,
    isPartOf: [
      { '@id': 'https://hackenberg.tech/publications/#collectionpage' },
      ...(pub.data.book ? [{ '@type': 'Periodical', name: pub.data.book }] : [])
    ],
    datePublished: pub.data.pubDate.toISOString(),
    description: cleanAbstract || `${pub.data.title} - Academic publication by ${authorPlain}.`,
    about: buildTagAboutRefs(pub.data.tags),
    image: imageSrc ? new URL(imageSrc, siteUrl).href : undefined,
    ...(sameAsList.length === 1 ? { sameAs: sameAsList[0] } : sameAsList.length > 1 ? { sameAs: sameAsList } : {})
  };

  return scholarlyArticleSchema;
}

export function buildPresentationSchema(params: {
  presentation: CollectionEntry<'presentations'>;
  slides: Array<{ number: number; title: string; audioUrl?: string; durationSec?: number; transcript?: string }>;
  durationInfo: { minutes: number; formatted: string };
  references?: Array<{ id: string; title: string; authors?: Array<string | AuthorEntry>; year?: number; venue?: string; doi?: string; url?: string }>;
  siteUrl?: string;
}) {
  const { presentation, slides, durationInfo, references, siteUrl = 'https://hackenberg.tech' } = params;
  const presUrl = `${siteUrl}/presentations/${presentation.id}/`;
  const citations = buildCitationList(references);
  const imageSrc = extractImageSrc(presentation.data.image);

  const presentationDocSchema = {
    '@type': 'PresentationDigitalDocument',
    '@id': `${presUrl}#presentation`,
    name: presentation.data.title,
    headline: presentation.data.title,
    ...(presentation.data.subtitle ? { alternativeHeadline: presentation.data.subtitle } : {}),
    description: presentation.data.description,
    url: presUrl,
    datePublished: presentation.data.pubDate.toISOString(),
    inLanguage: presentation.data.inLanguage || 'en',
    timeRequired: `PT${durationInfo.minutes}M`,
    author: PERSON_REF,
    publisher: PERSON_REF,
    isPartOf: {
      '@id': 'https://hackenberg.tech/presentations/#collectionpage'
    },
    about: buildTagAboutRefs(presentation.data.tags),
    ...(imageSrc ? { image: new URL(imageSrc, siteUrl).href } : {}),
    ...(presentation.data.audience ? { audience: { '@type': 'Audience', audienceType: presentation.data.audience } } : {}),
    encoding: [
      {
        '@type': 'MediaObject',
        '@id': `${presUrl}#pdf-dark`,
        contentUrl: `${presUrl}slides-dark.pdf`,
        encodingFormat: 'application/pdf',
        name: `${presentation.data.title} (Dark Theme PDF)`
      },
      {
        '@type': 'MediaObject',
        '@id': `${presUrl}#pdf-light`,
        contentUrl: `${presUrl}slides-light.pdf`,
        encodingFormat: 'application/pdf',
        name: `${presentation.data.title} (Light Theme PDF)`
      }
    ],
    hasPart: slides.map((s) => ({
      '@type': 'CreativeWork',
      '@id': `${presUrl}#slide-${s.number}`,
      name: s.title,
      position: s.number,
      ...(s.audioUrl
        ? {
            audio: {
              '@type': 'AudioObject',
              '@id': `${presUrl}#audio-slide-${s.number}`,
              contentUrl: `${siteUrl}${s.audioUrl}`,
              encodingFormat: 'audio/mpeg',
              ...(s.durationSec ? { duration: `PT${Math.round(s.durationSec)}S` } : {}),
              ...(s.transcript ? { transcript: s.transcript } : {})
            }
          }
        : {})
    })),
    ...(citations.length > 0 ? { citation: citations } : {})
  };

  return presentationDocSchema;
}

export function buildCourseSchema(params: {
  course: CollectionEntry<'courses'>;
  modules: Array<CollectionEntry<'course-modules'>>;
  siteUrl?: string;
}) {
  const { course, modules, siteUrl = 'https://hackenberg.tech' } = params;
  const courseUrl = `${siteUrl}/courses/${course.id}/`;
  const resolvedImage = extractImageSrc(course.data.image);

  const courseSchema = {
    '@type': 'Course',
    '@id': `${courseUrl}#course`,
    name: course.data.title,
    description: course.data.description || `${course.data.title} taught by Dr. Georg Hackenberg.`,
    image: resolvedImage ? new URL(resolvedImage, siteUrl).href : undefined,
    url: courseUrl,
    provider: FH_OOW_REF,
    instructor: PERSON_REF,
    isPartOf: {
      '@id': 'https://hackenberg.tech/courses/#collectionpage'
    },
    about: buildTagAboutRefs(course.data.tags),
    ...(modules.length > 0
      ? {
          hasPart: modules.map((m) => {
            const modSlug = m.id.split('/').pop();
            const modUrl = `${siteUrl}/courses/${course.id}/${modSlug}/`;
            return {
              '@type': 'LearningResource',
              '@id': `${modUrl}#module`,
              name: m.data.title,
              url: modUrl
            };
          })
        }
      : {}),
    inLanguage: course.data.inLanguage,
    educationalCredentialAwarded: 'Academic Course Credit',
    teaches: course.data.learningGoals ? course.data.learningGoals.join(', ') : undefined,
    ...(course.data.prerequisites && course.data.prerequisites.length > 0
      ? { coursePrerequisites: course.data.prerequisites.join(', ') }
      : {}),
    ...(course.data.targetAudience
      ? { audience: { '@type': 'Audience', audienceType: course.data.targetAudience } }
      : {}),
    ...(course.data.terms && course.data.terms.length > 0
      ? {
          hasCourseInstance: course.data.terms.map((term) => ({
            '@type': 'CourseInstance',
            name: term,
            courseMode: 'onsite'
          }))
        }
      : {})
  };

  return courseSchema;
}

export function buildCourseModuleSchema(params: {
  parentCourse: CollectionEntry<'courses'>;
  module: CollectionEntry<'course-modules'>;
  siteUrl?: string;
}) {
  const { parentCourse, module, siteUrl = 'https://hackenberg.tech' } = params;
  const moduleSlug = module.id.split('/').pop();
  const moduleUrl = `${siteUrl}/courses/${parentCourse.id}/${moduleSlug}/`;
  const resolvedImage = extractImageSrc(module.data.image || parentCourse.data.image);

  const moduleCourseSchema = {
    '@type': 'LearningResource',
    '@id': `${moduleUrl}#module`,
    name: module.data.title,
    description: module.data.description,
    learningResourceType: 'Course Module',
    position: module.data.order,
    ...(module.data.competencies && module.data.competencies.length > 0
      ? { teaches: module.data.competencies.join(', ') }
      : {}),
    ...(module.data.topics && module.data.topics.length > 0
      ? { keywords: module.data.topics.join(', ') }
      : {}),
    isPartOf: {
      '@id': `${siteUrl}/courses/${parentCourse.id}/#course`
    },
    about: buildTagAboutRefs(parentCourse.data.tags),
    inLanguage: parentCourse.data.inLanguage,
    url: moduleUrl,
    ...(resolvedImage ? { image: new URL(resolvedImage, siteUrl).href } : {})
  };

  return moduleCourseSchema;
}

export function buildProjectSchema(params: {
  project: CollectionEntry<'projects'>;
  mainScreenshotUrl?: string;
  siteUrl?: string;
}) {
  const { project, mainScreenshotUrl, siteUrl = 'https://hackenberg.tech' } = params;
  const projectUrl = `${siteUrl}/projects/${project.id}/`;
  const repoName = project.data.repoName;
  const repoUrl = repoName ? `https://github.com/ghackenberg/${repoName}` : undefined;
  const resolvedImage = mainScreenshotUrl || extractImageSrc(project.data.image);

  const softwareAppSchema = {
    '@type': ['SoftwareApplication', 'SoftwareSourceCode'],
    '@id': `${projectUrl}#software`,
    name: project.data.title,
    headline: project.data.title,
    description: project.data.description,
    image: resolvedImage ? new URL(resolvedImage, siteUrl).href : undefined,
    url: projectUrl,
    sameAs: project.data.href,
    applicationCategory: 'Software',
    operatingSystem: 'Cross-platform',
    runtimePlatform: 'Cross-platform',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR'
    },
    ...((project.data as { features?: Array<{ title: string }> }).features &&
    (project.data as { features?: Array<{ title: string }> }).features!.length > 0
      ? {
          featureList: (project.data as { features?: Array<{ title: string }> })
            .features!.map((f) => f.title)
            .join(', ')
        }
      : {}),
    author: PERSON_REF,
    creator: PERSON_REF,
    isPartOf: {
      '@id': 'https://hackenberg.tech/projects/#collectionpage'
    },
    about: buildTagAboutRefs(project.data.tags),
    codeRepository: repoUrl
  };

  return softwareAppSchema;
}

export function buildServiceSchema(params: {
  service: CollectionEntry<'services'>;
  modules: Array<CollectionEntry<'service-modules'>>;
  siteUrl?: string;
}) {
  const { service, modules, siteUrl = 'https://hackenberg.tech' } = params;
  const serviceUrl = `${siteUrl}/services/${service.id}/`;
  const imageSrc = extractImageSrc(service.data.image);

  const serviceSchema = {
    '@type': 'Service',
    '@id': `${serviceUrl}#service`,
    name: service.data.title,
    serviceType: service.data.title,
    description: service.data.description,
    image: imageSrc ? new URL(imageSrc, siteUrl).href : undefined,
    url: serviceUrl,
    provider: PERSON_REF,
    isPartOf: {
      '@id': 'https://hackenberg.tech/services/#collectionpage'
    },
    about: buildTagAboutRefs(service.data.tags),
    ...(service.data.targetAudience && service.data.targetAudience.length > 0
      ? { audience: { '@type': 'Audience', audienceType: service.data.targetAudience.join(', ') } }
      : {}),
    ...(service.data.keyOutcomes && service.data.keyOutcomes.length > 0
      ? { serviceOutput: service.data.keyOutcomes.join(', ') }
      : {}),
    ...(modules.length > 0
      ? {
          hasPart: modules.map((m) => {
            const modSlug = m.id.split('/').pop();
            const modUrl = `${siteUrl}/services/${service.id}/${modSlug}/`;
            return {
              '@type': 'Service',
              '@id': `${modUrl}#service`,
              name: m.data.title,
              url: modUrl
            };
          })
        }
      : {})
  };

  return serviceSchema;
}

export function buildServiceModuleSchema(params: {
  parentService: CollectionEntry<'services'>;
  module: CollectionEntry<'service-modules'>;
  siteUrl?: string;
}) {
  const { parentService, module, siteUrl = 'https://hackenberg.tech' } = params;
  const moduleSlug = module.id.split('/').pop();
  const moduleUrl = `${siteUrl}/services/${parentService.id}/${moduleSlug}/`;
  const imageSrc = extractImageSrc(module.data.image || parentService.data.image);

  const serviceModuleSchema = {
    '@type': 'Service',
    '@id': `${moduleUrl}#service`,
    name: module.data.title,
    serviceType: module.data.title,
    description: module.data.description,
    url: moduleUrl,
    provider: PERSON_REF,
    isPartOf: {
      '@id': `${siteUrl}/services/${parentService.id}/#service`
    },
    about: buildTagAboutRefs(parentService.data.tags),
    ...(imageSrc ? { image: new URL(imageSrc, siteUrl).href } : {}),
    ...(parentService.data.targetAudience && parentService.data.targetAudience.length > 0
      ? { audience: { '@type': 'Audience', audienceType: parentService.data.targetAudience.join(', ') } }
      : {}),
    ...(module.data.outputs && module.data.outputs.length > 0
      ? { serviceOutput: module.data.outputs.join(', ') }
      : {})
  };

  return serviceModuleSchema;
}

export function buildNewsletterIssueSchema(params: {
  issue: CollectionEntry<'newsletters'>;
  mentions?: Array<{ '@id': string }>;
  siteUrl?: string;
}) {
  const { issue, mentions, siteUrl = 'https://hackenberg.tech' } = params;
  const issueUrl = `${siteUrl}/newsletters/${issue.id}/`;
  const imageSrc = extractImageSrc(issue.data.image);

  const newsletterSchema = {
    '@type': 'Article',
    '@id': `${issueUrl}#article`,
    headline: issue.data.title,
    name: issue.data.title,
    description: issue.data.description,
    url: issueUrl,
    inLanguage: 'en',
    datePublished: issue.data.pubDate.toISOString(),
    author: PERSON_REF,
    publisher: PERSON_REF,
    isPartOf: {
      '@id': 'https://hackenberg.tech/newsletters/#collectionpage'
    },
    about: buildTagAboutRefs(issue.data.tags),
    ...(imageSrc ? { image: new URL(imageSrc, siteUrl).href } : {}),
    ...(mentions && mentions.length > 0 ? { mentions } : {})
  };

  return newsletterSchema;
}

export function buildVisualizationSchema(params: {
  visualization: CollectionEntry<'visualizations'>;
  siteUrl?: string;
}) {
  const { visualization, siteUrl = 'https://hackenberg.tech' } = params;
  const vizUrl = `${siteUrl}/visualizations/${visualization.id}/`;
  const imageSrc = extractImageSrc(visualization.data.image);

  const vizSchema = {
    '@type': ['SoftwareApplication', 'WebApplication'],
    '@id': `${vizUrl}#application`,
    name: visualization.data.title,
    headline: visualization.data.title,
    description: visualization.data.description,
    url: vizUrl,
    applicationCategory: 'DataVisualization',
    operatingSystem: 'Any modern browser with WebGL',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR'
    },
    author: PERSON_REF,
    creator: PERSON_REF,
    isPartOf: {
      '@id': 'https://hackenberg.tech/visualizations/#collectionpage'
    },
    about: buildTagAboutRefs(visualization.data.tags),
    ...(imageSrc ? { image: new URL(imageSrc, siteUrl).href } : {})
  };

  return vizSchema;
}

export function buildLegalWebPageSchema(params: {
  path: string;
  name: string;
  description: string;
  inLanguage?: string;
}) {
  const { path: pagePath, name, description, inLanguage = 'de' } = params;
  const cleanPath = pagePath.replace(/^\/|\/$/g, '');
  const pageUrl = `https://hackenberg.tech/${cleanPath}/`;

  return {
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name,
    description,
    inLanguage,
    isPartOf: WEBSITE_REF,
    about: PERSON_REF
  };
}
