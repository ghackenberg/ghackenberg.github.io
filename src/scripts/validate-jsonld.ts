import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

type JsonLdPrimitive = string | number | boolean | null;
type JsonLdValue = JsonLdPrimitive | JsonLdNode | JsonLdValue[];

interface JsonLdNode {
  '@context'?: string;
  '@type'?: string | string[];
  '@id'?: string;
  [key: string]: JsonLdValue | undefined;
}

interface Violation {
  gate: number;
  rule: string;
  page: string;
  message: string;
}

interface AuthorityCache {
  wikidata: Record<
    string,
    {
      exists: boolean;
      labels: { en?: string; de?: string };
      aliases: { en?: string[]; de?: string[] };
      claims: {
        instanceOf?: string[];
        officialWebsites?: string[];
      };
    }
  >;
  onet: Record<
    string,
    {
      valid: boolean;
      title?: string;
    }
  >;
  orcid: Record<
    string,
    {
      valid: boolean;
      checksumValid: boolean;
      givenName?: string;
      familyName?: string;
    }
  >;
  crossref: Record<
    string,
    {
      valid: boolean;
      hasAuthorHackenberg: boolean;
      title?: string;
    }
  >;
  github: Record<
    string,
    {
      exists: boolean;
    }
  >;
}

interface WikidataClaimSnak {
  datavalue?: {
    value?: {
      id?: string;
    } | string;
  };
}

interface WikidataClaim {
  mainsnak?: WikidataClaimSnak;
}

interface WikidataEntity {
  id?: string;
  missing?: string;
  labels?: {
    en?: { value?: string };
    de?: { value?: string };
  };
  aliases?: {
    en?: Array<{ value?: string }>;
    de?: Array<{ value?: string }>;
  };
  claims?: {
    P31?: WikidataClaim[];
    P856?: WikidataClaim[];
  };
}

interface WikidataApiResponse {
  entities?: Record<string, WikidataEntity>;
}

interface CrossrefAuthor {
  given?: string;
  family?: string;
  name?: string;
}

interface CrossrefApiResponse {
  message?: {
    title?: string[];
    author?: CrossrefAuthor[];
  };
}

interface OrcidApiResponse {
  name?: {
    'given-names'?: { value?: string };
    'family-name'?: { value?: string };
  };
}

interface SchemaOrgVocabCache {
  classes: string[];
  classParents: Record<string, string[]>;
  propDomains: Record<string, string[]>;
  properties: string[];
}

interface WikidataCandidate {
  qid: string;
  relPath: string;
  sourceProp: string;
  node: JsonLdNode;
}

interface OnetCandidate {
  code: string;
  relPath: string;
  node: JsonLdNode;
}

interface OrcidCandidate {
  orcidId: string;
  relPath: string;
  node: JsonLdNode;
}

interface CrossrefCandidate {
  doi: string;
  relPath: string;
  node: JsonLdNode;
}

interface GitHubCandidate {
  repoName: string;
  relPath: string;
  node: JsonLdNode;
}

const ROOT_DIR = process.cwd();
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');
const CACHE_DIR = path.resolve(ROOT_DIR, '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'jsonld-authorities.json');
const VOCAB_CACHE_FILE = path.join(CACHE_DIR, 'schemaorg-vocab.json');

if (!fs.existsSync(DIST_DIR)) {
  console.error('[validate-jsonld] Error: dist/ directory does not exist. Run "npm run build" first.');
  process.exit(1);
}

function getHtmlFiles(dir: string): string[] {
  let files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

function isIndexableHtml(relPath: string): boolean {
  const norm = relPath.replace(/\\/g, '/');
  if (norm === '404.html' || norm === '404/index.html') return false;
  if (/presentations\/[^/]+\/print\/index\.html$/.test(norm)) return false;
  if (norm.startsWith('newsletter/templates/') || norm.startsWith('newsletters/templates/')) return false;
  return true;
}

const allHtmlFiles = getHtmlFiles(DIST_DIR);
const auditedFiles = allHtmlFiles.filter((f) => isIndexableHtml(path.relative(DIST_DIR, f)));

const violations: Violation[] = [];

function addViolation(gate: number, rule: string, page: string, message: string) {
  violations.push({ gate, rule, page, message });
}

// -------------------------------------------------------------
// Data Structures for Cross-Page & Graph-Level Analysis
// -------------------------------------------------------------
const propertyDefinitions = new Map<string, Map<string, Set<string>>>();
const definedEntityIds = new Set<string>();

interface IdReference {
  targetId: string;
  sourcePage: string;
  relProperty: string;
}
const referencedIds: IdReference[] = [];

interface PageEntities {
  relPath: string;
  canonicalUrl: string;
  nodes: JsonLdNode[];
}
const pageEntitiesMap = new Map<string, PageEntities>();

const RELATION_PROPERTIES = new Set([
  'author',
  'publisher',
  'provider',
  'instructor',
  'creator',
  'isPartOf',
  'hasPart',
  'mainEntity',
  'mainEntityOfPage',
  'knowsAbout',
  'mentions',
  'subjectOf',
  'worksFor',
  'alumniOf',
  'recognizedBy',
  'about'
]);

const wikidataCandidates: WikidataCandidate[] = [];
const onetCandidates: OnetCandidate[] = [];
const orcidCandidates: OrcidCandidate[] = [];
const crossrefCandidates: CrossrefCandidate[] = [];
const githubCandidates: GitHubCandidate[] = [];
const allAuditedNodes: Array<{ node: JsonLdNode; relPath: string }> = [];

// -------------------------------------------------------------
// Helper: URL & Cache validation
// -------------------------------------------------------------
function isAbsoluteHttpUrl(val: JsonLdValue | undefined): boolean {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (trimmed === '' || trimmed === 'undefined' || trimmed === 'null') return false;
  return /^https?:\/\//i.test(trimmed);
}

function loadAuthorityCache(): AuthorityCache {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        return {
          wikidata: parsed.wikidata || {},
          onet: parsed.onet || {},
          orcid: parsed.orcid || {},
          crossref: parsed.crossref || {},
          github: parsed.github || {}
        };
      }
    } catch {
      // ignore
    }
  }
  return { wikidata: {}, onet: {}, orcid: {}, crossref: {}, github: {} };
}

