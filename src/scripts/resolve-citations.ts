import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import YAML from 'yaml';

interface CrossrefAuthor {
  given?: string;
  family?: string;
  name?: string;
  ORCID?: string;
}

interface ResolvedAuthor {
  name: string;
  id?: string;
  type?: string;
}

interface OpenAlexAuthorship {
  author: {
    id: string;
    display_name: string;
    orcid?: string | null;
  };
}

interface ReferenceEntry {
  id?: string;
  doi?: string;
  url?: string;
  title?: string;
  author?: string;
  authors?: ResolvedAuthor[];
  [key: string]: string | number | boolean | ResolvedAuthor[] | string[] | undefined;
}

interface FrontmatterDoc {
  references?: ReferenceEntry[];
  [key: string]: string | number | boolean | ReferenceEntry[] | string[] | undefined;
}

const AUTHOR_NORMALIZATION_MAP: Record<string, string> = {
  // Historical & Canonical Authors
  'W. R THOMPSON': 'William R. Thompson',
  'W. R. Thompson': 'William R. Thompson',
  'W. R. THOMPSON': 'William R. Thompson',
  'J. Miller': 'Jason Miller',
  'H. Darcy': 'Henry Darcy',
  'S. Willison': 'Simon Willison',
  'J. Howard': 'Jeremy Howard',
  'R. Fishkin': 'Rand Fishkin',
  'S. Tiangolo': 'Sebastián Ramírez',
  'G. Banga': 'Krrish Dholakia',
  'D. Hardt': 'Dick Hardt',
  'M. Jones': 'Michael Jones',
  'A. Nadalin': 'Anthony Nadalin',
  'B. Campbell': 'Brian Campbell',
  'C. Mortimore': 'Campbell Mortimore',
  'N. Sakimura': 'Nat Sakimura',
  'J. Bradley': 'John Bradley',
  'B. de Medeiros': 'Breno de Medeiros',
  'S. Colvin': 'Samuel Colvin',
  'K. Sveidqvist': 'Knut Sveidqvist',
  'W. Titus': 'Titus Wormer',
  "F. Dell'Acqua": "Fabrizio Dell'Acqua",
  'E. Brynjolfsson': 'Erik Brynjolfsson',
  'D. Li': 'Danielle Li',
  'L. R. Raymond': 'Lindsey R. Raymond',
  'R. G. Allen': 'Richard G. Allen',
  'L. S. Pereira': 'Luis S. Pereira',
  'D. Raes': 'Dirk Raes',
  'M. Smith': 'Martin Smith',
  'F. R. Lamm': 'Freddie R. Lamm',
  'J. E. Ayars': 'James E. Ayars',
  'F. S. Nakayama': 'Francis S. Nakayama',
  'F. P. Incropera': 'Frank P. Incropera',
  'D. P. DeWitt': 'David P. DeWitt',
  'T. L. Bergman': 'Theodore L. Bergman',
  'A. S. Lavine': 'Adrienne S. Lavine',
  'A. Clark': 'Andy Clark',
  'D. Chalmers': 'David J. Chalmers',
  'S. K. Park': 'Stephen K. Park',
  'K. W. Miller': 'Keith W. Miller',
  'M. Bostock': 'Mike Bostock',
  'V. Ogievetsky': 'Vadim Ogievetsky',
  'J. Heer': 'Jeffrey Heer',
  'G. Stelling': 'Guus Stelling',
  'M. Zijlema': 'Marcel Zijlema',
  'R. Courant': 'Richard Courant',
  'K. Friedrichs': 'Kurt O. Friedrichs',
  'H. Lewy': 'Hans Lewy',
  'E.C. Capen': 'Ed C. Capen',
  'R.V. Clapp': 'Robert V. Clapp',
  'W.M. Campbell': 'William M. Campbell',
  'J. Levine': 'John Levine',
  'T. Herkula': 'Todd Herkula',
  'D. Korn': 'David Korn',
  'J. MacDonald': 'Joshua MacDonald',
  'J. Mogul': 'Jeffrey Mogul',
  'K. Vo': 'Kiem-Phong Vo',
  'I. Fette': 'Ian Fette',
  'A. Melnikov': 'Alexey Melnikov',
  'T. Boutell': 'Thomas Boutell',
  'P. W. Anderson': 'Philip W. Anderson',
  'C.D. Broad': 'Charlie Dunbar Broad',
  'H. Peyton Young': 'Hobart Peyton Young',
  'C. Packer': 'Charles Packer',
  'V. Fang': 'Vivian Fang',
  'S. G. Patil': 'Shishir G. Patil',
  'K. Lin': 'Kevin Lin',
  'S. Wooders': 'Sarah Wooders',
  'J. E. Gonzalez': 'Joseph E. Gonzalez',
  'P. Chhikara': 'Prateek Chhikara',
  'K. Khurana': 'Karan Khurana',
  'A. Goyal': 'Aryan Goyal',
  'C. F. Ruan': 'Charlie F. Ruan',
  'T. Chen': 'Tianqi Chen',
  'T. Dettmers': 'Tim Dettmers',
  'M. Lewis': 'Mike Lewis',
  'Y. Belkada': 'Younes Belkada',
  'L. Zettlemoyer': 'Luke Zettlemoyer',
  'A. Vaswani': 'Ashish Vaswani',
  'T. Brown': 'Tom B. Brown',
  'J. Wei': 'Jason Wei',
  'T. Kojima': 'Takeshi Kojima',
  'X. Wang': 'Xuezhi Wang',
  'D. Zhou': 'Denny Zhou',
  'P. Lewis': 'Patrick Lewis',
  'K. Greshake': 'Kai Greshake',
  'O. Khattab': 'Omar Khattab',
  'S. Yao': 'Shunyu Yao',
  'Y. Tang': 'Yixuan Tang',
  'Y. Lu': 'Yuning Lu',
  'Y. Chen': 'Yilun Chen',
  'S. Wu': 'Shuang Wu',
  'S. Ö. Arık': 'Sercan Ö. Arık',
  'N. F. Liu': 'Nelson F. Liu',
  'R. V. Guha': 'Ramanathan V. Guha',
  'A. W. Rivadeneira': 'A. Ward Rivadeneira',
  'F.B. Viegas': 'Fernanda B. Viégas',
  'M. Wattenberg': 'Martin Wattenberg',
  'J. Feinberg': 'Jonathan Feinberg',
  'A. Walkyria Rivadeneira': 'Ana Walkyria Rivadeneira',
  'G. Brewer': 'Gayle Brewer',
  'W. K. Campbell': 'William Keith Campbell',
  'W. Keith Campbell': 'William Keith Campbell',
  'B. A. Fay': 'Brian A. Fay',
  'H. Hoemann': 'Katherine H. Hoemann',
  'N. V. Mills': 'Nicholas V. Mills',
  'A. E. Mosser': 'Amy E. Mosser',
  'M. Muzi': 'Marco Muzi',
  'M. Schrama': 'Miranda Schrama',
  'M. Zwienenberg': 'Mirjam Zwienenberg',
};

