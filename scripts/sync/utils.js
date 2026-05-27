import fs from 'fs';
import path from 'path';

// Load environment variables from local .env files
export function loadEnv() {
  for (const envFile of ['.env', '.env.local', '.env.development']) {
    const envPath = path.resolve(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let val = match[2] || '';
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

// Clear a directory and make sure it exists
export function clearAndCreateDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
  fs.mkdirSync(dirPath, { recursive: true });
}

// Search destDir for a file named "image.<ext>"
export function findExistingImage(destDir) {
  if (!fs.existsSync(destDir)) return null;
  const files = fs.readdirSync(destDir);
  const found = files.find(f => f.startsWith("image."));
  if (found) {
    return path.extname(found);
  }
  return null;
}

// Download image to destDir as image.<ext>
export async function downloadImage(url, destDir) {
  try {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const existingExt = findExistingImage(destDir);
    if (existingExt) {
      return existingExt;
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) {
      console.warn(`⚠️ Failed to download image from ${url}: Status ${res.status}`);
      return null;
    }
    const contentType = res.headers.get("content-type");
    let ext = ".jpg";
    if (contentType) {
      if (contentType.includes("image/png")) ext = ".png";
      else if (contentType.includes("image/webp")) ext = ".webp";
      else if (contentType.includes("image/gif")) ext = ".gif";
      else if (contentType.includes("image/svg+xml")) ext = ".svg";
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(path.join(destDir, `image${ext}`), buffer);
    return ext;
  } catch (err) {
    console.warn(`⚠️ Error downloading image ${url}: ${err.message || err}`);
    return null;
  }
}

// Helper: Slugify text
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Helper: Parse frontmatter and body
export function parseMarkdown(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content, hasFrontmatter: false };
  const fmText = match[1];
  const body = match[2];
  const frontmatter = {};
  for (const line of fmText.split('\n')) {
    const idx = line.indexOf(':');
    if (idx !== -1) {
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      const isQuoted = (val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"));
      if (isQuoted) {
        val = val.slice(1, -1);
      }

      let parsedVal = val;
      if (val === 'null') {
        parsedVal = null;
      } else if (val === 'true') {
        parsedVal = true;
      } else if (val === 'false') {
        parsedVal = false;
      } else if (/^\d+$/.test(val)) {
        if (key !== 'id') {
          parsedVal = parseInt(val, 10);
        }
      } else if (/^\d+\.\d+$/.test(val)) {
        if (key !== 'id') {
          parsedVal = parseFloat(val);
        }
      }
      frontmatter[key] = parsedVal;
    }
  }
  return { frontmatter, body, hasFrontmatter: true };
}

// Helper: Stringify frontmatter and body
export function stringifyMarkdown(frontmatter, body) {
  const fmLines = [];
  for (const [key, val] of Object.entries(frontmatter)) {
    if (val === null || val === undefined) {
      fmLines.push(`${key}: null`);
    } else if (typeof val === 'string') {
      fmLines.push(`${key}: ${JSON.stringify(val)}`);
    } else {
      fmLines.push(`${key}: ${val}`);
    }
  }
  const trimmedBody = body.trimStart();
  return `---\n${fmLines.join('\n')}\n---\n${trimmedBody}`;
}

// Helper: Merge new metrics/fields into frontmatter of an existing file
export function mergeFrontmatter(filePath, newFields) {
  if (!fs.existsSync(filePath)) return false;
  const { frontmatter, body } = parseMarkdown(filePath);
  const mergedFrontmatter = { ...frontmatter, ...newFields };
  const newContent = stringifyMarkdown(mergedFrontmatter, body);
  fs.writeFileSync(filePath, newContent, 'utf8');
  return true;
}

// Helper: Scan collection directory and find index.md file matching target platform ID
export function findFileByPlatformId(collectionDir, platformId) {
  if (!fs.existsSync(collectionDir)) return null;
  const folders = fs.readdirSync(collectionDir).filter(f => fs.statSync(path.join(collectionDir, f)).isDirectory());
  for (const folder of folders) {
    const indexPath = path.join(collectionDir, folder, 'index.md');
    if (fs.existsSync(indexPath)) {
      const { frontmatter } = parseMarkdown(indexPath);
      if (frontmatter.id === platformId) {
        return indexPath;
      }
    }
  }
  return null;
}
