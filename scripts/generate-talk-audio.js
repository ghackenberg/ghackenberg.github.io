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
 * Extracts cues (both point cues and span cues) from text and cleans text for speech synthesis
 * @param {string} rawVoiceover
 * @returns {{
 *   cleanText: string;
 *   cues: Array<{ id: string; startWordIndex: number; endWordIndex?: number }>;
 * }}
 */
function extractCuesAndCleanText(rawVoiceover) {
  const tagRegex = /\{cue:([a-zA-Z0-9_-]+)\}|\{\/cue\}/g;
  let cleanText = '';
  /** @type {Array<{ id: string; startWordIndex: number; endWordIndex?: number }>} */
  const cues = [];
  /** @type {Array<{ id: string; startWordIndex: number; endWordIndex?: number }>} */
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
      const cueObj = { id, startWordIndex: currentWordCount };
      cues.push(cueObj);
      openSpans.push(cueObj);
    } else if (match[0] === '{/cue}') {
      const lastSpan = openSpans.pop();
      if (lastSpan) {
        lastSpan.endWordIndex = currentWordCount;
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
 * Generates audio and word-level cues for all talks
 */
async function generateAllTalkAudio() {
  const talksBase = path.resolve('src/content/talks');
  if (!fs.existsSync(talksBase)) {
    console.log('[Audio Generator] No talks directory found at src/content/talks');
    return;
  }

  const talkFolders = fs.readdirSync(talksBase);

  for (const talkFolder of talkFolders) {
    const talkPath = path.join(talksBase, talkFolder);
    if (!fs.statSync(talkPath).isDirectory()) continue;

    const slidesDir = path.join(talkPath, 'slides');
    if (!fs.existsSync(slidesDir)) continue;

    const audioDir = path.join(talkPath, 'audio');
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

    console.log(`\n[Audio Generator] Processing talk: "${talkFolder}" (${slideFiles.length} slides)`);

    for (const slideFile of slideFiles) {
      const slideId = slideFile.replace(/\.(md|mdx)$/, '');
      const slidePath = path.join(slidesDir, slideFile);
      const content = fs.readFileSync(slidePath, 'utf8');
      const frontmatter = parseFrontmatter(content);
      const voiceover = frontmatter.voiceover || '';

      if (!voiceover.trim()) {
        continue;
      }

      // Hash to determine if regenerated audio is needed
      const hash = crypto.createHash('md5').update(voiceover).digest('hex');
      const mp3Path = path.join(audioDir, `${slideId}.mp3`);
      const cuesPath = path.join(audioDir, `${slideId}.cues.json`);

      if (cache[slideId] === hash && fs.existsSync(mp3Path) && fs.existsSync(cuesPath)) {
        // Cached, no need to synthesize again
        continue;
      }

      console.log(`  ▶ Synthesizing audio for: ${slideId}...`);

      const { cleanText, cues } = extractCuesAndCleanText(voiceover);

      try {
        // Use German neural voice by default
        const communicate = new UniversalCommunicate(cleanText, {
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

        // Compute Cues Map
        /** @type {Record<string, { start: number; duration?: number; end?: number }>} */
        const cuesMap = {};
        for (const cue of cues) {
          if (wordBoundaries.length === 0) {
            cuesMap[cue.id] = { start: 0, duration: 0.5 };
            continue;
          }
          const startIndex = Math.min(cue.startWordIndex, wordBoundaries.length - 1);
          const startSec = Number(wordBoundaries[startIndex].offsetSec.toFixed(2));

          if (cue.endWordIndex !== undefined) {
            const endIndex = Math.min(Math.max(cue.endWordIndex - 1, startIndex), wordBoundaries.length - 1);
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

        fs.writeFileSync(cuesPath, JSON.stringify(cuesMap, null, 2), 'utf8');

        // Update cache
        cache[slideId] = hash;
        fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2), 'utf8');

        console.log(`    ✓ Saved: ${slideId}.mp3 (${(finalAudioBuffer.length / 1024).toFixed(1)} KB) and ${Object.keys(cuesMap).length} cues.`);
      } catch (err) {
        console.error(`    ❌ Failed to synthesize audio for ${slideId}:`, err);
      }
    }
  }

  console.log('\n[Audio Generator] Done.');
}

generateAllTalkAudio().catch((err) => {
  console.error('[Audio Generator] Fatal error:', err);
  process.exit(1);
});
