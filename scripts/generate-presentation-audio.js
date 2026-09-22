// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { UniversalCommunicate } from 'edge-tts-universal';

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
 * Loads the central TTS pronunciation and acronym lexicon
 * @returns {{ acronyms: Record<string, string>; phonetics: Record<string, string> }}
 */
function loadTtsLexicon() {
  const lexiconPath = path.resolve('src/content/presentations/tts-lexicon.json');
  if (fs.existsSync(lexiconPath)) {
    try {
      return JSON.parse(fs.readFileSync(lexiconPath, 'utf8'));
    } catch (e) {
      console.warn('[Audio Generator] Warning: Could not parse tts-lexicon.json:', e);
    }
  }
  return { acronyms: {}, phonetics: {} };
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
 * Extracts cues (both point cues and span cues) from text and cleans text for speech synthesis
 * @param {string} rawVoiceover
 * @returns {{
 *   cleanText: string;
 *   cues: Array<{ id: string; startWordIndex: number; endWordIndex?: number }>;
 * }}
 */
/**
 * Normalizes a word for robust acoustic anchor matching.
 * Converts to lowercase and removes all punctuation and symbols.
 * @param {string | undefined} w
 * @returns {string}
 */
function normalizeWord(w) {
  return (w || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * Searches wordBoundaries for the best matching boundary corresponding to targetWord,
 * searching in a window around seedIndex.
 * @param {string | undefined} targetWord
 * @param {number} seedIndex
 * @param {Array<{ offsetSec: number; durationSec: number; text: string }>} wordBoundaries
 * @returns {number}
 */
function findAnchorWordBoundary(targetWord, seedIndex, wordBoundaries) {
  if (!targetWord || wordBoundaries.length === 0) {
    return Math.min(Math.max(0, seedIndex), wordBoundaries.length - 1);
  }

  const targetNorm = normalizeWord(targetWord);
  if (!targetNorm) {
    return Math.min(Math.max(0, seedIndex), wordBoundaries.length - 1);
  }

  const minIdx = Math.max(0, seedIndex - 12);
  const maxIdx = Math.min(wordBoundaries.length, seedIndex + 30);

  let bestIdx = -1;
  let minDistance = Infinity;

  // 1. Exact match on normalized word
  for (let i = minIdx; i < maxIdx; i++) {
    const boundaryNorm = normalizeWord(wordBoundaries[i].text);
    if (boundaryNorm === targetNorm) {
      const dist = Math.abs(i - seedIndex);
      if (dist < minDistance) {
        minDistance = dist;
        bestIdx = i;
      }
    }
  }

  if (bestIdx !== -1) {
    return bestIdx;
  }

  // 2. Prefix or substring match for compound/hyphenated tokens (e.g. "Schema" in "Schema.org")
  for (let i = minIdx; i < maxIdx; i++) {
    const boundaryNorm = normalizeWord(wordBoundaries[i].text);
    if (boundaryNorm && (targetNorm.startsWith(boundaryNorm) || boundaryNorm.startsWith(targetNorm))) {
      const dist = Math.abs(i - seedIndex);
      if (dist < minDistance) {
        minDistance = dist;
        bestIdx = i;
      }
    }
  }

  if (bestIdx !== -1) {
    return bestIdx;
  }

  // 3. Fallback to seed index
  return Math.min(Math.max(0, seedIndex), wordBoundaries.length - 1);
}

/**
 * Extracts {cue:id} tags from voiceover text, computing clean speech text,
 * anchor target words, and seed word indexes.
 *
 * @param {string} rawVoiceover
 * @returns {{
 *   cleanText: string;
 *   cues: Array<{ id: string; startWordIndex: number; endWordIndex?: number; wordAfter?: string; wordBefore?: string }>;
 * }}
 */
function extractCuesAndCleanText(rawVoiceover) {
  const tagRegex = /\{cue:([a-zA-Z0-9_-]+)\}|\{\/cue\}/g;
  let cleanText = '';
  /** @type {Array<{ id: string; startWordIndex: number; endWordIndex?: number; wordAfter?: string; wordBefore?: string }>} */
  const cues = [];
  /** @type {Array<{ id: string; startWordIndex: number; endWordIndex?: number; wordAfter?: string; wordBefore?: string }>} */
  const openSpans = [];

  let lastIndex = 0;
  let currentWordCount = 0;
  let match;

  while ((match = tagRegex.exec(rawVoiceover)) !== null) {
    const textBefore = rawVoiceover.slice(lastIndex, match.index);
    if (textBefore) {
      cleanText += textBefore;
      const words = textBefore.trim().split(/\s+/).filter(Boolean);
      currentWordCount += words.length;
    }
    lastIndex = tagRegex.lastIndex;

    if (match[0].startsWith('{cue:')) {
      const id = match[1];
      const textAfter = rawVoiceover.slice(lastIndex).replace(/\{cue:[^}]+\}|\{\/cue\}/g, '').trim();
      const firstWord = textAfter.split(/\s+/)[0]?.replace(/^[^\p{L}\p{N}]+/gu, '').replace(/[^\p{L}\p{N}]+$/gu, '') || '';
      const cueObj = { 
        id, 
        startWordIndex: currentWordCount,
        wordAfter: firstWord
      };
      cues.push(cueObj);
      openSpans.push(cueObj);
    } else if (match[0] === '{/cue}') {
      const lastSpan = openSpans.pop();
      if (lastSpan) {
        lastSpan.endWordIndex = currentWordCount;
        const cleanBefore = cleanText.trim();
        const lastWord = cleanBefore.split(/\s+/).pop()?.replace(/^[^\p{L}\p{N}]+/gu, '').replace(/[^\p{L}\p{N}]+$/gu, '') || '';
        lastSpan.wordBefore = lastWord;
      }
    }
  }

  const trailingText = rawVoiceover.slice(lastIndex);
  if (trailingText) {
    cleanText += trailingText;
  }

  cleanText = cleanText.replace(/\s+/g, ' ').trim();
  return { cleanText, cues };
}

/**
 * Safely writes a JSON file, retrying on transient Windows file lock errors (EBUSY / UNKNOWN).
 * @param {string} filePath
 * @param {any} data
 */
function safeWriteJson(filePath, data) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      return;
    } catch (e) {
      if (attempt === 3) throw e;
      const end = Date.now() + 150;
      while (Date.now() < end) {}
    }
  }
}