function saveAuthorityCache(cache: AuthorityCache) {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

// -------------------------------------------------------------
// Per-page traversal & extraction
// -------------------------------------------------------------
for (const fullPath of auditedFiles) {
  const relPath = path.relative(DIST_DIR, fullPath).replace(/\\/g, '/');
  const canonicalUrl = `https://hackenberg.tech/${relPath.replace(/\/index\.html$/, '/').replace(/^index\.html$/, '')}`;

  const htmlContent = fs.readFileSync(fullPath, 'utf8');
  const $ = cheerio.load(htmlContent);
  const scriptTags = $('script[type="application/ld+json"]');

  if (scriptTags.length === 0) {
    addViolation(1, 'Missing JSON-LD', relPath, 'Page is missing required <script type="application/ld+json"> block.');
    continue;
  }

  const pageNodes: JsonLdNode[] = [];

  scriptTags.each((_, el) => {
    const rawJson = $(el).html();
    if (!rawJson || !rawJson.trim()) {
      addViolation(1, 'Empty JSON-LD', relPath, 'Encountered empty <script type="application/ld+json"> block.');
      return;
    }

    let parsed: JsonLdValue;
    try {
      parsed = JSON.parse(rawJson) as JsonLdValue;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addViolation(1, 'JSON Syntax Error', relPath, `Failed to parse JSON-LD block: ${msg}`);
      return;
    }

    // Gate 1: Enforce single root object with @context and @graph
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      addViolation(1, 'Invalid JSON-LD Root', relPath, 'Root JSON-LD element must be a single object (not a top-level array or primitive).');
      return;
    }

    const rootObj = parsed as JsonLdNode;
    const ctx = rootObj['@context'];
    const hasValidCtx = typeof ctx === 'string' && /^https?:\/\/schema\.org\/?$/i.test(ctx.trim());
    if (!hasValidCtx) {
      addViolation(1, 'Missing @context', relPath, `Root JSON-LD object must declare "@context": "https://schema.org" (found: ${JSON.stringify(ctx)}).`);
    }

    if (!Array.isArray(rootObj['@graph'])) {
      addViolation(1, 'Missing @graph Array', relPath, 'Root JSON-LD object must declare an "@graph" array containing all page nodes.');
      return;
    }

    for (const sub of rootObj['@graph']) {
      if (typeof sub !== 'object' || sub === null || Array.isArray(sub)) {
        addViolation(1, 'Invalid @graph Item', relPath, 'Items in "@graph" must be objects.');
        continue;
      }
      const subObj = sub as JsonLdNode;
      if ('@context' in subObj) {
        addViolation(1, 'Redundant @context in @graph', relPath, `Node with @id "${subObj['@id'] || 'anonymous'}" inside "@graph" must not redundantly declare "@context".`);
      }
      extractNodesFromTree(subObj, relPath, pageNodes);
    }
  });

  pageEntitiesMap.set(relPath, {
    relPath,
    canonicalUrl,
    nodes: pageNodes
  });
}

function extractNodesFromTree(root: JsonLdNode, relPath: string, collector: JsonLdNode[], parentProp?: string) {
  if (Array.isArray(root['@graph'])) {
    for (const sub of root['@graph']) {
      if (typeof sub === 'object' && sub !== null && !Array.isArray(sub)) {
        extractNodesFromTree(sub as JsonLdNode, relPath, collector, parentProp);
      }
    }
    return;
  }

  const node = root;
  collector.push(node);
  allAuditedNodes.push({ node, relPath });

  validateUriFields(node, relPath);

  const isPurePointer = Object.keys(node).filter((k) => k !== '@id' && k !== '@type' && k !== '@context').length === 0;
  if (!isPurePointer && !node['@type']) {
    addViolation(1, 'Missing @type', relPath, `Node with @id "${node['@id'] || 'anonymous'}" must declare a valid "@type".`);
  }

  checkAnonymousEntityClones(node, relPath, parentProp);
  trackNodeProperties(node, relPath);
  collectGate6Candidates(node, relPath);

  for (const [key, value] of Object.entries(node)) {
    if (key === '@context') continue;

    if (RELATION_PROPERTIES.has(key)) {
      inspectRelationField(key, value, relPath, node);
    }

    if (Array.isArray(value)) {
      for (const elem of value) {
        if (typeof elem === 'object' && elem !== null && !Array.isArray(elem)) {
          extractNodesFromTree(elem as JsonLdNode, relPath, collector, key);
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      extractNodesFromTree(value as JsonLdNode, relPath, collector, key);
    }
  }
}

// -------------------------------------------------------------
// Gate 1: URL / URI Field Validation
// -------------------------------------------------------------
function validateUriFields(node: JsonLdNode, relPath: string) {
  const URI_FIELDS = ['@id', 'url', 'sameAs', 'image', 'item', 'codeRepository', 'contentUrl'];

  for (const field of URI_FIELDS) {
    if (!(field in node)) continue;
    const val = node[field];

    if (typeof val === 'string') {
      if (!isAbsoluteHttpUrl(val)) {
        addViolation(1, 'Invalid URI Format', relPath, `Field "${field}" must be an absolute http(s):// URL (found: ${JSON.stringify(val)}).`);
      }
    } else if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === 'string' && !isAbsoluteHttpUrl(item)) {
          addViolation(1, 'Invalid URI Format', relPath, `Array item in "${field}" must be an absolute http(s):// URL (found: ${JSON.stringify(item)}).`);
        }
      }
    }
  }
}

// -------------------------------------------------------------
// Gate 2: Track Node Properties & Inspect Relations
// -------------------------------------------------------------
function trackNodeProperties(node: JsonLdNode, relPath: string) {
  const id = typeof node['@id'] === 'string' ? node['@id'].trim() : undefined;
  if (!id) return;

  const nodeType = Array.isArray(node['@type']) ? node['@type'].join('/') : node['@type'];
  if (nodeType === 'BreadcrumbList' || nodeType === 'ListItem') {
    return;
  }

  const nonMetaProps = Object.keys(node).filter((k) => k !== '@context' && k !== '@type' && k !== '@id');

  if (nonMetaProps.length > 0) {
    definedEntityIds.add(id);

    if (!propertyDefinitions.has(id)) {
      propertyDefinitions.set(id, new Map());
    }
    const propMap = propertyDefinitions.get(id)!;

    for (const prop of nonMetaProps) {
      if (!propMap.has(prop)) {
        propMap.set(prop, new Set());
      }
      propMap.get(prop)!.add(relPath);
    }
  }
}

