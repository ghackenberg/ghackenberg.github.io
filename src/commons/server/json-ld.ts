import { DOMAIN_METADATA, CONTENT_DOMAINS, type ContentDomain } from '@commons/shared/domain-themes';
import type { CollectionEntry } from 'astro:content';

export const PERSON_ID = 'https://hackenberg.tech/#person';
export const WEBSITE_ID = 'https://hackenberg.tech/#website';
export const NAVIGATION_ID = 'https://hackenberg.tech/#navigation';

export const PERSON_REF = { '@id': PERSON_ID };
export const WEBSITE_REF = { '@id': WEBSITE_ID };

export const OFFICIAL_ORG_LABELS: Record<string, { name: string; isEducational?: boolean }> = {
  'https://www.wikidata.org/wiki/Q1388312': { name: 'University of Applied Sciences Upper Austria', isEducational: true },
  'https://www.wikidata.org/wiki/Q157808': { name: 'Technical University of Munich', isEducational: true },
  'https://www.wikidata.org/wiki/Q273263': { name: 'RWTH Aachen University', isEducational: true },
  'https://www.wikidata.org/wiki/Q317070': { name: 'University of Mannheim', isEducational: true },
  'https://www.wikidata.org/wiki/Q2145077': { name: 'Reply' },
  'https://www.wikidata.org/wiki/Q262760': { name: 'EPFL', isEducational: true },
  'https://www.wikidata.org/wiki/Q1451984': { name: 'Fraunhofer FIT' },
  'https://www.wikidata.org/wiki/Q81230': { name: 'Siemens' }
};