const KNOWN_ORGANIZATIONS = new Set([
  'Perplexity AI',
  'First Page Sage',
  'Janrain',
  'Blue Research',
  'Edelman',
  'LinkedIn',
  'Astro Core Team',
  'Google Web Vitals',
  'Google Search Central',
  'Google Developers',
  'Google LLC',
  'W3C Web Applications Working Group',
  'W3C GPU for the Web Working Group',
  'W3C RDF Working Group',
  'W3C Accessibility Guidelines Working Group',
  'W3C SVG Working Group',
  'W3C Speech Interface Working Group',
  'W3C CSS Working Group',
  'ISO',
  'DIN Deutsches Institut für Normung e.V.',
  'FLL – Forschungsgesellschaft Landschaftsentwicklung Landschaftsbau e.V.',
  'NVIDIA Corporation',
  'Anthropic',
  'LangChain Inc.',
  'Red Hat',
  'AgentSkills.io Community',
  'Nous Research',
  'Forrester Research',
  'Schema.org Community Group',
  'Mastra Core Team',
  'Microsoft',
  'Microsoft Advertising',
  'Plausible Analytics',
  'Plausible Insights OÜ',
  'Khronos Group',
  'National Institute of Standards and Technology (US)',
  'OpenAI',
  'Authoricy Research',
  'Authoritas Research',
  'ALTCHA',
  'Europäische Kommission',
  'OpenTelemetry Authors',
]);

