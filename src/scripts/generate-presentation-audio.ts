import fs from 'node:fs';
import path from 'node:path';
import {
  ensureSlideAudio,
  getSlideAudioCacheDir,
  getPresentationAudioCache,
  savePresentationAudioCache,
} from '@commons/server/edge-tts.js';

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const yamlText = match[1];
  const result: Record<string, string> = {};

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

async function generateAllPresentationAudio(): Promise<void> {
  const presentationsBase = path.resolve('src/content/presentations');
  if (!fs.existsSync(presentationsBase)) {
    console.log('[Audio Generator] No presentations directory found at src/content/presentations');
    return;
  }

  const presentationFolders = fs.readdirSync(presentationsBase);
  const forceFlag = process.argv.includes('--force') || process.argv.includes('-f');
  const slideArg = process.argv.find((a) => a.startsWith('--slide='));
  const targetSlide = slideArg ? slideArg.replace('--slide=', '') : null;
  const voiceArg = process.argv.find((a) => a.startsWith('--voice='));
  const selectedVoice = voiceArg ? voiceArg.replace('--voice=', '') : 'de-DE-FlorianMultilingualNeural';

  for (const presentationFolder of presentationFolders) {
    const presentationPath = path.join(presentationsBase, presentationFolder);
    if (!fs.statSync(presentationPath).isDirectory()) continue;

    const slidesDir = path.join(presentationPath, 'slides');
    if (!fs.existsSync(slidesDir)) continue;

    const audioDir = getSlideAudioCacheDir(presentationFolder);
    fs.mkdirSync(audioDir, { recursive: true });

    const slideFiles = fs.readdirSync(slidesDir)
      .filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
      .sort();

    console.log(`\n[Audio Generator] Processing presentation: "${presentationFolder}" (${slideFiles.length} slides)`);

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

      try {
        await ensureSlideAudio(presentationFolder, slideId, voiceover, {
          force: forceFlag,
          voice: selectedVoice,
        });
      } catch (err) {
        console.error(`    ❌ Failed to synthesize audio for ${slideId}:`, err);
      }
    }

    if (!targetSlide) {
      const cache = getPresentationAudioCache(presentationFolder);
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

      let cacheModified = false;
      for (const cachedId of Object.keys(cache)) {
        if (!activeSlideIds.has(cachedId)) {
          delete cache[cachedId];
          cacheModified = true;
          console.log(`  🗑️ Pruned orphaned cache entry: ${cachedId}`);
        }
      }
      if (cacheModified) {
        savePresentationAudioCache(presentationFolder, cache);
      }
    }
  }

  console.log('\n[Audio Generator] Done.');
}

generateAllPresentationAudio().catch((err) => {
  console.error('[Audio Generator] Fatal error:', err);
  process.exit(1);
});