function inspectRelationField(relProp: string, value: JsonLdValue | undefined, relPath: string, parentNode: JsonLdNode) {
  if (value === undefined || value === null) return;
  const items = Array.isArray(value) ? value : [value];

  for (const item of items) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
    const itemObj = item as JsonLdNode;
    const targetId = typeof itemObj['@id'] === 'string' ? itemObj['@id'].trim() : undefined;

    if (targetId) {
      if (targetId.startsWith('https://hackenberg.tech/')) {
        referencedIds.push({ targetId, sourcePage: relPath, relProperty: relProp });
      }

      const qidMatch = targetId.match(/^https?:\/\/(?:www\.)?wikidata\.org\/wiki\/(Q\d+)$/i);
      if (qidMatch) {
        wikidataCandidates.push({
          qid: qidMatch[1],
          relPath,
          sourceProp: relProp,
          node: itemObj
        });
      }

      const isCanonicalTarget = targetId.startsWith('https://hackenberg.tech/') || targetId.startsWith('https://www.wikidata.org/');
      const isPresentationSlide = parentNode['@type'] === 'PresentationDigitalDocument' && relProp === 'hasPart';
      const isImage = itemObj['@type'] === 'ImageObject';

      if (isCanonicalTarget && !isPresentationSlide && !isImage) {
        const extraKeys = Object.keys(itemObj).filter((k) => k !== '@id' && k !== '@type');
        if (extraKeys.length > 0) {
          addViolation(
            2,
            'Gate 2b: Impure Relation Pointer',
            relPath,
            `Relation property "${relProp}" references canonical entity "${targetId}" but inlines properties: [${extraKeys.join(', ')}]. Expected pure @id pointer ({ "@id": "..." }).`
          );
        }
      }
    }
  }
}

// -------------------------------------------------------------
// Gate 3: No Anonymous Entity Clones (Blank-Node Trap)
// -------------------------------------------------------------
function checkAnonymousEntityClones(node: JsonLdNode, relPath: string, parentProp?: string) {
  const hasId = typeof node['@id'] === 'string' && node['@id'].trim() !== '';
  if (hasId) return;

  const rawType = node['@type'];
  const types = Array.isArray(rawType) ? rawType : rawType ? [rawType] : [];

  for (const type of types) {
    if (type === 'Person') {
      const name = typeof node['name'] === 'string' ? node['name'] : '';
      if (/Georg Hackenberg/i.test(name)) {
        addViolation(3, 'Gate 3: Anonymous Person Clone', relPath, 'Found anonymous Person node matching "Georg Hackenberg" without canonical @id "https://hackenberg.tech/#person".');
      }
    }

    if (type === 'EducationalOrganization') {
      addViolation(3, 'Gate 3: Anonymous Organization', relPath, 'Found anonymous EducationalOrganization node without canonical @id.');
    }

    const PRIMARY_ENTITIES = new Set([
      'BlogPosting',
      'ScholarlyArticle',
      'Course',
      'LearningResource',
      'SoftwareApplication',
      'Service',
      'Article',
      'WebPage',
      'CollectionPage',
      'ProfilePage',
      'ContactPage'
    ]);

    if (PRIMARY_ENTITIES.has(type) && parentProp !== 'citation') {
      addViolation(3, 'Gate 3: Anonymous Primary Entity', relPath, `Primary entity of type "${type}" must declare an "@id".`);
    }
  }
}

// -------------------------------------------------------------
// Gate 6 Candidate Collection
// -------------------------------------------------------------
function collectGate6Candidates(node: JsonLdNode, relPath: string) {
  if (typeof node['@id'] === 'string') {
    const match = node['@id'].match(/^https?:\/\/(?:www\.)?wikidata\.org\/wiki\/(Q\d+)$/i);
    if (match) {
      wikidataCandidates.push({ qid: match[1], relPath, sourceProp: '@id', node });
    }
  }

  if (node['sameAs']) {
    const list = Array.isArray(node['sameAs']) ? node['sameAs'] : [node['sameAs']];
    for (const item of list) {
      if (typeof item === 'string') {
        const wMatch = item.match(/^https?:\/\/(?:www\.)?wikidata\.org\/wiki\/(Q\d+)$/i);
        if (wMatch) {
          wikidataCandidates.push({ qid: wMatch[1], relPath, sourceProp: 'sameAs', node });
        }

        const oMatch = item.match(/^https?:\/\/orcid\.org\/(\d{4}-\d{4}-\d{4}-\d{3}[\dX])$/i);
        if (oMatch) {
          orcidCandidates.push({ orcidId: oMatch[1], relPath, node });
        }

        const doiMatch = item.match(/^https?:\/\/doi\.org\/(10\..+)$/i);
        if (doiMatch) {
          crossrefCandidates.push({ doi: doiMatch[1], relPath, node });
        }
      }
    }
  }

  if (typeof node['occupationalCategory'] === 'string') {
    onetCandidates.push({ code: node['occupationalCategory'], relPath, node });
  }

  if (typeof node['codeRepository'] === 'string') {
    const ghMatch = node['codeRepository'].match(/^https?:\/\/github\.com\/ghackenberg\/([^/]+)/i);
    if (ghMatch) {
      githubCandidates.push({ repoName: ghMatch[1], relPath, node });
    }
  }
}

// -------------------------------------------------------------
// Gate 2a Evaluation: Cross-Page Duplicate Properties
// -------------------------------------------------------------
for (const [entityId, propMap] of propertyDefinitions.entries()) {
  for (const [propName, pagesSet] of propMap.entries()) {
    if (pagesSet.size > 1) {
      const pagesList = Array.from(pagesSet);
      addViolation(
        2,
        'Gate 2a: Duplicate Property Definition',
        pagesList[0],
        `Entity "${entityId}" has property "${propName}" duplicated across ${pagesSet.size} pages: [${pagesList.slice(0, 4).join(', ')}${pagesList.length > 4 ? '...' : ''}].`
      );
    }
  }
}

// -------------------------------------------------------------
// Gate 4 Evaluation: 100% Referential Integrity (Zero Dangling @id Pointers)
// -------------------------------------------------------------
for (const ref of referencedIds) {
  if (!definedEntityIds.has(ref.targetId)) {
    addViolation(
      4,
      'Gate 4: Dangling @id Reference',
      ref.sourcePage,
      `Relation "${ref.relProperty}" points to dangling @id "${ref.targetId}" which is never defined in the global graph.`
    );
  }
}

