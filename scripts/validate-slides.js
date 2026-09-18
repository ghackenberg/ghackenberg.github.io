// @ts-check
import fs from 'node:fs';
import path from 'node:path';

/**
 * Validates slide frontmatter and cue consistency
 */
function validateSlides() {
  const talksBase = path.resolve('src/content/talks');
  if (!fs.existsSync(talksBase)) {
    console.log('[Slide Validator] No talks found in src/content/talks.');
    return;
  }

  let totalErrors = 0;
  let totalSlides = 0;

  const talkFolders = fs.readdirSync(talksBase);

  for (const talkFolder of talkFolders) {
    const talkPath = path.join(talksBase, talkFolder);
    if (!fs.statSync(talkPath).isDirectory()) continue;

    const slidesDir = path.join(talkPath, 'slides');
    if (!fs.existsSync(slidesDir)) continue;

    const slideFiles = fs.readdirSync(slidesDir)
      .filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
      .sort();

    console.log(`\n[Slide Validator] Checking talk: "${talkFolder}" (${slideFiles.length} slides)`);

    for (const slideFile of slideFiles) {
      totalSlides++;
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
        console.warn(`  ⚠️ [${slideFile}] Missing "voiceover" script in frontmatter.`);
      }
      if (!hasNotes) {
        console.warn(`  ⚠️ [${slideFile}] Missing "notes" for presenter mode.`);
      }

      const cueRegex = /\{cue:([a-zA-Z0-9_-]+)\}/g;
      let match;
      while ((match = cueRegex.exec(fm)) !== null) {
        const cueId = match[1];
        const hasElement =
          body.includes(`id="${cueId}"`) ||
          body.includes(`id='${cueId}'`) ||
          body.includes(`id: "${cueId}"`) ||
          body.includes(`id: '${cueId}'`) ||
          body.includes(`cue="${cueId}"`) ||
          body.includes(`cue='${cueId}'`) ||
          body.includes(`cue: "${cueId}"`) ||
          body.includes(`cue: '${cueId}'`);
        if (!hasElement) {
          console.warn(`  ⚠️ [${slideFile}] Cue "{cue:${cueId}}" has no matching element with id="${cueId}" in slide body.`);
        }
      }
    }
  }

  if (totalErrors > 0) {
    console.error(`\n[Slide Validator] Validation FAILED with ${totalErrors} error(s) across ${totalSlides} slides.\n`);
    process.exit(1);
  } else {
    console.log(`\n[Slide Validator] Passed! All ${totalSlides} slides validated successfully.\n`);
  }
}

validateSlides();
