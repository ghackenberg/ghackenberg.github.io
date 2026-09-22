// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

/**
 * Extracts YAML frontmatter fields from markdown/mdx content
 * @param {string} content
 * @returns {Record<string, string>}
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const yamlText = match[1];
  /** @type {Record<string, string>} */
  const result = {};

  const lines = yamlText.split('\n');
  let currentKey = '';
  let currentValue = '';
  let inMultiline = false;

  for (const line of lines) {
    if (inMultiline) {
      if (/^\s{2,}/.test(line) || line.trim() === '') {
        currentValue += ' ' + line.trim();
        continue;
      } else {
        result[currentKey] = currentValue.trim();
        inMultiline = false;
      }
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1 && !inMultiline) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      if (val === '>' || val === '|' || val === '') {
        currentKey = key;
        currentValue = '';
        inMultiline = true;
      } else {
        result[key] = val.replace(/^["']|["']$/g, '');
      }
    }
  }

  if (inMultiline && currentKey) {
    result[currentKey] = currentValue.trim();
  }

  return result;
}

/**
 * Transforms clean text into pronunciation-optimized text for TTS synthesis.
 * Applies acronym expansions (e.g. RAG -> R-A-G) and phonetic transcriptions (e.g. Snapshot -> Snäpschott).
 * @param {string} text
 * @param {{ acronyms?: Record<string, string>; phonetics?: Record<string, string> }} lexicon
 * @returns {string}
 */
function applyLexicon(text, lexicon) {
  if (!text) return '';
  let result = text;

  const allMappings = {
    ...(lexicon.phonetics || {}),
    ...(lexicon.acronyms || {})
  };

  const sortedKeys = Object.keys(allMappings).sort((a, b) => b.length - a.length);

  for (const term of sortedKeys) {
    const replacement = allMappings[term];
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'gu');
    result = result.replace(regex, replacement);
  }

  return result;
}

/**
 * Strips cue tags to obtain clean text
 * @param {string} voiceover
 * @returns {string}
 */
