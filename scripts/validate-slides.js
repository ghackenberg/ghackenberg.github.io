// @ts-check
import fs from 'node:fs';
import path from 'node:path';

/**
 * Validates slide frontmatter and cue consistency, completeness, and sequential order
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

  for (const presentationFolder of presentationFolders) {
    const presentationPath = path.join(presentationsBase, presentationFolder);
    if (!fs.statSync(presentationPath).isDirectory()) continue;

    const slidesDir = path.join(presentationPath, 'slides');
    if (!fs.existsSync(slidesDir)) continue;

    const slideFiles = fs.readdirSync(slidesDir)
      .filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
      .sort();

    console.log(`\n[Slide Validator] Checking presentation: "${presentationFolder}" (${slideFiles.length} slides)`);

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
        console.error(`  ❌ [${slideFile}] Missing required "voiceover" script in frontmatter.`);
        totalErrors++;
      }
      if (!hasNotes) {
        console.warn(`  ⚠️ [${slideFile}] Missing "notes" for presenter mode.`);
        totalWarnings++;
      }

      // Extract voiceover script content
      const voMatch = fm.match(/voiceover:\s*(?:>|\|)?\s*\r?\n([\s\S]*?)(?=\r?\n[a-zA-Z0-9_-]+:|$)/);
      const voText = voMatch ? voMatch[1] : '';

      // 1. Extract voiceover cues in sequence
      /** @type {string[]} */
      const voCues = [];
      const voCueRegex = /\{cue:([a-zA-Z0-9_-]+)(?::[a-zA-Z0-9_-]+)?\}/g;
      let voMatchItem;
      while ((voMatchItem = voCueRegex.exec(voText)) !== null) {
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
    }
  }

  if (totalErrors > 0) {
    console.error(`\n[Slide Validator] Validation FAILED with ${totalErrors} error(s) and ${totalWarnings} warning(s) across ${totalSlides} slides.\n`);
    process.exit(1);
  } else {
    console.log(`\n[Slide Validator] Passed! All ${totalSlides} slides validated successfully (${totalWarnings} warning(s)).\n`);
  }
}

validateSlides();