function scanDir(dir: string, ext: string[]): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      results = results.concat(scanDir(full, ext));
    } else if (ext.some((e) => ent.name.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

export function isAbbreviatedFirstName(name: string): boolean {
  const trimmed = name.trim();
  const firstToken = trimmed.split(/\s+/)[0];
  if (!firstToken) return false;
  return /^[A-Z](\.|$)/.test(firstToken) || /^[A-Z]\.[A-Z]\./.test(firstToken);
}

export function normalizeAuthorName(name: string): string {
  const trimmed = name.trim();
  if (AUTHOR_NORMALIZATION_MAP[trimmed]) {
    return AUTHOR_NORMALIZATION_MAP[trimmed];
  }
  return trimmed;
}

function formatAuthorEntry(author: ResolvedAuthor): ResolvedAuthor {
  const normName = normalizeAuthorName(author.name);
  const result: ResolvedAuthor = { name: normName };
  if (author.id) {
    result.id = author.id;
  }
  if (KNOWN_ORGANIZATIONS.has(normName) || author.type === 'Organization') {
    result.type = 'Organization';
  }
  // Note: type: Person is omitted as it is the default schema value
  return result;
}

function extractArxivId(doi?: string, url?: string): string | null {
  if (doi) {
    const doiMatch = doi.match(/10\.48550\/arXiv\.([0-9]+\.[0-9]+(?:v\d+)?|[a-z-]+(?:\.[a-z]+)?\/\d+)/i);
    if (doiMatch) return doiMatch[1];
  }
  if (url) {
    const urlMatch = url.match(/arxiv\.org\/(?:abs|pdf)\/([0-9]+\.[0-9]+(?:v\d+)?|[a-z-]+(?:\.[a-z]+)?\/\d+)/i);
    if (urlMatch) return urlMatch[1];
  }
  return null;
}

function extractDoiFromUrl(url?: string): string | null {
  if (!url) return null;
  // SSRN
  const ssrnMatch = url.match(/papers\.ssrn\.com\/sol3\/papers\.cfm\?abstract_id=(\d+)/i);
  if (ssrnMatch) {
    return `10.2139/ssrn.${ssrnMatch[1]}`;
  }
  // NBER
  const nberMatch = url.match(/nber\.org\/papers\/(w\d+)/i);
  if (nberMatch) {
    return `10.3386/${nberMatch[1]}`;
  }
  // Generic doi.org
  const doiMatch = url.match(/(?:dx\.)?doi\.org\/(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)/i);
  if (doiMatch) {
    return doiMatch[1];
  }
  return null;
}

async function fetchArxivAuthors(arxivId: string): Promise<ResolvedAuthor[] | null> {
  const cleanId = arxivId.replace(/^arxiv:/i, '').replace(/v\d+$/i, '').trim();
  const url = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(cleanId)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ghackenberg-site-builder (https://hackenberg.tech; mail@georghackenberg.com)',
      },
    });
    if (!res.ok) return null;
    const text = await res.text();
    const $ = cheerio.load(text, { xmlMode: true });
    const names = $('entry > author > name')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((n) => Boolean(n));
    if (names.length === 0) return null;
    return names.map((name) => formatAuthorEntry({ name }));
  } catch {
    return null;
  }
}