// -------------------------------------------------------------
// Gate 5 Evaluation: Canonical Page Coverage & Architecture Alignment
// -------------------------------------------------------------
for (const [relPath, pageData] of pageEntitiesMap.entries()) {
  const normPath = relPath.replace(/\\/g, '/');
  const nodeTypes = new Set<string>();
  const nodesById = new Map<string, JsonLdNode>();

  for (const n of pageData.nodes) {
    if (typeof n['@id'] === 'string') {
      const existing = nodesById.get(n['@id']);
      const nonMetaCount = Object.keys(n).filter((k) => k !== '@id' && k !== '@type' && k !== '@context').length;
      if (!existing || nonMetaCount > 0) {
        nodesById.set(n['@id'], n);
      }
    }
    const t = n['@type'];
    if (Array.isArray(t)) t.forEach((item) => nodeTypes.add(item));
    else if (typeof t === 'string') nodeTypes.add(t);
  }

  // 1. Homepage (index.html)
  if (normPath === 'index.html') {
    if (!nodesById.has('https://hackenberg.tech/#website') || !nodeTypes.has('WebSite')) {
      addViolation(5, 'Gate 5: Missing WebSite', normPath, 'Homepage must define WebSite ("https://hackenberg.tech/#website").');
    }
    if (!nodesById.has('https://hackenberg.tech/#navigation') || !nodeTypes.has('ItemList')) {
      addViolation(5, 'Gate 5: Missing Navigation ItemList', normPath, 'Homepage must define ItemList ("https://hackenberg.tech/#navigation").');
    }
    if (nodeTypes.has('ProfilePage')) {
      addViolation(5, 'Gate 5: Misplaced ProfilePage', normPath, 'Homepage must NOT define ProfilePage (ProfilePage belongs on /about/).');
    }
    if (nodeTypes.has('FAQPage')) {
      addViolation(5, 'Gate 5: Prohibited FAQPage', normPath, 'Homepage must NOT define FAQPage.');
    }
  }

  // 2. About page (about/index.html)
  else if (normPath === 'about/index.html') {
    if (!nodesById.has('https://hackenberg.tech/about/#profilepage') || !nodeTypes.has('ProfilePage')) {
      addViolation(5, 'Gate 5: Missing ProfilePage', normPath, 'About page must define ProfilePage ("https://hackenberg.tech/about/#profilepage").');
    }
    const personNode = nodesById.get('https://hackenberg.tech/#person');
    if (!personNode) {
      addViolation(5, 'Gate 5: Missing Person on About', normPath, 'About page must define canonical Person ("https://hackenberg.tech/#person").');
    } else {
      const requiredProps = ['jobTitle', 'worksFor', 'hasOccupation', 'alumniOf', 'hasCredential'];
      for (const p of requiredProps) {
        if (!(p in personNode)) {
          addViolation(5, 'Gate 5: Incomplete Person on About', normPath, `Person on /about/ must define property "${p}".`);
        }
      }
    }
  }

  // 3. Contact page (contact/index.html)
  else if (normPath === 'contact/index.html') {
    if (!nodesById.has('https://hackenberg.tech/contact/#contactpage') || !nodeTypes.has('ContactPage')) {
      addViolation(5, 'Gate 5: Missing ContactPage', normPath, 'Contact page must define ContactPage ("https://hackenberg.tech/contact/#contactpage").');
    }
    const personNode = nodesById.get('https://hackenberg.tech/#person');
    if (!personNode) {
      addViolation(5, 'Gate 5: Missing Person on Contact', normPath, 'Contact page must define canonical Person ("https://hackenberg.tech/#person").');
    } else {
      const requiredProps = ['email', 'telephone', 'workLocation', 'sameAs'];
      for (const p of requiredProps) {
        if (!(p in personNode)) {
          addViolation(5, 'Gate 5: Incomplete Person on Contact', normPath, `Person on /contact/ must define property "${p}".`);
        }
      }
    }
  }

  // 4. Tags overview page (tags/index.html)
  else if (normPath === 'tags/index.html') {
    if (!nodesById.has('https://hackenberg.tech/tags/#collectionpage') || !nodeTypes.has('CollectionPage')) {
      addViolation(5, 'Gate 5: Missing CollectionPage on Tags', normPath, 'Tags overview page must define CollectionPage ("https://hackenberg.tech/tags/#collectionpage").');
    }
    const personNode = nodesById.get('https://hackenberg.tech/#person');
    if (!personNode) {
      addViolation(5, 'Gate 5: Missing Person on Tags', normPath, 'Tags overview page must define canonical Person ("https://hackenberg.tech/#person").');
    } else if (!('knowsAbout' in personNode)) {
      addViolation(5, 'Gate 5: Incomplete Person on Tags', normPath, 'Person on /tags/ must define "knowsAbout".');
    }
  }

  // 5. Legal pages (impressum/index.html & datenschutz/index.html)
  else if (normPath === 'impressum/index.html') {
    if (!nodesById.has('https://hackenberg.tech/impressum/#webpage') || !nodeTypes.has('WebPage')) {
      addViolation(5, 'Gate 5: Missing Legal WebPage', normPath, 'Impressum page must define WebPage ("https://hackenberg.tech/impressum/#webpage").');
    }
    if (!nodeTypes.has('BreadcrumbList')) {
      addViolation(5, 'Gate 5: Missing BreadcrumbList', normPath, 'Impressum page must define a BreadcrumbList.');
    }
  } else if (normPath === 'datenschutz/index.html') {
    if (!nodesById.has('https://hackenberg.tech/datenschutz/#webpage') || !nodeTypes.has('WebPage')) {
      addViolation(5, 'Gate 5: Missing Legal WebPage', normPath, 'Datenschutz page must define WebPage ("https://hackenberg.tech/datenschutz/#webpage").');
    }
    if (!nodeTypes.has('BreadcrumbList')) {
      addViolation(5, 'Gate 5: Missing BreadcrumbList', normPath, 'Datenschutz page must define a BreadcrumbList.');
    }
  }

  // 6. Domain overview pages
  const OVERVIEW_ROUTES: Record<string, string> = {
    'posts/index.html': 'https://hackenberg.tech/posts/#collectionpage',
    'publications/index.html': 'https://hackenberg.tech/publications/#collectionpage',
    'presentations/index.html': 'https://hackenberg.tech/presentations/#collectionpage',
    'courses/index.html': 'https://hackenberg.tech/courses/#collectionpage',
    'projects/index.html': 'https://hackenberg.tech/projects/#collectionpage',
    'services/index.html': 'https://hackenberg.tech/services/#collectionpage',
    'newsletters/index.html': 'https://hackenberg.tech/newsletters/#collectionpage',
    'visualizations/index.html': 'https://hackenberg.tech/visualizations/#collectionpage'
  };

  if (normPath in OVERVIEW_ROUTES) {
    const expectedId = OVERVIEW_ROUTES[normPath];
    if (!nodesById.has(expectedId) || !nodeTypes.has('CollectionPage')) {
      addViolation(5, 'Gate 5: Missing Overview CollectionPage', normPath, `Overview page must define CollectionPage with @id "${expectedId}".`);
    }
    if (!nodeTypes.has('BreadcrumbList')) {
      addViolation(5, 'Gate 5: Missing BreadcrumbList', normPath, `Overview page "${normPath}" must define a BreadcrumbList.`);
    }
  }

  // 7. Detail pages
  const DETAIL_SPECS: Array<{
    pattern: RegExp;
    primaryTypes: string[];
    domainName: string;
  }> = [
    { pattern: /^posts\/[^/]+\/index\.html$/, primaryTypes: ['BlogPosting', 'Article'], domainName: 'posts' },
    { pattern: /^publications\/[^/]+\/index\.html$/, primaryTypes: ['ScholarlyArticle'], domainName: 'publications' },
    { pattern: /^presentations\/[^/]+\/index\.html$/, primaryTypes: ['PresentationDigitalDocument'], domainName: 'presentations' },
    { pattern: /^courses\/[^/]+\/index\.html$/, primaryTypes: ['Course', 'LearningResource'], domainName: 'courses' },
    { pattern: /^projects\/[^/]+\/index\.html$/, primaryTypes: ['SoftwareApplication', 'CreativeWork'], domainName: 'projects' },
    { pattern: /^services\/[^/]+\/index\.html$/, primaryTypes: ['Service'], domainName: 'services' },
    { pattern: /^newsletters\/[^/]+\/index\.html$/, primaryTypes: ['Article', 'PublicationIssue', 'NewsArticle', 'DigitalDocument'], domainName: 'newsletters' },
    { pattern: /^visualizations\/[^/]+\/index\.html$/, primaryTypes: ['SoftwareApplication', 'WebApplication', 'CreativeWork'], domainName: 'visualizations' },
    { pattern: /^tags\/[^/]+\/index\.html$/, primaryTypes: ['CollectionPage', 'ItemPage'], domainName: 'tags' }
  ];

  const ARTIFACT_DOMAINS = new Set([
    'posts',
    'publications',
    'presentations',
    'courses',
    'projects',
    'services',
    'newsletters',
    'visualizations'
  ]);

  for (const spec of DETAIL_SPECS) {
    if (spec.pattern.test(normPath)) {
      if (!nodeTypes.has('BreadcrumbList')) {
        addViolation(5, 'Gate 5: Missing BreadcrumbList', normPath, `Detail page for domain "${spec.domainName}" must define a BreadcrumbList.`);
      }
      const hasPrimary = spec.primaryTypes.some((t) => nodeTypes.has(t));
      if (!hasPrimary) {
        addViolation(5, 'Gate 5: Missing Primary Entity', normPath, `Detail page for domain "${spec.domainName}" must define one of primary types [${spec.primaryTypes.join(', ')}].`);
      }

      // Check bidirectional "about" reference to DefinedTerms
      if (ARTIFACT_DOMAINS.has(spec.domainName)) {
        const primaryNode = pageData.nodes.find((n) => {
          const t = n['@type'];
          const tList = Array.isArray(t) ? t : t ? [t] : [];
          return spec.primaryTypes.some((pt) => tList.includes(pt));
        });

        if (primaryNode) {
          const about = primaryNode['about'];
          const aboutList = Array.isArray(about) ? about : about ? [about] : [];
          const hasTagRef = aboutList.some((item) => {
            if (typeof item === 'object' && item !== null && typeof (item as JsonLdNode)['@id'] === 'string') {
              return /^https:\/\/hackenberg\.tech\/tags\/[^/]+\/#term$/.test((item as JsonLdNode)['@id'] as string);
            }
            return false;
          });

          if (!hasTagRef) {
            addViolation(
              5,
              'Gate 5: Missing Tag "about" Reference',
              normPath,
              `Primary entity in domain "${spec.domainName}" must define "about" linking at least one topic tag (https://hackenberg.tech/tags/.../#term).`
            );
          }
        }
      }

      break;
    }
  }

  // 8. Citation completeness check for any entity defining citations
  for (const n of pageData.nodes) {
    if (n.citation) {
      const citations = Array.isArray(n.citation) ? n.citation : [n.citation];
      for (const cit of citations) {
        if (typeof cit === 'object' && cit !== null) {
          const citObj = cit as JsonLdNode;
          const name = typeof citObj.name === 'string' ? citObj.name.trim() : '';
          if (!name) {
            addViolation(5, 'Gate 5: Incomplete Citation', normPath, 'Citation element missing required non-empty "name" property.');
          }
          const hasAuthor = citObj.author && (Array.isArray(citObj.author) ? citObj.author.length > 0 : true);
          if (!hasAuthor) {
            addViolation(5, 'Gate 5: Incomplete Citation', normPath, `Citation "${name || 'unknown'}" missing required "author" property.`);
          }
          const hasUrl = typeof citObj.url === 'string' && citObj.url.trim().length > 0;
          if (!hasUrl) {
            addViolation(5, 'Gate 5: Incomplete Citation', normPath, `Citation "${name || 'unknown'}" missing required "url" property.`);
          }
        }
      }
    }
  }
}

