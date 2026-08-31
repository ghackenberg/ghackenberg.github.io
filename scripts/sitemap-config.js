// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

/**
 * Builds a map of normalized relative file paths to their latest Git commit Date.
 * @returns {Map<string, Date>}
 */
function getGitCommitDateMap() {
  const fileDateMap = new Map();
  try {
    const gitLog = execSync('git log --name-status --format="commit %cI"', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 50 * 1024 * 1024
    });

    let currentCommitDate = null;
    const lines = gitLog.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('commit ')) {
        const dateStr = trimmed.substring(7).trim();
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
          currentCommitDate = parsedDate;
        } else {
          currentCommitDate = null;
        }
      } else if (currentCommitDate) {
        // Line format: "M\tpath/to/file" or "A\tpath/to/file"
        const parts = trimmed.split(/\t+/);
        const filePath = parts[parts.length - 1]?.trim().replace(/\\/g, '/');
        if (filePath && !fileDateMap.has(filePath)) {
          fileDateMap.set(filePath, currentCommitDate);
        }
      }
    }
  } catch (error) {
    // If git is unavailable or errors, fallback gracefully
    console.warn('[sitemap] Failed to retrieve Git commit timestamps, falling back to file stats.');
  }
  return fileDateMap;
}

/**
 * Get latest Git commit date for a file or directory.
 * @param {string} relativePath
 * @param {Map<string, Date>} gitMap
 * @returns {Date | null}
 */
function getLatestGitDate(relativePath, gitMap) {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (gitMap.has(normalized)) {
    return gitMap.get(normalized) || null;
  }

  // Directory match: find latest commit among all files in directory
  let latest = null;
  const prefix = normalized.endsWith('/') ? normalized : `${normalized}/`;
  for (const [filePath, date] of gitMap.entries()) {
    if (filePath.startsWith(prefix)) {
      if (!latest || date > latest) {
        latest = date;
      }
    }
  }

  return latest;
}

/**
 * Parses frontmatter YAML block without heavy dependencies.
 * @param {string} content
 * @returns {Record<string, any>}
 */
function parseSimpleFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const yaml = match[1];
  /** @type {Record<string, any>} */
  const result = {};

  const lines = yaml.split('\n');
  let currentKey = '';
  let inArray = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line || line.trim().startsWith('#')) continue;

    if (line.startsWith('  - ') || line.startsWith('- ')) {
      if (inArray && currentKey) {
        const itemVal = line.replace(/^[\s]*- /, '').trim().replace(/^["']|["']$/g, '');
        result[currentKey].push(itemVal);
      }
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();

      if (val === '' || val === '[]') {
        currentKey = key;
        inArray = true;
        result[key] = [];
      } else if (val.startsWith('[') && val.endsWith(']')) {
        currentKey = key;
        inArray = false;
        result[key] = val
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean);
      } else {
        currentKey = key;
        inArray = false;
        result[key] = val.replace(/^["']|["']$/g, '');
      }
    }
  }
  return result;
}

/**
 * Extracts a Date from frontmatter or folder name or git log.
 * @param {string} id
 * @param {string | undefined} pubDateStr
 * @param {Date | null} gitDate
 * @param {Date | null} fileMtime
 * @returns {Date}
 */
function resolveItemDate(id, pubDateStr, gitDate, fileMtime) {
  let pubDate = null;

  if (pubDateStr) {
    // Try folder timestamp prefix if pubDate is fuzzy string
    const folderMatch = id.match(/^(\d{4})_(\d{2})(?:_(\d{2}))?/);
    if (folderMatch) {
      const year = parseInt(folderMatch[1], 10);
      const month = parseInt(folderMatch[2], 10) - 1;
      const day = folderMatch[3] ? parseInt(folderMatch[3], 10) : 1;
      pubDate = new Date(Date.UTC(year, month, day));
    } else {
      const parsed = new Date(pubDateStr);
      if (!isNaN(parsed.getTime())) {
        pubDate = parsed;
      }
    }
  }

  // If no pubDate from frontmatter, check folder ID prefix
  if (!pubDate) {
    const folderMatch = id.match(/^(\d{4})_(\d{2})(?:_(\d{2}))?/);
    if (folderMatch) {
      const year = parseInt(folderMatch[1], 10);
      const month = parseInt(folderMatch[2], 10) - 1;
      const day = folderMatch[3] ? parseInt(folderMatch[3], 10) : 1;
      pubDate = new Date(Date.UTC(year, month, day));
    }
  }

  const validTimestamps = [pubDate, gitDate, fileMtime]
    .map((d) => (d instanceof Date && !isNaN(d.getTime()) ? d.getTime() : null))
    .filter((t) => t !== null);


  if (validTimestamps.length === 0) {
    return new Date();
  }

  // Return the latest known timestamp for the content
  return new Date(Math.max(...validTimestamps));

}

/**
 * @typedef {{
 *   lastmod: Date;
 *   changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
 *   priority: number;
 * }} PageMetadata
 */

/**
 * Scans content and builds comprehensive metadata table for all site pages.
 * @returns {{
 *   metaMap: Map<string, PageMetadata>;
 *   getMetadataForPath: (pathname: string) => PageMetadata;
 * }}
 */
export function buildSitemapMetadata() {
  const gitMap = getGitCommitDateMap();
  /** @type {Map<string, PageMetadata>} */
  const metaMap = new Map();

  /** @type {Date[]} */
  const allDates = [];
  /** @type {Record<string, Date[]>} */
  const sectionDates = {
    posts: [],
    courses: [],
    publications: [],
    projects: [],
    services: [],
    visualizations: []
  };
  /** @type {Map<string, Date[]>} */
  const postTagDates = new Map();
  /** @type {Map<string, Date[]>} */
  const publicationTagDates = new Map();

  const contentBase = path.resolve('src/content');

  // 1. Posts
  const postsDir = path.join(contentBase, 'posts');
  if (fs.existsSync(postsDir)) {
    const postFolders = fs.readdirSync(postsDir);
    for (const folder of postFolders) {
      const folderPath = path.join(postsDir, folder);
      if (!fs.statSync(folderPath).isDirectory()) continue;
      const mdFile = path.join(folderPath, 'index.md');
      const mdxFile = path.join(folderPath, 'index.mdx');
      const targetFile = fs.existsSync(mdFile) ? mdFile : fs.existsSync(mdxFile) ? mdxFile : null;
      if (!targetFile) continue;

      const content = fs.readFileSync(targetFile, 'utf8');
      const frontmatter = parseSimpleFrontmatter(content);
      const gitDate = getLatestGitDate(`src/content/posts/${folder}`, gitMap);
      const fileMtime = fs.statSync(targetFile).mtime;

      const date = resolveItemDate(folder, frontmatter.pubDate, gitDate, fileMtime);
      allDates.push(date);
      sectionDates.posts.push(date);

      metaMap.set(`/posts/${folder}/`, {
        lastmod: date,
        changefreq: 'monthly',
        priority: 0.7
      });

      // Tags
      const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
      for (const tag of tags) {
        const normTag = String(tag).toLowerCase();
        if (!postTagDates.has(normTag)) postTagDates.set(normTag, []);
        postTagDates.get(normTag)?.push(date);
      }
    }
  }

  // 2. Courses
  const coursesDir = path.join(contentBase, 'courses');
  if (fs.existsSync(coursesDir)) {
    const courseFolders = fs.readdirSync(coursesDir);
    for (const folder of courseFolders) {
      const folderPath = path.join(coursesDir, folder);
      if (!fs.statSync(folderPath).isDirectory()) continue;
      const targetFile = path.join(folderPath, 'index.md');
      if (!fs.existsSync(targetFile)) continue;

      const content = fs.readFileSync(targetFile, 'utf8');
      const frontmatter = parseSimpleFrontmatter(content);
      const gitDate = getLatestGitDate(`src/content/courses/${folder}`, gitMap);
      const fileMtime = fs.statSync(targetFile).mtime;

      const date = resolveItemDate(folder, frontmatter.pubDate, gitDate, fileMtime);
      allDates.push(date);
      sectionDates.courses.push(date);

      metaMap.set(`/courses/${folder}/`, {
        lastmod: date,
        changefreq: 'monthly',
        priority: 0.7
      });
    }
  }

  // 3. Publications
  const pubsDir = path.join(contentBase, 'publications');
  if (fs.existsSync(pubsDir)) {
    const pubFolders = fs.readdirSync(pubsDir);
    for (const folder of pubFolders) {
      const folderPath = path.join(pubsDir, folder);
      if (!fs.statSync(folderPath).isDirectory()) continue;
      const targetFile = path.join(folderPath, 'index.md');
      if (!fs.existsSync(targetFile)) continue;

      const content = fs.readFileSync(targetFile, 'utf8');
      const frontmatter = parseSimpleFrontmatter(content);
      const gitDate = getLatestGitDate(`src/content/publications/${folder}`, gitMap);
      const fileMtime = fs.statSync(targetFile).mtime;

      const date = resolveItemDate(folder, frontmatter.pubDate, gitDate, fileMtime);
      allDates.push(date);
      sectionDates.publications.push(date);

      metaMap.set(`/publications/${folder}/`, {
        lastmod: date,
        changefreq: 'monthly',
        priority: 0.7
      });

      const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
      for (const tag of tags) {
        const normTag = String(tag).toLowerCase();
        if (!publicationTagDates.has(normTag)) publicationTagDates.set(normTag, []);
        publicationTagDates.get(normTag)?.push(date);
      }
    }
  }

  // 4. Projects
  const projectsDir = path.join(contentBase, 'projects');
  if (fs.existsSync(projectsDir)) {
    const projectFolders = fs.readdirSync(projectsDir);
    for (const folder of projectFolders) {
      const folderPath = path.join(projectsDir, folder);
      if (!fs.statSync(folderPath).isDirectory()) continue;
      const targetFile = path.join(folderPath, 'index.md');
      if (!fs.existsSync(targetFile)) continue;

      const content = fs.readFileSync(targetFile, 'utf8');
      const frontmatter = parseSimpleFrontmatter(content);
      const gitDate = getLatestGitDate(`src/content/projects/${folder}`, gitMap);
      const fileMtime = fs.statSync(targetFile).mtime;

      const date = resolveItemDate(folder, frontmatter.pubDate, gitDate, fileMtime);
      allDates.push(date);
      sectionDates.projects.push(date);

      metaMap.set(`/projects/${folder}/`, {
        lastmod: date,
        changefreq: 'monthly',
        priority: 0.7
      });
    }
  }

  // 5. Visualizations
  const visDir = path.join(contentBase, 'visualizations');
  if (fs.existsSync(visDir)) {
    const visFolders = fs.readdirSync(visDir);
    for (const folder of visFolders) {
      const folderPath = path.join(visDir, folder);
      if (!fs.statSync(folderPath).isDirectory()) continue;
      const targetFile = path.join(folderPath, 'index.md');
      if (!fs.existsSync(targetFile)) continue;

      const content = fs.readFileSync(targetFile, 'utf8');
      const frontmatter = parseSimpleFrontmatter(content);
      const gitDate = getLatestGitDate(`src/content/visualizations/${folder}`, gitMap);
      const fileMtime = fs.statSync(targetFile).mtime;

      const date = resolveItemDate(folder, frontmatter.pubDate, gitDate, fileMtime);
      allDates.push(date);
      sectionDates.visualizations.push(date);

      metaMap.set(`/visualizations/${folder}/`, {
        lastmod: date,
        changefreq: 'monthly',
        priority: 0.7
      });
    }
  }

  // 6. Services & Modules
  const servicesDir = path.join(contentBase, 'services');
  if (fs.existsSync(servicesDir)) {
    const serviceFolders = fs.readdirSync(servicesDir);
    for (const folder of serviceFolders) {
      const folderPath = path.join(servicesDir, folder);
      if (!fs.statSync(folderPath).isDirectory()) continue;
      const targetFile = path.join(folderPath, 'index.md');
      if (fs.existsSync(targetFile)) {
        const content = fs.readFileSync(targetFile, 'utf8');
        const frontmatter = parseSimpleFrontmatter(content);
        const gitDate = getLatestGitDate(`src/content/services/${folder}`, gitMap);
        const fileMtime = fs.statSync(targetFile).mtime;

        const date = resolveItemDate(folder, frontmatter.pubDate, gitDate, fileMtime);
        allDates.push(date);
        sectionDates.services.push(date);

        metaMap.set(`/services/${folder}/`, {
          lastmod: date,
          changefreq: 'monthly',
          priority: 0.7
        });
      }

      // Check submodules
      const modulesDir = path.join(folderPath, 'modules');
      if (fs.existsSync(modulesDir) && fs.statSync(modulesDir).isDirectory()) {
        const moduleFolders = fs.readdirSync(modulesDir);
        for (const modFolder of moduleFolders) {
          const modPath = path.join(modulesDir, modFolder);
          if (!fs.statSync(modPath).isDirectory()) continue;
          const modFile = path.join(modPath, 'index.md');
          if (!fs.existsSync(modFile)) continue;

          const content = fs.readFileSync(modFile, 'utf8');
          const frontmatter = parseSimpleFrontmatter(content);
          const gitDate = getLatestGitDate(`src/content/services/${folder}/modules/${modFolder}`, gitMap);
          const fileMtime = fs.statSync(modFile).mtime;

          const date = resolveItemDate(modFolder, frontmatter.pubDate, gitDate, fileMtime);
          allDates.push(date);
          sectionDates.services.push(date);

          metaMap.set(`/services/${folder}/${modFolder}/`, {
            lastmod: date,
            changefreq: 'monthly',
            priority: 0.7
          });
        }
      }
    }
  }

  // 7. Static / Legal Pages
  const impressumPath = path.resolve('src/pages/impressum.astro');
  const impressumDate = getLatestGitDate('src/pages/impressum.astro', gitMap) || (fs.existsSync(impressumPath) ? fs.statSync(impressumPath).mtime : new Date());
  metaMap.set('/impressum/', {
    lastmod: impressumDate,
    changefreq: 'yearly',
    priority: 0.3
  });

  const datenschutzPath = path.resolve('src/pages/datenschutz.astro');
  const datenschutzDate = getLatestGitDate('src/pages/datenschutz.astro', gitMap) || (fs.existsSync(datenschutzPath) ? fs.statSync(datenschutzPath).mtime : new Date());
  metaMap.set('/datenschutz/', {
    lastmod: datenschutzDate,
    changefreq: 'yearly',
    priority: 0.3
  });

  // Global maximum date across all content
  const maxSiteDate = allDates.length > 0 ? new Date(Math.max(...allDates.map((d) => d.getTime()))) : new Date();

  // Root / Homepage
  const indexGitDate = getLatestGitDate('src/pages/index.astro', gitMap);
  const homeDate = indexGitDate && indexGitDate > maxSiteDate ? indexGitDate : maxSiteDate;
  metaMap.set('/', {
    lastmod: homeDate,
    changefreq: 'weekly',
    priority: 1.0
  });


  // Calculate section maximums for Hub pages
  /**
   * @param {Date[]} dates
   * @returns {Date}
   */
  const getMaxDate = (dates) => (dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : maxSiteDate);

  const postsMaxDate = getMaxDate(sectionDates.posts);
  const coursesMaxDate = getMaxDate(sectionDates.courses);
  const publicationsMaxDate = getMaxDate(sectionDates.publications);
  const projectsMaxDate = getMaxDate(sectionDates.projects);
  const servicesMaxDate = getMaxDate(sectionDates.services);
  const visualizationsMaxDate = getMaxDate(sectionDates.visualizations);

  metaMap.set('/posts/', { lastmod: postsMaxDate, changefreq: 'weekly', priority: 0.8 });
  metaMap.set('/courses/', { lastmod: coursesMaxDate, changefreq: 'weekly', priority: 0.8 });
  metaMap.set('/publications/', { lastmod: publicationsMaxDate, changefreq: 'weekly', priority: 0.8 });
  metaMap.set('/projects/', { lastmod: projectsMaxDate, changefreq: 'weekly', priority: 0.8 });
  metaMap.set('/services/', { lastmod: servicesMaxDate, changefreq: 'weekly', priority: 0.8 });
  metaMap.set('/visualizations/', { lastmod: visualizationsMaxDate, changefreq: 'weekly', priority: 0.8 });

  /**
   * Helper to match any pathname to its best metadata entry
   * @param {string} rawPathname
   * @returns {PageMetadata}
   */
  function getMetadataForPath(rawPathname) {
    let pathname = rawPathname;
    if (!pathname.startsWith('/')) pathname = `/${pathname}`;
    if (!pathname.endsWith('/')) pathname = `${pathname}/`;

    if (metaMap.has(pathname)) {
      return /** @type {PageMetadata} */ (metaMap.get(pathname));
    }

    // Check pagination: /posts/2/, /posts/3/, etc.
    if (pathname.startsWith('/posts/') && /^\/posts\/\d+\/$/.test(pathname)) {
      return { lastmod: postsMaxDate, changefreq: 'weekly', priority: 0.7 };
    }

    // Check post tags: /posts/tags/[tag]/ or /posts/tags/[tag]/2/
    const postTagMatch = pathname.match(/^\/posts\/tags\/([^/]+)/);
    if (postTagMatch) {
      const tag = decodeURIComponent(postTagMatch[1]).toLowerCase();
      const tagDates = postTagDates.get(tag) || [];
      const tagDate = getMaxDate(tagDates);
      return { lastmod: tagDate, changefreq: 'weekly', priority: 0.6 };
    }

    // Check publication tags: /publications/tags/[tag]/
    const pubTagMatch = pathname.match(/^\/publications\/tags\/([^/]+)/);
    if (pubTagMatch) {
      const tag = decodeURIComponent(pubTagMatch[1]).toLowerCase();
      const tagDates = publicationTagDates.get(tag) || [];
      const tagDate = getMaxDate(tagDates);
      return { lastmod: tagDate, changefreq: 'monthly', priority: 0.6 };
    }

    // Fallbacks based on category prefix
    if (pathname.startsWith('/posts/')) return { lastmod: postsMaxDate, changefreq: 'monthly', priority: 0.7 };
    if (pathname.startsWith('/courses/')) return { lastmod: coursesMaxDate, changefreq: 'monthly', priority: 0.7 };
    if (pathname.startsWith('/publications/')) return { lastmod: publicationsMaxDate, changefreq: 'monthly', priority: 0.7 };
    if (pathname.startsWith('/projects/')) return { lastmod: projectsMaxDate, changefreq: 'monthly', priority: 0.7 };
    if (pathname.startsWith('/services/')) return { lastmod: servicesMaxDate, changefreq: 'monthly', priority: 0.7 };
    if (pathname.startsWith('/visualizations/')) return { lastmod: visualizationsMaxDate, changefreq: 'monthly', priority: 0.7 };

    return {
      lastmod: maxSiteDate,
      changefreq: 'monthly',
      priority: 0.5
    };
  }

  return {
    metaMap,
    getMetadataForPath
  };
}