async function fetchOpenAlexAuthors(doi: string): Promise<ResolvedAuthor[] | null> {
  const cleanDoi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim();
  const url = `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(cleanDoi)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ghackenberg-site-builder (https://hackenberg.tech; mail@georghackenberg.com)',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const authorships: OpenAlexAuthorship[] = data?.authorships;
    if (!Array.isArray(authorships) || authorships.length === 0) return null;

    return authorships.map((a) => {
      const resAuthor: ResolvedAuthor = { name: a.author.display_name };
      if (a.author.orcid) {
        resAuthor.id = a.author.orcid;
      }
      return formatAuthorEntry(resAuthor);
    });
  } catch {
    return null;
  }
}

async function fetchCrossrefAuthors(doi: string): Promise<ResolvedAuthor[] | null> {
  const cleanDoi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim();
  const url = `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ghackenberg-site-builder (https://hackenberg.tech; mail@georghackenberg.com)',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const authors: CrossrefAuthor[] = data?.message?.author;
    if (!Array.isArray(authors) || authors.length === 0) return null;

    return authors.map((a) => {
      const rawName = a.name ? a.name.trim() : `${a.given || ''} ${a.family || ''}`.trim();
      const resAuthor: ResolvedAuthor = { name: rawName };
      if (a.ORCID) {
        const m = a.ORCID.match(/(\d{4}-\d{4}-\d{4}-\d{3}[\dX])/);
        if (m) {
          resAuthor.id = `https://orcid.org/${m[1]}`;
        }
      }
      return formatAuthorEntry(resAuthor);
    });
  } catch {
    return null;
  }
}

async function resolveReference(ref: ReferenceEntry, forceAll: boolean): Promise<boolean> {
  let changed = false;

  // Auto-discover DOI from URL if missing
  if (!ref.doi) {
    const discoveredDoi = extractDoiFromUrl(ref.url);
    if (discoveredDoi) {
      ref.doi = discoveredDoi;
      changed = true;
    }
  }

  const isMissingAuthors = !ref.authors || !Array.isArray(ref.authors) || ref.authors.length === 0;
  const hasAbbr = Array.isArray(ref.authors) && ref.authors.some((a) => isAbbreviatedFirstName(a.name));
  const hasLegacyAuthor = typeof ref.author === 'string';

  if (!isMissingAuthors && !hasAbbr && !hasLegacyAuthor && !forceAll) {
    // Just ensure author format & organization tags are clean
    if (Array.isArray(ref.authors)) {
      const formatted = ref.authors.map(formatAuthorEntry);
      const differs = formatted.some((a, idx) => {
        const orig = ref.authors![idx];
        return a.name !== orig.name || a.type !== orig.type || a.id !== orig.id;
      });
      if (differs) {
        ref.authors = formatted;
        changed = true;
      }
    }
    return changed;
  }

  // 1. Check for arXiv
  const arxivId = extractArxivId(ref.doi, ref.url);
  if (arxivId) {
    process.stdout.write(`Querying arXiv (${arxivId})... `);
    const arxivAuthors = await fetchArxivAuthors(arxivId);
    if (arxivAuthors && arxivAuthors.length > 0) {
      console.log(`✅ Found ${arxivAuthors.length} author(s)`);
      ref.authors = arxivAuthors;
      delete ref.author;
      return true;
    }
    console.log(`⚠️ No arXiv records found.`);
  }

  // 2. Check for DOI (Crossref + OpenAlex)
  if (ref.doi && !ref.doi.includes('10.48550/arXiv')) {
    process.stdout.write(`Querying Crossref DOI (${ref.doi})... `);
    let resolved = await fetchCrossrefAuthors(ref.doi);
    if (resolved && resolved.length > 0) {
      console.log(`✅ Crossref: ${resolved.length} author(s)`);
      const stillAbbr = resolved.some((a) => isAbbreviatedFirstName(a.name));
      if (stillAbbr) {
        process.stdout.write(`Enriching via OpenAlex for full first names... `);
        const openAlexAuthors = await fetchOpenAlexAuthors(ref.doi);
        if (openAlexAuthors && openAlexAuthors.length > 0) {
          const better = openAlexAuthors.some((a) => !isAbbreviatedFirstName(a.name));
          if (better) {
            console.log(`✅ Enriched ${openAlexAuthors.length} author(s)`);
            resolved = openAlexAuthors;
          } else {
            console.log(`ℹ️ OpenAlex has same initials.`);
          }
        } else {
          console.log(`ℹ️ OpenAlex not available.`);
        }
      }
      ref.authors = resolved;
      delete ref.author;
      return true;
    } else {
      console.log(`⚠️ No Crossref records found.`);
      process.stdout.write(`Falling back to OpenAlex DOI (${ref.doi})... `);
      const openAlexAuthors = await fetchOpenAlexAuthors(ref.doi);
      if (openAlexAuthors && openAlexAuthors.length > 0) {
        console.log(`✅ Found ${openAlexAuthors.length} author(s)`);
        ref.authors = openAlexAuthors;
        delete ref.author;
        return true;
      }
      console.log(`⚠️ No OpenAlex records found.`);
    }
  }

  // 3. Fallback: format existing authors
  if (Array.isArray(ref.authors) && ref.authors.length > 0) {
    const formatted = ref.authors.map(formatAuthorEntry);
    const differs = formatted.some((a, idx) => {
      const orig = ref.authors![idx];
      return a.name !== orig.name || a.type !== orig.type || a.id !== orig.id;
    });
    if (differs) {
      ref.authors = formatted;
      delete ref.author;
      return true;
    }
  }

  if (ref.author) {
    delete ref.author;
    changed = true;
  }

  return changed;
}