// -------------------------------------------------------------
// Gate 6: External Authority & Vocabulary Verification Suite
// -------------------------------------------------------------
function verifyOrcidChecksum(baseDigits: string, checkDigit: string): boolean {
  let total = 0;
  for (let i = 0; i < 15; i++) {
    total = (total + parseInt(baseDigits[i], 10)) * 2;
  }
  const remainder = total % 11;
  const result = (12 - remainder) % 11;
  const expectedCheckDigit = result === 10 ? 'X' : String(result);
  return expectedCheckDigit === checkDigit.toUpperCase();
}

async function loadOrFetchSchemaOrgVocab(): Promise<SchemaOrgVocabCache> {
  if (fs.existsSync(VOCAB_CACHE_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(VOCAB_CACHE_FILE, 'utf8'));
      if (parsed && Array.isArray(parsed.classes) && Array.isArray(parsed.properties)) {
        return parsed as SchemaOrgVocabCache;
      }
    } catch {
      // ignore
    }
  }

  console.log('[validate-jsonld] Fetching official Schema.org ontology...');
  const res = await fetch('https://schema.org/version/latest/schemaorg-current-https.jsonld', {
    headers: { 'User-Agent': 'hackenberg.tech-jsonld-validator/1.0' }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Schema.org vocabulary: status ${res.status}`);
  }

  interface RawGraphItem {
    '@id'?: string;
    '@type'?: string;
    'rdfs:subClassOf'?: Array<{ '@id'?: string }> | { '@id'?: string };
    'schema:domainIncludes'?: Array<{ '@id'?: string }> | { '@id'?: string };
  }
  const data = (await res.json()) as { '@graph'?: RawGraphItem[] };
  const graph = data['@graph'] || [];

  const classes: string[] = [];
  const properties: string[] = [];
  const classParents: Record<string, string[]> = {};
  const propDomains: Record<string, string[]> = {};

  for (const item of graph) {
    const rawId = item['@id'] || '';
    const name = rawId.replace(/^schema:/, '');
    if (item['@type'] === 'rdfs:Class') {
      classes.push(name);
      const parents: string[] = [];
      const sub = item['rdfs:subClassOf'];
      if (Array.isArray(sub)) {
        for (const s of sub) {
          const p = s['@id']?.replace(/^schema:/, '');
          if (p) parents.push(p);
        }
      } else if (sub && sub['@id']) {
        const p = sub['@id'].replace(/^schema:/, '');
        if (p) parents.push(p);
      }
      classParents[name] = parents;
    } else if (item['@type'] === 'rdf:Property') {
      properties.push(name);
      const domains: string[] = [];
      const d = item['schema:domainIncludes'];
      if (Array.isArray(d)) {
        for (const itemD of d) {
          const p = itemD['@id']?.replace(/^schema:/, '');
          if (p) domains.push(p);
        }
      } else if (d && d['@id']) {
        const p = d['@id'].replace(/^schema:/, '');
        if (p) domains.push(p);
      }
      propDomains[name] = domains;
    }
  }

  const vocab: SchemaOrgVocabCache = { classes, classParents, propDomains, properties };
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  fs.writeFileSync(VOCAB_CACHE_FILE, JSON.stringify(vocab, null, 2), 'utf8');
  return vocab;
}

async function verifyExternalAuthorities() {
  const cache = loadAuthorityCache();
  let cacheModified = false;

  // -----------------------------------------------------------
  // Gate 6a: Official Schema.org Vocabulary Validation
  // -----------------------------------------------------------
  try {
    const vocab = await loadOrFetchSchemaOrgVocab();
    const allClasses = new Set(vocab.classes);
    const allProps = new Set(vocab.properties);

    function getAncestors(cls: string): Set<string> {
      const ancestors = new Set<string>([cls]);
      const queue = [cls];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        const parents = vocab.classParents[curr] || [];
        for (const p of parents) {
          if (!ancestors.has(p)) {
            ancestors.add(p);
            queue.push(p);
          }
        }
      }
      return ancestors;
    }

    function isPropertyValidForClass(prop: string, types: string[]): boolean {
      const domains = vocab.propDomains[prop];
      if (!domains || domains.length === 0) return false;
      for (const cls of types) {
        const ancestors = getAncestors(cls);
        if (domains.some((d) => ancestors.has(d))) return true;
      }
      return false;
    }

    for (const { node, relPath } of allAuditedNodes) {
      const rawType = node['@type'];
      const types = Array.isArray(rawType) ? rawType : rawType ? [rawType] : [];

      for (const t of types) {
        if (!allClasses.has(t)) {
          addViolation(6, 'Gate 6a: Invalid Schema.org Class', relPath, `Type "${t}" is not a valid Schema.org class.`);
        }
      }

      for (const [key] of Object.entries(node)) {
        if (key.startsWith('@')) continue;

        if (!allProps.has(key)) {
          addViolation(6, 'Gate 6a: Invalid Schema.org Property', relPath, `Property "${key}" is not defined in Schema.org.`);
        } else if (types.length > 0) {
          const isValid = isPropertyValidForClass(key, types);
          const isAllowedExtension =
            key === 'primaryImageOfPage' ||
            (key === 'instructor' && types.includes('Course')) ||
            ((key === 'isPartOf' || key === 'hasPart' || key === 'about') && types.includes('Service'));

          if (!isValid && !isAllowedExtension) {
            addViolation(
              6,
              'Gate 6a: Schema.org Property Domain Mismatch',
              relPath,
              `Property "${key}" is not valid for type(s) [${types.join(', ')}] in Schema.org.`
            );
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[validate-jsonld] Warning: Failed to validate Schema.org vocabulary: ${String(err)}`);
  }

  // -----------------------------------------------------------
  // Gate 6b: Wikidata API Verification
  // -----------------------------------------------------------
  const uniqueQids = Array.from(new Set(wikidataCandidates.map((c) => c.qid)));
  const missingQids = uniqueQids.filter((qid) => !cache.wikidata[qid]);

  if (missingQids.length > 0) {
    try {
      const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${missingQids.join('|')}&props=labels|aliases|descriptions|claims&languages=en|de&format=json`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'hackenberg.tech-jsonld-validator/1.0 (https://hackenberg.tech)' }
      });
      if (res.ok) {
        const data = (await res.json()) as WikidataApiResponse;
        for (const qid of missingQids) {
          const entity = data.entities?.[qid];
          if (!entity || entity.missing !== undefined) {
            cache.wikidata[qid] = {
              exists: false,
              labels: {},
              aliases: {},
              claims: {}
            };
          } else {
            const p31 = entity.claims?.P31 || [];
            const instanceOf: string[] = [];
            for (const c of p31) {
              const val = c.mainsnak?.datavalue?.value;
              if (val && typeof val === 'object' && 'id' in val && typeof val.id === 'string') {
                instanceOf.push(val.id);
              }
            }

            const p856 = entity.claims?.P856 || [];
            const officialWebsites: string[] = [];
            for (const c of p856) {
              const val = c.mainsnak?.datavalue?.value;
              if (typeof val === 'string') {
                officialWebsites.push(val);
              }
            }

            cache.wikidata[qid] = {
              exists: true,
              labels: {
                en: entity.labels?.en?.value,
                de: entity.labels?.de?.value
              },
              aliases: {
                en: entity.aliases?.en?.map((a) => a.value || '').filter(Boolean) || [],
                de: entity.aliases?.de?.map((a) => a.value || '').filter(Boolean) || []
              },
              claims: {
                instanceOf,
                officialWebsites
              }
            };
          }
        }
        cacheModified = true;
      }
    } catch (err) {
      console.warn(`[validate-jsonld] Warning: Wikidata fetch error: ${String(err)}`);
    }
  }

  const ORG_PROPERTIES = new Set(['provider', 'publisher', 'recognizedBy', 'worksFor', 'alumniOf']);

  for (const cand of wikidataCandidates) {
    const cached = cache.wikidata[cand.qid];
    if (!cached) continue;
    if (!cached.exists) {
      addViolation(6, 'Gate 6b: Non-Existent Wikidata Entity', cand.relPath, `Wikidata entity "${cand.qid}" does not exist.`);
      continue;
    }

    const rawType = cand.node['@type'];
    const types = Array.isArray(rawType) ? rawType : rawType ? [rawType] : [];
    const isOrgType = types.some((t) => t.includes('Organization') || t === 'EducationalOrganization');
    const isOrgProp = ORG_PROPERTIES.has(cand.sourceProp);

    if (isOrgType || isOrgProp) {
      if (cached.claims.instanceOf?.includes('Q5')) {
        addViolation(
          6,
          'Gate 6b: Wikidata Entity Type Mismatch',
          cand.relPath,
          `Wikidata entity "${cand.qid}" is an instance of Human (Q5), but is used as an Organization.`
        );
      }
    }

    if (typeof cand.node['name'] === 'string') {
      const nodeName = cand.node['name'].trim().toLowerCase();
      const candidates = [
        cached.labels.en?.toLowerCase(),
        cached.labels.de?.toLowerCase(),
        ...(cached.aliases.en || []).map((a) => a.toLowerCase()),
        ...(cached.aliases.de || []).map((a) => a.toLowerCase())
      ].filter((s): s is string => Boolean(s));

      if (candidates.length > 0) {
        const matches = candidates.some((c) => c === nodeName || c.includes(nodeName) || nodeName.includes(c));
        if (!matches) {
          addViolation(
            6,
            'Gate 6b: Wikidata Name Discrepancy',
            cand.relPath,
            `Node name "${cand.node['name']}" does not match known Wikidata labels or aliases for "${cand.qid}" (${candidates.slice(0, 3).join(', ')}).`
          );
        }
      }
    }

    if (typeof cand.node['url'] === 'string') {
      try {
        const nodeHost = new URL(cand.node['url']).hostname.replace(/^www\./, '').toLowerCase();
        const officialHosts = (cached.claims.officialWebsites || [])
          .map((u) => {
            try {
              return new URL(u).hostname.replace(/^www\./, '').toLowerCase();
            } catch {
              return '';
            }
          })
          .filter(Boolean);

        if (officialHosts.length > 0 && !officialHosts.includes(nodeHost)) {
          addViolation(
            6,
            'Gate 6b: Wikidata Website Host Mismatch',
            cand.relPath,
            `Node url host "${nodeHost}" does not match official website hosts in Wikidata for "${cand.qid}" (${officialHosts.join(', ')}).`
          );
        }
      } catch {
        // Handled by Gate 1
      }
    }
  }

  // -----------------------------------------------------------
  // Gate 6c: O*NET-SOC Verification
  // -----------------------------------------------------------
  const uniqueOnetCodes = Array.from(new Set(onetCandidates.map((c) => c.code)));
  const missingOnetCodes = uniqueOnetCodes.filter((code) => !cache.onet[code]);

  for (const code of missingOnetCodes) {
    if (!/^\d{2}-\d{4}\.\d{2}$/.test(code)) {
      cache.onet[code] = { valid: false };
      cacheModified = true;
      continue;
    }

    try {
      const url = `https://www.onetonline.org/link/summary/${code}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'hackenberg.tech-jsonld-validator/1.0 (https://hackenberg.tech)' }
      });
      if (res.ok) {
        const html = await res.text();
        const match = html.match(/<title>([^<]+)<\/title>/i);
        const title = match ? match[1] : undefined;
        const valid = title ? title.includes(code) : false;
        cache.onet[code] = { valid, title };
      } else {
        cache.onet[code] = { valid: false };
      }
      cacheModified = true;
    } catch (err) {
      console.warn(`[validate-jsonld] Warning: O*NET fetch error for ${code}: ${String(err)}`);
    }
  }

  for (const cand of onetCandidates) {
    if (!/^\d{2}-\d{4}\.\d{2}$/.test(cand.code)) {
      addViolation(6, 'Gate 6c: Invalid O*NET-SOC Format', cand.relPath, `O*NET-SOC code "${cand.code}" does not conform to "^\\d{2}-\\d{4}\\.\\d{2}$".`);
      continue;
    }
    const cached = cache.onet[cand.code];
    if (cached && !cached.valid) {
      addViolation(6, 'Gate 6c: Unverified O*NET-SOC Code', cand.relPath, `O*NET-SOC code "${cand.code}" could not be verified on onetonline.org.`);
    }
  }

  // -----------------------------------------------------------
  // Gate 6d: ORCID Public API & Checksum Verification
  // -----------------------------------------------------------
  const uniqueOrcids = Array.from(new Set(orcidCandidates.map((c) => c.orcidId)));
  const missingOrcids = uniqueOrcids.filter((id) => !cache.orcid[id]);

  for (const orcidId of missingOrcids) {
    const cleaned = orcidId.replace(/-/g, '');
    const base = cleaned.substring(0, 15);
    const check = cleaned.substring(15);
    const checksumValid = verifyOrcidChecksum(base, check);

    if (!checksumValid) {
      cache.orcid[orcidId] = { valid: false, checksumValid: false };
      cacheModified = true;
      continue;
    }

    try {
      const res = await fetch(`https://pub.orcid.org/v3.0/${orcidId}/person`, {
        headers: { Accept: 'application/json', 'User-Agent': 'hackenberg.tech-jsonld-validator/1.0' }
      });
      if (res.ok) {
        const data = (await res.json()) as OrcidApiResponse;
        const givenName = data.name?.['given-names']?.value;
        const familyName = data.name?.['family-name']?.value;
        cache.orcid[orcidId] = { valid: true, checksumValid: true, givenName, familyName };
      } else {
        cache.orcid[orcidId] = { valid: false, checksumValid: true };
      }
      cacheModified = true;
    } catch (err) {
      console.warn(`[validate-jsonld] Warning: ORCID fetch error for ${orcidId}: ${String(err)}`);
    }
  }

  for (const cand of orcidCandidates) {
    const cached = cache.orcid[cand.orcidId];
    if (!cached) continue;
    if (!cached.checksumValid) {
      addViolation(6, 'Gate 6d: Invalid ORCID Checksum', cand.relPath, `ORCID "${cand.orcidId}" failed ISO 7064 Mod 11,2 checksum verification.`);
      continue;
    }
    const isSiteAuthor = cand.node['@id'] === 'https://hackenberg.tech/#person' || /Georg Hackenberg/i.test(String(cand.node['name'] || ''));
    if (isSiteAuthor) {
      const isGeorg = /Georg/i.test(cached.givenName || '') && /Hackenberg/i.test(cached.familyName || '');
      if (!isGeorg) {
        addViolation(6, 'Gate 6d: ORCID Identity Mismatch', cand.relPath, `ORCID "${cand.orcidId}" did not match expected person name "Georg Hackenberg".`);
      }
    } else if (cand.node['name']) {
      const expectedName = String(cand.node['name']);
      const familyName = cached.familyName || '';
      const givenName = cached.givenName || '';
      if (familyName && !new RegExp(familyName.replace(/[^a-zA-Z]/g, ''), 'i').test(expectedName.replace(/[^a-zA-Z]/g, ''))) {
        addViolation(6, 'Gate 6d: ORCID Identity Mismatch', cand.relPath, `ORCID "${cand.orcidId}" (${givenName} ${familyName}) did not match expected author name "${expectedName}".`);
      }
    }
  }

  // -----------------------------------------------------------
  // Gate 6e: Crossref / DOI API Verification
  // -----------------------------------------------------------
  const uniqueDois = Array.from(new Set(crossrefCandidates.map((c) => c.doi)));
  const missingDois = uniqueDois.filter((d) => !cache.crossref[d]);

  for (const doi of missingDois) {
    try {
      const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
        headers: { 'User-Agent': 'hackenberg.tech-jsonld-validator/1.0 (mailto:georg@hackenberg.tech)' }
      });
      if (res.ok) {
        const data = (await res.json()) as CrossrefApiResponse;
        const authors = (data.message?.author || []).map((a) => a.family || a.name || '');
        const hasAuthorHackenberg = authors.some((a) => /Hackenberg/i.test(a));
        const title = data.message?.title?.[0];
        const valid = authors.length > 0 ? hasAuthorHackenberg : Boolean(title);
        cache.crossref[doi] = { valid, hasAuthorHackenberg, title };
      } else {
        cache.crossref[doi] = { valid: false, hasAuthorHackenberg: false };
      }
      cacheModified = true;
      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      console.warn(`[validate-jsonld] Warning: Crossref fetch error for ${doi}: ${String(err)}`);
    }
  }

  for (const cand of crossrefCandidates) {
    const cached = cache.crossref[cand.doi];
    if (!cached) continue;
    if (!cached.valid) {
      addViolation(6, 'Gate 6e: Unverified DOI / Author Mismatch', cand.relPath, `Publication DOI "${cand.doi}" could not be verified on Crossref or author list lacks Hackenberg.`);
    }
  }

  // -----------------------------------------------------------
  // Gate 6f: GitHub API Verification
  // -----------------------------------------------------------
  const uniqueRepos = Array.from(new Set(githubCandidates.map((c) => c.repoName)));
  const missingRepos = uniqueRepos.filter((r) => !cache.github[r]);

  for (const repoName of missingRepos) {
    try {
      const res = await fetch(`https://api.github.com/repos/ghackenberg/${repoName}`, {
        headers: { 'User-Agent': 'hackenberg.tech-jsonld-validator/1.0' }
      });
      const exists = res.status === 200;
      cache.github[repoName] = { exists };
      cacheModified = true;
    } catch (err) {
      console.warn(`[validate-jsonld] Warning: GitHub fetch error for ${repoName}: ${String(err)}`);
    }
  }

  for (const cand of githubCandidates) {
    const cached = cache.github[cand.repoName];
    if (!cached) continue;
    if (!cached.exists) {
      addViolation(6, 'Gate 6f: Non-Existent GitHub Repository', cand.relPath, `Referenced GitHub repository "ghackenberg/${cand.repoName}" is not publicly accessible.`);
    }
  }

  if (cacheModified) {
    saveAuthorityCache(cache);
  }
}