export function buildTagAboutRefs(tags?: string[]) {
  return tags?.length ? tags.map((t) => ({ '@id': `https://hackenberg.tech/tags/${t}/#term` })) : undefined;
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
  items: Array<CollectionItem | string>
) {
  const meta = DOMAIN_METADATA[domain];
  const url = `https://hackenberg.tech/${domain}/`;
  const id = `https://hackenberg.tech/${domain}/#collectionpage`;

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
          : `https://hackenberg.tech/${domain}/${rawId}/`;
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
}) {
  const { degrees, experiences } = params;
  const sortedDegrees = degrees.slice().sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const activeExperiences = experiences
    .filter((e) => e.data.endYear === null)
    .sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));

  const orgMap = new Map<string, Record<string, string | undefined>>();

  for (const d of sortedDegrees) {
    const id = d.data.institutionId;
    if (id && !orgMap.has(id)) {
      const meta = OFFICIAL_ORG_LABELS[id];
      orgMap.set(id, {
        '@type': meta?.isEducational ? 'EducationalOrganization' : 'Organization',
        '@id': id,
        name: meta?.name || d.data.institution,
        ...(d.data.institutionUrl ? { url: d.data.institutionUrl } : {})
      });
    }
  }

  for (const e of experiences) {
    const id = e.data.organizationId;
    if (id && !orgMap.has(id)) {
      const meta = OFFICIAL_ORG_LABELS[id];
      orgMap.set(id, {
        '@type': meta?.isEducational ? 'EducationalOrganization' : 'Organization',
        '@id': id,
        name: meta?.name || e.data.company,
        ...(e.data.organizationUrl ? { url: e.data.organizationUrl } : {})
      });
    }
  }

  const distinctOrgs = Array.from(orgMap.values());

  const pastOrgIds = new Set<string>();
  for (const d of sortedDegrees) {
    if (d.data.institutionId) pastOrgIds.add(d.data.institutionId);
  }
  for (const e of experiences) {
    if (e.data.endYear !== null && e.data.organizationId) {
      pastOrgIds.add(e.data.organizationId);
    }
  }
  const alumniOfList = Array.from(pastOrgIds).map((id) => ({ '@id': id }));

  const personSchema = {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: 'Dr. Georg Hackenberg',
    givenName: 'Georg',
    familyName: 'Hackenberg',
    honorificPrefix: 'Dr.',
    jobTitle: 'Professor for Industrial Informatics',
    url: 'https://hackenberg.tech/',
    worksFor: [
      {
        '@id': 'https://www.wikidata.org/wiki/Q1388312'
      }
    ],
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
      ...(d.data.institutionId
        ? { recognizedBy: { '@id': d.data.institutionId } }
        : {
            recognizedBy: {
              '@type': 'EducationalOrganization',
              name: d.data.institution
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
    sameAs: profiles.map((p) => p.data.url)
  };

  return [contactPageSchema, personSchema];
}

export function buildTagsOverviewSchemas(params: {
  tags: Array<{ id: string }>;
}) {
  const { tags } = params;
  const collectionPageSchema = {
    '@type': 'CollectionPage',
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
          '@id': `https://hackenberg.tech/tags/${tag.id}/#term`
        }
      }))
    }
  };

  const personSchema = {
    '@type': 'Person',
    '@id': PERSON_ID,
    knowsAbout: tags.map((tag) => ({
      '@id': `https://hackenberg.tech/tags/${tag.id}/#term`
    }))
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

  const definedTermSchema = {
    '@type': 'DefinedTerm',
    '@id': `${termUrl}#term`,
    name: tag.data.title,
    description: tag.data.description || `Articles, publications, and projects related to ${tag.data.title}.`,
    inDefinedTermSet: 'https://hackenberg.tech/tags/#collectionpage',
    url: termUrl
  };

  const collectionPageSchema = {
    '@type': 'CollectionPage',
    '@id': `${termUrl}#collectionpage`,
    url: termUrl,
    name: `Topics in ${tag.data.title}`,
    description: tag.data.description || `Browse all resources tagged with ${tag.data.title}.`,
    isPartOf: { '@id': 'https://hackenberg.tech/tags/#collectionpage' },
    about: { '@id': `${termUrl}#term` },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: items.map((item, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        item: {
          '@id': item.url
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
    authors?: string[];
    year?: number;
    venue?: string;
    doi?: string;
    url?: string;
  }>
) {
  if (!references || references.length === 0) return [];
  return references.map((ref) => {
    const doiClean = ref.doi ? ref.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '') : undefined;
    const itemUrl = doiClean ? `https://doi.org/${doiClean}` : ref.url;
    return {
      '@type': 'CreativeWork',
      name: ref.title,
      ...(ref.authors?.length
        ? {
            author: ref.authors.map((a) => {
              const isGeorg = /Georg Hackenberg/i.test(a);
              return isGeorg ? PERSON_REF : { '@type': 'Person', name: a };
            })
          }
        : {}),
      ...(ref.year ? { datePublished: String(ref.year) } : {}),
      ...(ref.venue ? { isPartOf: { '@type': 'Periodical', name: ref.venue } } : {}),
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
  const iconSrc = extractImageSrc(post.data.icon);

  const citations = buildCitationList(post.data.references);

  const blogPostingSchema = {
    '@type': 'BlogPosting',
    '@id': `${postUrl}#article`,
    headline: post.data.title,
    name: post.data.title,
    description: post.data.description,
    url: postUrl,
    inLanguage: post.data.lang || 'de',
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
    image: iconSrc ? new URL(iconSrc, siteUrl).href : undefined,
    mainEntityOfPage: {
      '@id': postUrl
    }
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
  const iconSrc = typeof pub.data.icon === 'object' && pub.data.icon !== null && 'src' in pub.data.icon
    ? (pub.data.icon as { src: string }).src
    : (pub.data.icon as string | undefined);

  const scholarlyArticleSchema = {
    '@type': 'ScholarlyArticle',
    '@id': `${pubUrl}#article`,
    headline: pub.data.title,
    name: pub.data.title,
    url: pubUrl,
    author: pub.data.author.split(/,| and /).map((a) => {
      const trimmed = a.trim();
      const isGeorg = /Georg Hackenberg/i.test(trimmed);
      return isGeorg ? PERSON_REF : { '@type': 'Person', name: trimmed };
    }),
    isPartOf: [
      { '@id': 'https://hackenberg.tech/publications/#collectionpage' },
      ...(pub.data.book ? [{ '@type': 'Periodical', name: pub.data.book }] : [])
    ],
    datePublished: pub.data.pubDate.toISOString(),
    description: cleanAbstract || `${pub.data.title} - Academic publication by ${pub.data.author}.`,
    about: buildTagAboutRefs(pub.data.tags),
    image: iconSrc ? new URL(iconSrc, siteUrl).href : undefined,
    sameAs: pub.data.publisherUrl || undefined,
    mainEntityOfPage: {
      '@id': pubUrl
    }
  };

  return scholarlyArticleSchema;
}

export function buildPresentationSchema(params: {
  presentation: CollectionEntry<'presentations'>;
  slides: Array<{ number: number; title: string; audioUrl?: string; durationSec?: number }>;
  durationInfo: { minutes: number; formatted: string };
  references?: Array<{ id: string; title: string; authors?: string[]; year?: number; venue?: string; doi?: string; url?: string }>;
  siteUrl?: string;
}) {
  const { presentation, slides, durationInfo, references, siteUrl = 'https://hackenberg.tech' } = params;
  const presUrl = `${siteUrl}/presentations/${presentation.id}/`;
  const citations = buildCitationList(references);

  const presentationDocSchema = {
    '@type': 'PresentationDigitalDocument',
    '@id': `${presUrl}#presentation`,
    name: presentation.data.title,
    headline: presentation.data.title,
    description: presentation.data.description,
    url: presUrl,
    datePublished: presentation.data.pubDate.toISOString(),
    inLanguage: presentation.data.lang || 'en',
    timeRequired: `PT${durationInfo.minutes}M`,
    author: PERSON_REF,
    publisher: PERSON_REF,
    isPartOf: {
      '@id': 'https://hackenberg.tech/presentations/#collectionpage'
    },
    about: buildTagAboutRefs(presentation.data.tags),
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
              ...(s.durationSec ? { duration: `PT${Math.round(s.durationSec)}S` } : {})
            }
          }
        : {})
    })),
    ...(citations.length > 0 ? { citation: citations } : {}),
    mainEntityOfPage: {
      '@id': presUrl
    }
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
  const resolvedImage = extractImageSrc(course.data.screenshot);

  const courseSchema = {
    '@type': 'Course',
    '@id': `${courseUrl}#course`,
    name: course.data.title,
    description: course.data.description || `${course.data.title} taught by Dr. Georg Hackenberg.`,
    image: resolvedImage ? new URL(resolvedImage, siteUrl).href : undefined,
    url: courseUrl,
    provider: {
      '@id': 'https://www.wikidata.org/wiki/Q1388312'
    },
    instructor: PERSON_REF,
    isPartOf: {
      '@id': 'https://hackenberg.tech/courses/#collectionpage'
    },
    about: buildTagAboutRefs(course.data.tags),
    ...(modules.length > 0
      ? {
          hasPart: modules.map((m) => ({
            '@id': `${siteUrl}/courses/${course.id}/${m.id.split('/').pop()}/#module`
          }))
        }
      : {}),
    inLanguage: course.data.language,
    educationalCredentialAwarded: 'Academic Course Credit',
    teaches: course.data.learningGoals ? course.data.learningGoals.join(', ') : undefined
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

  const moduleCourseSchema = {
    '@type': 'LearningResource',
    '@id': `${moduleUrl}#module`,
    name: module.data.title,
    description: module.data.description,
    learningResourceType: 'Course Module',
    isPartOf: {
      '@id': `${siteUrl}/courses/${parentCourse.id}/#course`
    },
    about: buildTagAboutRefs(parentCourse.data.tags),
    inLanguage: parentCourse.data.language,
    url: moduleUrl
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
  const tech = project.data.tags?.[0] ?? 'Web';

  const softwareAppSchema = {
    '@type': ['SoftwareApplication', 'SoftwareSourceCode'],
    '@id': `${projectUrl}#software`,
    name: project.data.title,
    headline: project.data.title,
    description: project.data.description,
    image: mainScreenshotUrl ? new URL(mainScreenshotUrl, siteUrl).href : undefined,
    url: projectUrl,
    sameAs: project.data.href,
    applicationCategory: 'Software',
    operatingSystem: 'Cross-platform',
    runtimePlatform: 'Cross-platform',
    programmingLanguage: tech,
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
  modules: Array<CollectionEntry<'modules'>>;
  siteUrl?: string;
}) {
  const { service, modules, siteUrl = 'https://hackenberg.tech' } = params;
  const serviceUrl = `${siteUrl}/services/${service.id}/`;
  const imageSrc = extractImageSrc(service.data.previewImage);

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
    ...(modules.length > 0
      ? {
          hasPart: modules.map((m) => ({
            '@id': `${siteUrl}/services/${service.id}/${m.id.split('/').pop()}/#service`
          }))
        }
      : {})
  };

  return serviceSchema;
}

export function buildServiceModuleSchema(params: {
  parentService: CollectionEntry<'services'>;
  module: CollectionEntry<'modules'>;
  siteUrl?: string;
}) {
  const { parentService, module, siteUrl = 'https://hackenberg.tech' } = params;
  const moduleSlug = module.id.split('/').pop();
  const moduleUrl = `${siteUrl}/services/${parentService.id}/${moduleSlug}/`;

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
    about: buildTagAboutRefs(parentService.data.tags)
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

  const newsletterSchema = {
    '@type': 'Article',
    '@id': `${issueUrl}#article`,
    headline: issue.data.title,
    name: issue.data.title,
    description: issue.data.description,
    url: issueUrl,
    datePublished: issue.data.pubDate.toISOString(),
    author: PERSON_REF,
    publisher: PERSON_REF,
    isPartOf: {
      '@id': 'https://hackenberg.tech/newsletters/#collectionpage'
    },
    about: buildTagAboutRefs(issue.data.tags),
    mainEntityOfPage: {
      '@id': issueUrl
    },
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

  const vizSchema = {
    '@type': ['SoftwareApplication', 'WebApplication'],
    '@id': `${vizUrl}#application`,
    name: visualization.data.title,
    headline: visualization.data.title,
    description: visualization.data.description,
    url: vizUrl,
    applicationCategory: 'DataVisualization',
    author: PERSON_REF,
    creator: PERSON_REF,
    isPartOf: {
      '@id': 'https://hackenberg.tech/visualizations/#collectionpage'
    },
    about: buildTagAboutRefs(visualization.data.tags),
    mainEntityOfPage: {
      '@id': vizUrl
    }
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