async function run() {
  const isAll = process.argv.includes('--all') || process.argv.includes('--doi-only');
  const targetFileArg = process.argv.find((arg) => arg.startsWith('--file='));
  const targetFile = targetFileArg ? targetFileArg.split('=')[1] : null;

  console.log('='.repeat(80));
  console.log('🚀 CITATION RESOLVER: Multi-Source Author Discovery (arXiv, Crossref, OpenAlex, SSRN, NBER)');
  console.log('='.repeat(80));

  let files: string[] = [];
  if (targetFile) {
    const absPath = path.resolve(targetFile);
    if (!fs.existsSync(absPath)) {
      console.error(`Error: Specified file not found: ${targetFile}`);
      process.exit(1);
    }
    files = [absPath];
  } else {
    const postFiles = scanDir(path.resolve('src/content/posts'), ['.md', '.mdx']);
    const presFiles = scanDir(path.resolve('src/content/presentations'), ['.md', '.mdx']);
    files = [...postFiles, ...presFiles];
  }

  let resolvedCount = 0;
  let updatedFilesCount = 0;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---([\s\S]*)$/);
    if (!match) continue;

    const frontmatterStr = match[1];
    const body = match[2];
    let data: FrontmatterDoc;
    try {
      data = YAML.parse(frontmatterStr);
    } catch {
      continue;
    }

    if (!Array.isArray(data.references) || data.references.length === 0) continue;

    let fileModified = false;
    for (const ref of data.references) {
      const modified = await resolveReference(ref, isAll);
      if (modified) {
        fileModified = true;
        resolvedCount++;
      }
    }

    if (fileModified) {
      const newFm = YAML.stringify(data, { indent: 2, lineWidth: 0 });
      const newContent = `---\n${newFm}---${body}`;
      fs.writeFileSync(file, newContent, 'utf8');
      updatedFilesCount++;
    }
  }

  console.log('='.repeat(80));
  console.log(`Summary: Resolved / updated ${resolvedCount} reference(s) across ${updatedFilesCount} file(s).`);
  console.log('='.repeat(80));
}

run();