function extractCleanText(voiceover) {
  return (voiceover || '').replace(/\{cue:[^}]+\}|\{\/cue\}/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Validates slide frontmatter, cue consistency, audio sync, orphan assets, and PDF handouts
 */
function validateSlides() {
  const presentationsBase = path.resolve('src/content/presentations');
  if (!fs.existsSync(presentationsBase)) {
    console.log('[Slide Validator] No presentations found in src/content/presentations.');
    return;
  }

  let totalErrors = 0;
  let totalWarnings = 0;
  let totalSlides = 0;

  const presentationFolders = fs.readdirSync(presentationsBase);

  const lexiconPath = path.resolve('src/content/presentations/tts-lexicon.json');
  /** @type {{ acronyms: Record<string, string>; phonetics: Record<string, string> }} */
  let lexicon = { acronyms: {}, phonetics: {} };
  if (fs.existsSync(lexiconPath)) {
    try {
      lexicon = JSON.parse(fs.readFileSync(lexiconPath, 'utf8'));
    } catch {}
  }
  const GENERATOR_VERSION = 'v3-spoken';

  for (const presentationFolder of presentationFolders) {
    const presentationPath = path.join(presentationsBase, presentationFolder);
    if (!fs.statSync(presentationPath).isDirectory()) continue;

    const slidesDir = path.join(presentationPath, 'slides');
    if (!fs.existsSync(slidesDir)) continue;

    const audioDir = path.join(presentationPath, 'audio');
    const cacheFile = path.join(audioDir, '.cache.json');
    /** @type {Record<string, string>} */
    let audioCache = {};
    if (fs.existsSync(cacheFile)) {
      try {
        audioCache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      } catch {
        audioCache = {};
      }
    }

    const slideFiles = fs.readdirSync(slidesDir)
      .filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
      .sort();

    console.log(`\n[Slide Validator] Checking presentation: "${presentationFolder}" (${slideFiles.length} slides)`);

    /** @type {Set<string>} */
    const activeSlideIds = new Set();

    for (const slideFile of slideFiles) {
      totalSlides++;
      const slideId = slideFile.replace(/\.(md|mdx)$/, '');
      activeSlideIds.add(slideId);

      const slidePath = path.join(slidesDir, slideFile);
      const content = fs.readFileSync(slidePath, 'utf8');

      // Check for frontmatter
      const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!fmMatch) {
        console.error(`  ❌ [${slideFile}] Missing YAML frontmatter.`);
        totalErrors++;
        continue;
      }

      const fm = fmMatch[1];
      const body = content.slice(fmMatch[0].length);

      // Check required fields
      const hasTitle = /^title:/m.test(fm);
      const hasVoiceover = /^voiceover:/m.test(fm);
      const hasNotes = /^notes:/m.test(fm);

      if (!hasTitle) {
        console.error(`  ❌ [${slideFile}] Missing required "title" in frontmatter.`);
        totalErrors++;
      }
      if (!hasVoiceover) {
        console.error(`  ❌ [${slideFile}] Missing required "voiceover" script in frontmatter.`);
        totalErrors++;
      }
      if (!hasNotes) {
        console.warn(`  ⚠️ [${slideFile}] Missing "notes" for presenter mode.`);
        totalWarnings++;
      }

      // Extract voiceover script content
      const parsedFm = parseFrontmatter(content);
      const voiceoverText = parsedFm.voiceover || '';

      // Check for unregistered technical acronyms in voiceover
      const cleanVoiceover = voiceoverText.replace(/\{cue:[^}]+\}|\{\/cue\}/g, '');
      const potentialAcronyms = cleanVoiceover.match(/\b[A-Z]{2,}\b/g) || [];
      const knownExceptions = new Set(['OK', 'II', 'III', 'IV', 'VI', 'VII', 'VIII', 'IX']);
      for (const acr of potentialAcronyms) {
        if (!lexicon.acronyms[acr] && !lexicon.phonetics[acr] && !knownExceptions.has(acr)) {
          console.warn(`  ⚠️ [${slideFile}] Unregistered acronym "${acr}" found in voiceover. Consider adding it to "src/content/presentations/tts-lexicon.json" for consistent TTS pronunciation.`);
          totalWarnings++;
        }
      }

      // 1. Extract voiceover cues in sequence
      /** @type {string[]} */
      const voCues = [];
      const voCueRegex = /\{cue:([a-zA-Z0-9_-]+)(?::[a-zA-Z0-9_-]+)?\}/g;
      let voMatchItem;
      while ((voMatchItem = voCueRegex.exec(voiceoverText)) !== null) {
        voCues.push(voMatchItem[1]);
      }

      // 2. Extract slide body cues in order of visual appearance
      /** @type {string[]} */
      const bodyCues = [];
      const bodyCueRegex = /(?:(?:cue|data-cue)\s*[:=]\s*["']([a-zA-Z0-9_-]+)["']|id\s*[:=]\s*["']((?:col|box|card|step|stat|hl|mark)-[a-zA-Z0-9_-]+)["']|\{cue:([a-zA-Z0-9_-]+)(?::[a-zA-Z0-9_-]+)?\})/g;
      
      let bodyMatch;
      while ((bodyMatch = bodyCueRegex.exec(body)) !== null) {
        const cueId = bodyMatch[1] || bodyMatch[2] || bodyMatch[3];
        if (cueId && !bodyCues.includes(cueId)) {
          bodyCues.push(cueId);
        }
      }

      // 3. Completeness check: all VO cues must be in Body
      for (const cueId of voCues) {
        if (!bodyCues.includes(cueId)) {
          console.error(`  ❌ [${slideFile}] Voiceover cue "{cue:${cueId}}" has no matching target in slide body.`);
          totalErrors++;
        }
      }

      // 4. Completeness check: all Body cues should be referenced in Voiceover
      for (const cueId of bodyCues) {
        if (!voCues.includes(cueId)) {
          console.warn(`  ⚠️ [${slideFile}] Body cue "${cueId}" is never referenced in voiceover.`);
          totalWarnings++;
        }
      }

      // 4b. Subelement Cue Prohibition check: only large content blocks may have block cues
      const bulletListBlocks = body.match(/<BulletList[\s\S]*?\/>/g) || [];
      for (const bl of bulletListBlocks) {
        if (/\bcue\s*:\s*["'][^"']+["']/.test(bl)) {
          console.error(`  ❌ [${slideFile}] Subelement cue detected in BulletList items. Subelements must not be faded in; use inline text-highlights {cue:...}text{/cue} within item titles/descriptions instead.`);
          totalErrors++;
        }
      }
      if (/<CalloutBox[^>]*\bcue\s*=/g.test(body)) {
        console.error(`  ❌ [${slideFile}] Subelement cue detected on <CalloutBox>. Subelements must not be faded in; use inline text-highlights {cue:...}text{/cue} instead.`);
        totalErrors++;
      }
      if (/<EntityGraphVisual[^>]*\b(?:cue|data-cue)\s*=/g.test(body)) {
        console.error(`  ❌ [${slideFile}] Subelement cue detected on <EntityGraphVisual>. Subelements must not be faded in; attach the block cue to the parent BentoCard instead.`);
        totalErrors++;
      }

      // 5. Monotonic sequential order check: VO progression must match visual DOM sequence
      let lastBodyIndex = -1;
      let lastCueId = '';
      for (let i = 0; i < voCues.length; i++) {
        const cueId = voCues[i];
        const bodyIndex = bodyCues.indexOf(cueId);
        if (bodyIndex !== -1) {
          if (bodyIndex < lastBodyIndex) {
            console.error(
              `  ❌ [${slideFile}] Out-of-order cue progression: "{cue:${cueId}}" appears at position ${bodyIndex + 1} in the slide body, but is spoken after "{cue:${lastCueId}}" (body position ${lastBodyIndex + 1}). This causes erratic jumping across the slide and references dimmed elements!`
            );
            totalErrors++;
          }
          lastBodyIndex = bodyIndex;
          lastCueId = cueId;
        }
      }

      // 6. Audio & Cues Synchronization Gate
      if (voiceoverText.trim()) {
        const mp3Path = path.join(audioDir, `${slideId}.mp3`);
        const cuesPath = path.join(audioDir, `${slideId}.cues.json`);

        if (!fs.existsSync(mp3Path)) {
          console.error(`  ❌ [${slideFile}] Missing audio file: "audio/${slideId}.mp3". Run "npm run audio:presentations".`);
          totalErrors++;
        }

        if (!fs.existsSync(cuesPath)) {
          console.error(`  ❌ [${slideFile}] Missing cue timings file: "audio/${slideId}.cues.json". Run "npm run audio:presentations".`);
          totalErrors++;
        } else {
          // Verify that all spoken cues exist in cues.json
          try {
            const cuesData = JSON.parse(fs.readFileSync(cuesPath, 'utf8'));
            for (const cueId of voCues) {
              if (!cuesData[cueId]) {
                console.error(`  ❌ [${slideFile}] Cue "{cue:${cueId}}" is spoken in voiceover but missing in "audio/${slideId}.cues.json". Run "npm run audio:presentations".`);
                totalErrors++;
              }
            }
          } catch {
            console.error(`  ❌ [${slideFile}] Corrupted JSON in "audio/${slideId}.cues.json". Run "npm run audio:presentations".`);
            totalErrors++;
          }
        }

        // Verify that audio is up-to-date with current spoken text via MD5 hash
        const cleanText = extractCleanText(voiceoverText);
        const spokenText = applyLexicon(cleanText, lexicon);
        const expectedHash = crypto.createHash('md5').update(`${GENERATOR_VERSION}:${spokenText}`).digest('hex');
        if (audioCache[slideId] !== expectedHash) {
          console.error(
            `  ❌ [${slideFile}] Audio is out-of-date: Spoken text was modified since last audio synthesis (hash mismatch). Run "npm run audio:presentations".`
          );
          totalErrors++;
        }
      }
    }

    // 7. Backward Audio Orphan Check: Detect leftover .mp3 / .cues.json without matching slide
    if (fs.existsSync(audioDir)) {
      const audioFiles = fs.readdirSync(audioDir);
      for (const file of audioFiles) {
        if (file === '.cache.json') continue;
        const match = file.match(/^(.+?)\.(mp3|cues\.json)$/);
        if (match) {
          const slideId = match[1];
          if (!activeSlideIds.has(slideId)) {
            console.error(`  ❌ [audio-orphan] Orphaned file "audio/${file}" has no matching slide in "slides/". Run "npm run audio:presentations" or delete the file.`);
            totalErrors++;
          }
        }
      }

      // Orphan cache keys
      for (const cachedId of Object.keys(audioCache)) {
        if (!activeSlideIds.has(cachedId)) {
          console.error(`  ❌ [audio-orphan] Orphaned entry "${cachedId}" in "audio/.cache.json" has no matching slide in "slides/". Run "npm run audio:presentations".`);
          totalErrors++;
        }
      }
    }

    // 8. PDF Handouts Existence & Git Up-To-Date Check
    const pdfDarkPath = path.join(presentationPath, 'slides-dark.pdf');
    const pdfLightPath = path.join(presentationPath, 'slides-light.pdf');

    if (!fs.existsSync(pdfDarkPath)) {
      console.error(`  ❌ [pdf] Missing Dark Mode PDF handout: "slides-dark.pdf". Run "npm run export:slides".`);
      totalErrors++;
    }
    if (!fs.existsSync(pdfLightPath)) {
      console.error(`  ❌ [pdf] Missing Light Mode PDF handout: "slides-light.pdf". Run "npm run export:slides".`);
      totalErrors++;
    }

    try {
      const slidesRelPath = path.relative(process.cwd(), slidesDir).replace(/\\/g, '/');
      const pdfDarkRelPath = path.relative(process.cwd(), pdfDarkPath).replace(/\\/g, '/');
      const pdfLightRelPath = path.relative(process.cwd(), pdfLightPath).replace(/\\/g, '/');

      const slidesTimeStr = execSync(`git log -1 --format=%ct -- "${slidesRelPath}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      const pdfDarkTimeStr = execSync(`git log -1 --format=%ct -- "${pdfDarkRelPath}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      const pdfLightTimeStr = execSync(`git log -1 --format=%ct -- "${pdfLightRelPath}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();

      const slidesTime = parseInt(slidesTimeStr, 10);
      const pdfDarkTime = parseInt(pdfDarkTimeStr, 10);
      const pdfLightTime = parseInt(pdfLightTimeStr, 10);

      if (!isNaN(slidesTime) && !isNaN(pdfDarkTime) && slidesTime > pdfDarkTime) {
        console.error(
          `  ❌ [pdf] "slides-dark.pdf" is out-of-date: Slides were modified in commit history after the PDF was committed. Run "npm run export:slides".`
        );
        totalErrors++;
      }
      if (!isNaN(slidesTime) && !isNaN(pdfLightTime) && slidesTime > pdfLightTime) {
        console.error(
          `  ❌ [pdf] "slides-light.pdf" is out-of-date: Slides were modified in commit history after the PDF was committed. Run "npm run export:slides".`
        );
        totalErrors++;
      }

      // Check for uncommitted working tree changes in slides/
      const dirtySlides = execSync(`git status --porcelain -- "${slidesRelPath}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      if (dirtySlides) {
        console.warn(`  ⚠️ [pdf] Slides have uncommitted changes in working tree. Run "npm run export:slides" before committing.`);
        totalWarnings++;
      }
    } catch {
      // Git command failed or not a git repository; skip timestamp check
    }

    // 9. Slide WebP Thumbnails Existence & Freshness Check
    const thumbnailsDir = path.join(presentationPath, 'thumbnails');
    if (!fs.existsSync(thumbnailsDir)) {
      console.error(`  ❌ [thumbnail] Missing "thumbnails/" directory for "${presentationFolder}". Run "npm run export:slides-thumbs".`);
      totalErrors++;
    } else {
      // Check each active slide has a thumbnail
      for (const slideId of activeSlideIds) {
        const thumbPath = path.join(thumbnailsDir, `${slideId}.webp`);
        if (!fs.existsSync(thumbPath)) {
          console.error(`  ❌ [thumbnail] Missing thumbnail for slide "${slideId}": "thumbnails/${slideId}.webp". Run "npm run export:slides-thumbs".`);
          totalErrors++;
        }
      }

      // Check for orphan thumbnails
      const thumbFiles = fs.readdirSync(thumbnailsDir).filter(f => f.endsWith('.webp'));
      for (const tFile of thumbFiles) {
        const tId = tFile.replace(/\.webp$/, '');
        if (!activeSlideIds.has(tId)) {
          console.error(`  ❌ [thumbnail-orphan] Orphaned thumbnail "thumbnails/${tFile}" has no matching slide in "slides/". Run "npm run export:slides-thumbs" or delete the file.`);
          totalErrors++;
        }
      }

      // Check git timestamp freshness
      try {
        const slidesRelPath = path.relative(process.cwd(), slidesDir).replace(/\\/g, '/');
        const thumbsRelPath = path.relative(process.cwd(), thumbnailsDir).replace(/\\/g, '/');

        const slidesTimeStr = execSync(`git log -1 --format=%ct -- "${slidesRelPath}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        const thumbsTimeStr = execSync(`git log -1 --format=%ct -- "${thumbsRelPath}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();

        const slidesTime = parseInt(slidesTimeStr, 10);
        const thumbsTime = parseInt(thumbsTimeStr, 10);

        if (!isNaN(slidesTime) && !isNaN(thumbsTime) && slidesTime > thumbsTime) {
          console.error(
            `  ❌ [thumbnail] Slide thumbnails in "${thumbsRelPath}" are out-of-date: Slides were modified in commit history after thumbnails were committed. Run "npm run export:slides-thumbs".`
          );
          totalErrors++;
        }
      } catch {
        // Git command failed; skip
      }
    }
  }

  if (totalErrors > 0) {
    console.error(`\n[Slide Validator] Validation FAILED with ${totalErrors} error(s) and ${totalWarnings} warning(s) across ${totalSlides} slides.\n`);
    process.exit(1);
  } else {
    console.log(`\n[Slide Validator] Passed! All ${totalSlides} slides, audio assets, cues, and PDF handouts are valid and up-to-date (${totalWarnings} warning(s)).\n`);
  }
}

validateSlides();
