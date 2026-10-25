import { DOMAIN_METADATA, type ContentDomain } from '@commons/shared/domain-themes';

export const PERSON_ID = 'https://hackenberg.tech/#person';
export const WEBSITE_ID = 'https://hackenberg.tech/#website';
export const NAVIGATION_ID = 'https://hackenberg.tech/#navigation';

export const PERSON_REF = { '@id': PERSON_ID };
export const WEBSITE_REF = { '@id': WEBSITE_ID };

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
    '@context': 'https://schema.org',
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