// -------------------------------------------------------------
// Execution & Reporting
// -------------------------------------------------------------
async function run() {
  await verifyExternalAuthorities();

  console.log('\n======================================================');
  console.log('       POST-BUILD JSON-LD GRAPH VALIDATOR');
  console.log('======================================================');
  console.log(`Audited HTML pages: ${auditedFiles.length}`);
  console.log(`Defined entity @ids: ${definedEntityIds.size}`);
  console.log(`Global property definitions tracked: ${propertyDefinitions.size}`);
  console.log(`Internal relation pointers checked: ${referencedIds.length}`);
  console.log(`Wikidata entity references verified: ${wikidataCandidates.length}`);
  console.log(`O*NET-SOC occupation categories verified: ${onetCandidates.length}`);
  console.log(`ORCID author profiles verified: ${orcidCandidates.length}`);
  console.log(`Crossref publication DOIs verified: ${crossrefCandidates.length}`);
  console.log(`GitHub repositories verified: ${githubCandidates.length}`);
  console.log('------------------------------------------------------');

  const gateCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const v of violations) {
    gateCounts[v.gate] = (gateCounts[v.gate] || 0) + 1;
  }

  console.log(`Gate 1 (Syntactic & Structural Validity):           ${gateCounts[1]} violation(s)`);
  console.log(`Gate 2 (Cross-Page Property Uniqueness / 3NF):      ${gateCounts[2]} violation(s)`);
  console.log(`Gate 3 (No Anonymous Entity Clones):               ${gateCounts[3]} violation(s)`);
  console.log(`Gate 4 (100% Referential Integrity / No Dangling):  ${gateCounts[4]} violation(s)`);
  console.log(`Gate 5 (Canonical Page Coverage & Architecture):    ${gateCounts[5]} violation(s)`);
  console.log(`Gate 6 (External Authority & Vocabulary Suite):     ${gateCounts[6]} violation(s)`);
  console.log('------------------------------------------------------');
  console.log(`Total Violations Detected: ${violations.length}\n`);

  if (violations.length > 0) {
    console.log('--- DETAILED VIOLATIONS BY GATE ---');
    for (let g = 1; g <= 6; g++) {
      const gateViolations = violations.filter((v) => v.gate === g);
      if (gateViolations.length === 0) continue;

      console.log(`\n[GATE ${g}] (${gateViolations.length} issue(s)):`);
      const byRule = new Map<string, Violation[]>();
      for (const v of gateViolations) {
        if (!byRule.has(v.rule)) byRule.set(v.rule, []);
        byRule.get(v.rule)!.push(v);
      }

      for (const [rule, list] of byRule.entries()) {
        console.log(`  ▶ ${rule} (${list.length} occurrence(s)):`);
        for (const item of list.slice(0, 5)) {
          console.log(`    - [${item.page}] ${item.message}`);
        }
        if (list.length > 5) {
          console.log(`    ... and ${list.length - 5} more.`);
        }
      }
    }

    console.log('\n======================================================');
    console.error(`💥 [validate:jsonld] Failed with ${violations.length} error(s).`);
    process.exit(1);
  } else {
    console.log('✅ [validate:jsonld] All 6 JSON-LD governance gates passed (0 errors).');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('[validate-jsonld] Fatal error:', err);
  process.exit(1);
});