/**
 * Generates audio and word-level cues for all presentations
 */
async function generateAllPresentationAudio() {
  const presentationsBase = path.resolve('src/content/presentations');
  if (!fs.existsSync(presentationsBase)) {
    console.log('[Audio Generator] No presentations directory found at src/content/presentations');
    return;
  }

  const presentationFolders = fs.readdirSync(presentationsBase);

  for (const presentationFolder of presentationFolders) {
    const presentationPath = path.join(presentationsBase, presentationFolder);
    if (!fs.statSync(presentationPath).isDirectory()) continue;

    const slidesDir = path.join(presentationPath, 'slides');
    if (!fs.existsSync(slidesDir)) continue;

    const audioDir = path.join(presentationPath, 'audio');
    fs.mkdirSync(audioDir, { recursive: true });

    const cacheFile = path.join(audioDir, '.cache.json');
    /** @type {Record<string, string>} */
    let cache = {};
    if (fs.existsSync(cacheFile)) {
      try {
        cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      } catch {
        cache = {};
      }
    }

    const slideFiles = fs.readdirSync(slidesDir)
      .filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
      .sort();

    console.log(`\n[Audio Generator] Processing presentation: "${presentationFolder}" (${slideFiles.length} slides)`);

    const forceFlag = process.argv.includes('--force') || process.argv.includes('-f');
    const slideArg = process.argv.find((a) => a.startsWith('--slide='));
    const targetSlide = slideArg ? slideArg.replace('--slide=', '') : null;

    const lexicon = loadTtsLexicon();
    const GENERATOR_VERSION = 'v3-spoken';

    for (const slideFile of slideFiles) {
      const slideId = slideFile.replace(/\.(md|mdx)$/, '');
      if (targetSlide && slideId !== targetSlide) {
        continue;
      }

      const slidePath = path.join(slidesDir, slideFile);
      const content = fs.readFileSync(slidePath, 'utf8');
      const frontmatter = parseFrontmatter(content);
      const voiceover = frontmatter.voiceover || '';

      if (!voiceover.trim()) {
        continue;
      }

      const { cleanText, cues } = extractCuesAndCleanText(voiceover);
      const spokenText = applyLexicon(cleanText, lexicon);

      // Hash spokenText: audio is only re-synthesized if this specific slide's spoken output changed
      const hash = crypto.createHash('md5').update(`${GENERATOR_VERSION}:${spokenText}`).digest('hex');
      const mp3Path = path.join(audioDir, `${slideId}.mp3`);
      const cuesPath = path.join(audioDir, `${slideId}.cues.json`);

      if (!forceFlag && cache[slideId] === hash && fs.existsSync(mp3Path) && fs.existsSync(cuesPath)) {
        // Cached, no need to synthesize again
        continue;
      }

      console.log(`  ▶ Synthesizing audio for: ${slideId}...`);

      try {
        // Use German neural voice by default
        const communicate = new UniversalCommunicate(spokenText, {
          voice: 'de-DE-ConradNeural',
          rate: '+0%',
          pitch: '+0Hz'
        });

        /** @type {Buffer[]} */
        const audioChunks = [];
        /** @type {Array<{ offsetSec: number; durationSec: number; text: string }>} */
        const wordBoundaries = [];

        for await (const chunk of communicate.stream()) {
          if (chunk.type === 'audio' && chunk.data) {
            audioChunks.push(Buffer.from(chunk.data));
          } else if (chunk.type === 'WordBoundary') {
            // chunk.offset is in 100ns units -> / 10,000,000 for seconds
            const sec = (chunk.offset || 0) / 10000000;
            const dur = (chunk.duration || 0) / 10000000;
            wordBoundaries.push({ offsetSec: sec, durationSec: dur, text: chunk.text || '' });
          }
        }

        if (audioChunks.length === 0) {
          console.warn(`    ⚠️ No audio chunks returned for ${slideId}`);
          continue;
        }

        // Save MP3
        const finalAudioBuffer = Buffer.concat(audioChunks);
        fs.writeFileSync(mp3Path, finalAudioBuffer);

        // Compute Cues Map with acoustic anchor word matching
        /** @type {Record<string, { start: number; duration?: number; end?: number }>} */
        const cuesMap = {};
        for (const cue of cues) {
          if (wordBoundaries.length === 0) {
            cuesMap[cue.id] = { start: 0, duration: 0.5 };
            continue;
          }
          const targetAfter = cue.wordAfter ? applyLexicon(cue.wordAfter, lexicon).trim().split(/\s+/)[0] : '';
          const startIndex = findAnchorWordBoundary(targetAfter, cue.startWordIndex, wordBoundaries);
          const startBoundary = wordBoundaries[startIndex];
          const startSec = Number(startBoundary.offsetSec.toFixed(2));

          if (cue.endWordIndex !== undefined) {
            const targetBefore = cue.wordBefore ? applyLexicon(cue.wordBefore, lexicon).trim().split(/\s+/).pop() : '';
            const endIndex = Math.max(
              startIndex,
              findAnchorWordBoundary(targetBefore, cue.endWordIndex - 1, wordBoundaries)
            );
            const endBoundary = wordBoundaries[endIndex];
            const endSec = Number(((endBoundary.offsetSec || 0) + (endBoundary.durationSec || 0)).toFixed(2));
            const durationSec = Number(Math.max(0.1, endSec - startSec).toFixed(2));
            cuesMap[cue.id] = {
              start: startSec,
              duration: durationSec,
              end: endSec
            };
          } else {
            cuesMap[cue.id] = {
              start: startSec
            };
          }
        }

        safeWriteJson(cuesPath, cuesMap);

        // Update cache
        cache[slideId] = hash;
        safeWriteJson(cacheFile, cache);

        console.log(`    ✓ Saved: ${slideId}.mp3 (${(finalAudioBuffer.length / 1024).toFixed(1)} KB) and ${Object.keys(cuesMap).length} cues.`);
      } catch (err) {
        console.error(`    ❌ Failed to synthesize audio for ${slideId}:`, err);
      }
    }

    // Prune orphaned audio files and dead cache entries for slides that no longer exist
    if (!targetSlide) {
      const activeSlideIds = new Set(slideFiles.map((f) => f.replace(/\.(md|mdx)$/, '')));
      const audioFiles = fs.readdirSync(audioDir);
      for (const file of audioFiles) {
        if (file === '.cache.json') continue;
        const match = file.match(/^(.+?)\.(mp3|cues\.json)$/);
        if (match) {
          const slideId = match[1];
          if (!activeSlideIds.has(slideId)) {
            const orphanPath = path.join(audioDir, file);
            fs.unlinkSync(orphanPath);
            console.log(`  🗑️ Removed orphaned audio file: ${file}`);
          }
        }
      }

      for (const cachedId of Object.keys(cache)) {
        if (!activeSlideIds.has(cachedId)) {
          delete cache[cachedId];
          console.log(`  🗑️ Pruned orphaned cache entry: ${cachedId}`);
        }
      }
    }

    safeWriteJson(cacheFile, cache);
  }

  console.log('\n[Audio Generator] Done.');
}

generateAllPresentationAudio().catch((err) => {
  console.error('[Audio Generator] Fatal error:', err);
  process.exit(1);
});
