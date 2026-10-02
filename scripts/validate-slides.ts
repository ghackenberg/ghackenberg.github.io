// @ts-nocheck
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  computeSlideStyleHash,
  computePresentationDeckHash,
  loadVisualCache
} from './lib/slide-fingerprint.js';

/**
 * Extracts YAML frontmatter fields from markdown/mdx content
 * @param {string} content
 * @returns {Record<string, string>}
 */
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

/**
 * Transforms clean text into pronunciation-optimized text for TTS synthesis.
 * Applies acronym expansions (e.g. RAG -> R-A-G) and phonetic transcriptions (e.g. Snapshot -> Snäpschott).
 * @param {string} text
 * @param {{ acronyms?: Record<string, string>; phonetics?: Record<string, string> }} lexicon
 * @returns {string}
 */
function applyLexicon(
  text: string,
  lexicon: { acronyms?: Record<string, string>; phonetics?: Record<string, string> }
): string {
  if (!text) return '';
  let result = text;

  const allMappings: Record<string, string> = {
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
 */
function extractCleanText(voiceover: string): string {
  return (voiceover || '').replace(/\{cue:[^}]+\}|\{\/cue\}/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Validates slide frontmatter, cue consistency, audio sync, orphan assets, and PDF handouts
 */
function validateSlides() {
  const isSyntaxOnly = process.argv.includes('--syntax-only') || process.argv.includes('--structure-only');

  const presentationsBase = path.resolve('src/content/presentations');
  if (!fs.existsSync(presentationsBase)) {
    console.log('[Slide Validator] No presentations found in src/content/presentations.');
    return;
  }

  if (isSyntaxOnly) {
    console.log('[Slide Validator] Running in SYNTAX-ONLY mode: Skipping audio files, TTS hashes, thumbnails, and PDF checks.\n');
  }

  let totalErrors = 0;
  let totalWarnings = 0;
  let totalSlides = 0;

  const presentationFolders = fs.readdirSync(presentationsBase);

  const lexiconPath = path.resolve('src/content/presentations/tts-lexicon.json');
  let lexicon: { acronyms: Record<string, string>; phonetics: Record<string, string> } = { acronyms: {}, phonetics: {} };
  if (fs.existsSync(lexiconPath)) {
    try {
      lexicon = JSON.parse(fs.readFileSync(lexiconPath, 'utf8'));
    } catch {}
  }
  const GENERATOR_VERSION = 'v5-florian-minimal';

  for (const presentationFolder of presentationFolders) {
    const presentationPath = path.join(presentationsBase, presentationFolder);
    if (!fs.statSync(presentationPath).isDirectory()) continue;

    const slidesDir = path.join(presentationPath, 'slides');
    if (!fs.existsSync(slidesDir)) continue;

    const audioDir = path.join(presentationPath, 'audio');
    const cacheFile = path.join(audioDir, '.cache.json');
    let audioCache: Record<string, string> = {};
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

    const activeSlideIds = new Set<string>();

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

      // 0. Check for deprecated color override syntax {cue:id:color}
      const legacyColorRegex = /\{cue:[a-zA-Z0-9_-]+:([a-zA-Z0-9_-]+)\}/g;
      let legacyMatch;
      while ((legacyMatch = legacyColorRegex.exec(content)) !== null) {
        console.error(`  ❌ [${slideFile}] Deprecated color syntax detected in "${legacyMatch[0]}". Color overrides are removed; highlights and bullet badges automatically follow their container accent.`);
        totalErrors++;
      }

      // 1. Extract voiceover cues in sequence
      const voCues: string[] = [];
      const voCueRegex = /\{cue:([a-zA-Z0-9_-]+)\}/g;
      let voMatchItem;
      while ((voMatchItem = voCueRegex.exec(voiceoverText)) !== null) {
        voCues.push(voMatchItem[1]);
      }

      // 1b. Check cue syntax rules: only inline text-highlights (hl-* / mark-*) may have closing tags!
      const cueTagRegex = /\{cue:([a-zA-Z0-9_-]+)\}|\{\/cue(?::([a-zA-Z0-9_-]+))?\}/g;
      const openCueStack: string[] = [];
      let tagMatch;
      while ((tagMatch = cueTagRegex.exec(voiceoverText)) !== null) {
        if (tagMatch[0].startsWith('{cue:')) {
          const id = tagMatch[1];
          openCueStack.push(id);
        } else if (tagMatch[0].startsWith('{/cue')) {
          if (openCueStack.length === 0) {
            console.error(`  ❌ [${slideFile}] Unexpected closing tag "${tagMatch[0]}" without preceding open cue.`);
            totalErrors++;
          } else {
            const closedId = openCueStack.pop();
            const isHighlight = closedId ? (closedId.startsWith('hl-') || closedId.startsWith('mark-')) : false;
            if (!isHighlight) {
              console.error(
                `  ❌ [${slideFile}] Structural cue "${closedId}" has a closing tag "${tagMatch[0]}". Structural cues (col-, box-, card-, step-, stat-) must be point cues without closing tags to prevent content from vanishing. Only inline text-highlights ("hl-*") may have closing tags.`
              );
              totalErrors++;
            }
          }
        }
      }
      for (const unclosedId of openCueStack) {
        if (unclosedId.startsWith('hl-') || unclosedId.startsWith('mark-')) {
          console.error(`  ❌ [${slideFile}] Text highlight cue "{cue:${unclosedId}}" was never closed with "{/cue}".`);
          totalErrors++;
        }
      }

      // 1c. Validate slide references integrity (mandatory citation tags)
      if (Array.isArray(parsedFm.references) && parsedFm.references.length > 0) {
        const citedRefs = [...content.matchAll(/\[@([a-zA-Z0-9_\-]+)\]/g)].map(m => m[1]);
        for (const ref of parsedFm.references) {
          if (!ref.id) {
            console.error(`  ❌ [${slideFile}] Slide reference "${ref.title}" is missing mandatory "id".`);
            totalErrors++;
          } else if (!citedRefs.includes(ref.id)) {
            console.error(`  ❌ [${slideFile}] Reference "${ref.id}" declared in frontmatter but never cited with "[@${ref.id}]" in slide body/props/voiceover.`);
            totalErrors++;
          }
        }
        for (const key of citedRefs) {
          if (!parsedFm.references.some(r => r.id === key)) {
            console.error(`  ❌ [${slideFile}] Citation "[@${key}]" used in slide but not declared in frontmatter references.`);
            totalErrors++;
          }
        }
      }

      // 2. Extract slide body cues in order of visual appearance
      const bodyCues: string[] = [];
      const bodyCueRegex = /(?:(?:[a-zA-Z0-9_-]*cue|data-cue)\s*[:=]\s*["']([a-zA-Z0-9_-]+)["']|id\s*[:=]\s*["']((?:col|box|card|step|stat|hl|mark)-[a-zA-Z0-9_-]+)["']|\{cue:([a-zA-Z0-9_-]+)\})/gi;
      
      const subtitleFmMatch = fm.match(/^subtitle:\s*["']?([^\r\n]+)/m);
      const subtitleText = subtitleFmMatch ? subtitleFmMatch[1] : '';
      const contentToScan = `${subtitleText}\n${body}`;

      let bodyMatch;
      while ((bodyMatch = bodyCueRegex.exec(contentToScan)) !== null) {
        const cueId = bodyMatch[1] || bodyMatch[2] || bodyMatch[3];
        if (cueId && !bodyCues.includes(cueId)) {
          bodyCues.push(cueId);
        }
      }

      // 2b. Structural vs. Highlight Target Validation in Slide Body
      const invalidContainerHl = body.match(/<(?:BentoCard|Pipeline|MetricStat)[^>]*\bcue=["'](hl-[a-zA-Z0-9_-]+)["']/g);
      if (invalidContainerHl) {
        for (const match of invalidContainerHl) {
          console.error(`  ❌ [${slideFile}] Container component cannot use highlight cue in "${match}". Highlight cues (hl-*) are reserved for inline text marks.`);
          totalErrors++;
        }
      }
      // 2c. Mandatory Highlight Marker Enforcement: Every BentoCard and Pipeline step must have at least one highlight marker
      const bentoCardBlocks = body.match(/<BentoCard[\s\S]*?<\/BentoCard>/g) || [];
      for (const card of bentoCardBlocks) {
        const hasHl = /\{cue:hl-[^}]+\}|<mark|<Highlight|\bcue:\s*["']hl-/.test(card);
        if (!hasHl) {
          const titleMatch = card.match(/title=["']([^"']+)["']/);
          const cueMatch = card.match(/\bcue=["']([^"']+)["']/);
          const cardName = titleMatch ? titleMatch[1] : (cueMatch ? cueMatch[1] : 'unnamed card');
          console.error(`  ❌ [${slideFile}] BentoCard "${cardName}" has no highlight marker. Every content card must have at least one inline {cue:hl-...} to ensure visual focus and voiceover parity.`);
          totalErrors++;
        }
      }

      const pipelineBlocks = body.match(/<Pipeline[\s\S]*?\/>/g) || [];
      for (const pipeline of pipelineBlocks) {
        const stepItems = pipeline.match(/\{[\s\S]*?(?:num:|title:)[\s\S]*?\}/g) || [];
        for (let sIdx = 0; sIdx < stepItems.length; sIdx++) {
          const step = stepItems[sIdx];
          const titleMatch = step.match(/title:\s*["']([^"']+)["']/);
          const numMatch = step.match(/num:\s*["']([^"']+)["']/);
          const stepName = titleMatch ? titleMatch[1] : (numMatch ? `Step ${numMatch[1]}` : `Step #${sIdx + 1}`);

          if (/title:\s*(["'])(?:(?!\1)[\s\S])*?\{cue:hl-/.test(step)) {
            console.error(`  ❌ [${slideFile}] Pipeline step "${stepName}" has a highlight marker in title. Highlight markers must NOT be on step title, but in desc.`);
            totalErrors++;
          }

          const hasDescHl = /desc:\s*(["'])(?:(?!\1)[\s\S])*?\{cue:hl-/.test(step);
          if (!hasDescHl) {
            console.error(`  ❌ [${slideFile}] Pipeline step "${stepName}" has no highlight marker in desc. Every pipeline step must contain at least one inline {cue:hl-...} in desc.`);
            totalErrors++;
          }
        }
      }

      // 2c-2. Mandatory Highlight Marker Enforcement for BulletList items:
      // Every bullet point item must have at least one inline {cue:hl-...} in desc, and NOT in title.
      const bListMatches = body.match(/<BulletList[\s\S]*?\/>/g) || [];
      for (const bList of bListMatches) {
        const bulletItems = bList.match(/\{[\s\S]*?(?:title:|desc:)[\s\S]*?\}/g) || [];
        for (let bIdx = 0; bIdx < bulletItems.length; bIdx++) {
          const item = bulletItems[bIdx];
          const titleMatch = item.match(/title:\s*["']([^"']+)["']/);
          const iconMatch = item.match(/icon:\s*["']([^"']+)["']/);
          const itemName = titleMatch ? titleMatch[1] : (iconMatch ? `Icon ${iconMatch[1]}` : `Bullet #${bIdx + 1}`);

          if (/title:\s*(["'])(?:(?!\1)[\s\S])*?\{cue:hl-/.test(item)) {
            console.error(`  ❌ [${slideFile}] BulletList item "${itemName}" has a highlight marker in title. Highlight markers must NOT be on item title, but in desc.`);
            totalErrors++;
          }

          const hasDescHl = /desc:\s*(["'])(?:(?!\1)[\s\S])*?\{cue:hl-/.test(item);
          if (!hasDescHl) {
            console.error(`  ❌ [${slideFile}] BulletList item "${itemName}" has no highlight marker in desc. Every bullet point item must contain at least one inline {cue:hl-...} in desc.`);
            totalErrors++;
          }
        }
      }

      // 2c-3. Mandatory Highlight Marker Enforcement for CalloutBox components:
      // Every CalloutBox must contain at least one inline {cue:hl-...} to ensure voiceover parity.
      const calloutMatches = [];
      const calloutStartRegex = /<CalloutBox\b/g;
      let cbMatch;
      while ((cbMatch = calloutStartRegex.exec(body)) !== null) {
        const startIndex = cbMatch.index;
        let i = startIndex + '<CalloutBox'.length;
        let inQuote = null;
        let isSelfClosing = false;
        while (i < body.length) {
          const char = body[i];
          if (inQuote) {
            if (char === inQuote) inQuote = null;
          } else {
            if (char === '"' || char === "'") {
              inQuote = char;
            } else if (char === '/' && body[i + 1] === '>') {
              isSelfClosing = true;
              i += 2;
              break;
            } else if (char === '>') {
              i += 1;
              break;
            }
          }
          i++;
        }
        if (isSelfClosing) {
          calloutMatches.push(body.slice(startIndex, i));
        } else {
          const closeTag = '</CalloutBox>';
          const closeIndex = body.indexOf(closeTag, i);
          if (closeIndex !== -1) {
            calloutMatches.push(body.slice(startIndex, closeIndex + closeTag.length));
          }
        }
      }

      for (let cIdx = 0; cIdx < calloutMatches.length; cIdx++) {
        const callout = calloutMatches[cIdx];
        const titleMatch = callout.match(/title=["']([^"']+)["']/);
        const calloutName = titleMatch ? titleMatch[1] : `Callout #${cIdx + 1}`;

        const hasHl = /\{cue:hl-[^}]+\}/.test(callout);
        if (!hasHl) {
          console.error(`  ❌ [${slideFile}] CalloutBox "${calloutName}" has no highlight marker. Every CalloutBox must contain at least one inline {cue:hl-...} to ensure the voiceover discusses its content.`);
          totalErrors++;
        }
      }

      // 2d. Mandatory Cue & Highlight Enforcement for Title Slides:
      // Title slides (slideLayout: "title" or containing <TitleSlide) must have:
      // 1. Title entrance cue (default title-main)
      // 2. Subtitle entrance cue (default title-sub)
      // 3. Subtitle inline highlight marker ({cue:hl-...})
      // 4. Speaker info entrance cue (default title-speaker)
      // in strictly sequential order in the voiceover!
      const isTitleSlide = /slideLayout:\s*["']?title["']?/m.test(fm) || /<TitleSlide/m.test(body);
      if (isTitleSlide) {
        const titleCueMatch = body.match(/titleCue=["']([^"']+)["']/);
        const titleCue = titleCueMatch ? titleCueMatch[1] : 'title-main';

        const subtitleCueMatch = body.match(/subtitleCue=["']([^"']+)["']/);
        const subtitleCue = subtitleCueMatch ? subtitleCueMatch[1] : 'title-sub';

        const speakerCueMatch = body.match(/speakerCue=["']([^"']+)["']/);
        const speakerCue = speakerCueMatch ? speakerCueMatch[1] : 'title-speaker';

        // Ensure default title cues are in bodyCues in their physical display order
        const curTitleIdx = bodyCues.indexOf(titleCue);
        if (curTitleIdx !== -1) bodyCues.splice(curTitleIdx, 1);
        bodyCues.unshift(titleCue);

        const curSubIdx = bodyCues.indexOf(subtitleCue);
        if (curSubIdx !== -1) bodyCues.splice(curSubIdx, 1);
        const bodyTitleIdx = bodyCues.indexOf(titleCue);
        bodyCues.splice(bodyTitleIdx + 1, 0, subtitleCue);

        const curSpkIdx = bodyCues.indexOf(speakerCue);
        if (curSpkIdx !== -1) bodyCues.splice(curSpkIdx, 1);
        bodyCues.push(speakerCue);

        if (!voCues.includes(titleCue)) {
          console.error(`  ❌ [${slideFile}] Title slide must contain a cue for the main title ("{cue:${titleCue}}") in voiceover.`);
          totalErrors++;
        }
        if (!voCues.includes(subtitleCue)) {
          console.error(`  ❌ [${slideFile}] Title slide must contain a cue for the subtitle ("{cue:${subtitleCue}}") in voiceover.`);
          totalErrors++;
        }
        const hasSubtitleHl = /\{cue:hl-[^}]+\}|<mark|<Highlight/.test(subtitleText) || 
          /<TitleSlide[^>]*subtitle=["'][^"']*\{cue:hl-/.test(body);
        if (!hasSubtitleHl) {
          console.error(`  ❌ [${slideFile}] Title slide must contain at least one highlight marker {cue:hl-...} in its subtitle to ensure visual focus and voiceover parity.`);
          totalErrors++;
        }
        if (!voCues.includes(speakerCue)) {
          console.error(`  ❌ [${slideFile}] Title slide must contain a cue for the speaker information ("{cue:${speakerCue}}") in voiceover.`);
          totalErrors++;
        }

        const tIdx = voCues.indexOf(titleCue);
        const sIdx = voCues.indexOf(subtitleCue);
        const spkIdx = voCues.indexOf(speakerCue);
        const hlCuesInVo = voCues.filter(c => c.startsWith('hl-') || c.startsWith('mark-'));
        const firstHlIdx = hlCuesInVo.length > 0 ? voCues.indexOf(hlCuesInVo[0]) : -1;

        if (tIdx !== -1 && sIdx !== -1 && tIdx > sIdx) {
          console.error(`  ❌ [${slideFile}] Title cue "{cue:${titleCue}}" must appear before subtitle cue "{cue:${subtitleCue}}" in voiceover.`);
          totalErrors++;
        }
        if (sIdx !== -1 && firstHlIdx !== -1 && sIdx > firstHlIdx) {
          console.error(`  ❌ [${slideFile}] Subtitle cue "{cue:${subtitleCue}}" must appear before subtitle highlight marker in voiceover.`);
          totalErrors++;
        }
        if (firstHlIdx !== -1 && spkIdx !== -1 && firstHlIdx > spkIdx) {
          console.error(`  ❌ [${slideFile}] Subtitle highlight marker must appear before speaker cue "{cue:${speakerCue}}" in voiceover.`);
          totalErrors++;
        }

        // Date consistency check: Warn if hardcoded date is specified in <TitleSlide>
        const dateAttrMatch = body.match(/<TitleSlide[^>]*\bdate=["']([^"']+)["']/);
        if (dateAttrMatch) {
          console.warn(`  ⚠️ [${slideFile}] <TitleSlide> specifies hardcoded date "${dateAttrMatch[1]}". Omit the "date" prop so it is automatically derived from the presentation folder name to guarantee date consistency.`);
          totalWarnings++;
        }
      }

      // 2e. Mandatory Subtitle Cue & Highlight Enforcement for Content Slides:
      // Content slides (all slides after slide 1) must have:
      // 1. Subtitle defined in frontmatter
      // 2. At least one inline highlight marker ({cue:hl-...}) in the subtitle
      // 3. Subtitle entrance cue in voiceover ({cue:sub} or custom {cue:subtitleCue})
      // 4. Subtitle entrance cue must appear BEFORE any stage cues (col-*, box-*, card-*, step-*, stat-*)
      // 5. Subtitle entrance cue must appear BEFORE the subtitle highlight marker
      if (!isTitleSlide) {
        const subCueMatch = body.match(/subtitleCue=["']([^"']+)["']/);
        const subCue = subCueMatch ? subCueMatch[1] : 'sub';

        // Prepend subtitleCue to bodyCues at index 0 so it comes BEFORE any subtitle highlight and stage cues!
        const existingIdx = bodyCues.indexOf(subCue);
        if (existingIdx !== -1) {
          bodyCues.splice(existingIdx, 1);
        }
        bodyCues.unshift(subCue);

        if (!subtitleText.trim()) {
          console.error(`  ❌ [${slideFile}] Content slide is missing "subtitle" in frontmatter.`);
          totalErrors++;
        } else {
          const hasSubHl = /\{cue:hl-[^}]+\}|<mark|<Highlight/.test(subtitleText);
          if (!hasSubHl) {
            console.error(`  ❌ [${slideFile}] Content slide subtitle must contain at least one highlight marker {cue:hl-...} to ensure visual focus and voiceover parity.`);
            totalErrors++;
          }
        }

        if (!voCues.includes(subCue)) {
          console.error(`  ❌ [${slideFile}] Content slide must contain a cue for the subtitle ("{cue:${subCue}}") in voiceover.`);
          totalErrors++;
        } else {
          const subIdx = voCues.indexOf(subCue);
          const firstStageIdx = voCues.findIndex(c => /^(?:col|box|card|step|stat)-/.test(c));
          if (firstStageIdx !== -1 && subIdx > firstStageIdx) {
            console.error(`  ❌ [${slideFile}] Subtitle cue "{cue:${subCue}}" must appear before stage cue "{cue:${voCues[firstStageIdx]}}" in voiceover.`);
            totalErrors++;
          }

          const subHlMatch = subtitleText.match(/\{cue:(hl-[a-zA-Z0-9_-]+)/);
          if (subHlMatch) {
            const subHlCue = subHlMatch[1];
            const hlIdx = voCues.indexOf(subHlCue);
            if (hlIdx !== -1 && subIdx > hlIdx) {
              console.error(`  ❌ [${slideFile}] Subtitle cue "{cue:${subCue}}" must appear before subtitle highlight marker "{cue:${subHlCue}}" in voiceover.`);
              totalErrors++;
            }
          }
        }
      }

      // 2f. Mandatory Cue, Sequential Order & Structure Enforcement for Section Slides:
      // Section divider slides (slideLayout: "section" or containing <SectionSlide) must have:
      // 1. subtitle defined in frontmatter with at least one inline highlight marker ({cue:hl-...})
      // 2. {cue:sub} entrance cue in voiceover before the subtitle highlight marker
      // 3. Leitfrage element in body (slot="question" or with cue matching card-leitfrage-* / sec-question)
      //    with at least one inline highlight marker
      // 4. Bridge element in body (slot="bridge" or with cue matching card-bridge-* / sec-bridge)
      //    with at least one inline highlight marker
      // 5. Strictly monotonic sequence in voiceover:
      //    {cue:sub} -> Subtitle highlight -> Leitfrage cue -> Leitfrage highlight -> Bridge cue -> Bridge highlight
      // 6. Prohibit inline SVG graphics to enforce clean, focused typography
      const isSectionSlide = /slideLayout:\s*["']?section["']?/m.test(fm) || /<SectionSlide/m.test(body);
      if (isSectionSlide) {
        if (/<svg\b/i.test(body)) {
          console.error(`  ❌ [${slideFile}] Section slide must not contain inline SVG graphics. Section divider slides rely purely on monumental centered typography.`);
          totalErrors++;
        }

        const divMatch = body.match(/dividerCue=["']([a-zA-Z0-9_-]+)["']/);
        const dividerCue = divMatch ? divMatch[1] : bodyCues.find(c => c.startsWith('card-divider') || c.startsWith('divider'));

        const qTagMatch = body.match(/<[^>]*slot=["']question["'][^>]*>/);
        const qPropMatch = body.match(/questionCue=["']([a-zA-Z0-9_-]+)["']/);
        const questionCueMatch = qTagMatch ? qTagMatch[0].match(/(?:data-cue|cue)=["']([a-zA-Z0-9_-]+)["']/) : null;
        const questionCue = qPropMatch ? qPropMatch[1] : (questionCueMatch ? questionCueMatch[1] : bodyCues.find(c => c.startsWith('card-leitfrage') || c === 'question' || c === 'sec-question'));

        const bTagMatch = body.match(/<[^>]*slot=["']bridge["'][^>]*>/);
        const bPropMatch = body.match(/bridgeCue=["']([a-zA-Z0-9_-]+)["']/);
        const bridgeCueMatch = bTagMatch ? bTagMatch[0].match(/(?:data-cue|cue)=["']([a-zA-Z0-9_-]+)["']/) : null;
        const bridgeCue = bPropMatch ? bPropMatch[1] : (bridgeCueMatch ? bridgeCueMatch[1] : bodyCues.find(c => c.startsWith('card-bridge') || c === 'bridge' || c === 'sec-bridge'));

        if (!dividerCue) {
          console.error(`  ❌ [${slideFile}] Section slide must declare a divider cue (e.g. dividerCue="card-divider-XX").`);
          totalErrors++;
        }
        if (!questionCue) {
          console.error(`  ❌ [${slideFile}] Section slide must contain a Leitfrage element with a cue (e.g. data-cue="card-leitfrage-XX" or slot="question").`);
          totalErrors++;
        }
        if (!bridgeCue) {
          console.error(`  ❌ [${slideFile}] Section slide must contain a Bridge element with a cue (e.g. data-cue="card-bridge-XX" or slot="bridge").`);
          totalErrors++;
        }

        if (dividerCue && !voCues.includes(dividerCue)) {
          console.error(`  ❌ [${slideFile}] Section slide divider cue "{cue:${dividerCue}}" must be referenced in voiceover.`);
          totalErrors++;
        }
        if (questionCue && !voCues.includes(questionCue)) {
          console.error(`  ❌ [${slideFile}] Section slide Leitfrage cue "{cue:${questionCue}}" must be referenced in voiceover.`);
          totalErrors++;
        }
        if (bridgeCue && !voCues.includes(bridgeCue)) {
          console.error(`  ❌ [${slideFile}] Section slide Bridge cue "{cue:${bridgeCue}}" must be referenced in voiceover.`);
          totalErrors++;
        }

        const secSubCueMatch = body.match(/subtitleCue=["']([^"']+)["']/);
        const subCue = secSubCueMatch ? secSubCueMatch[1] : 'sub';
        const subIdx = voCues.indexOf(subCue);
        const divIdx = dividerCue ? voCues.indexOf(dividerCue) : -1;
        const qIdx = questionCue ? voCues.indexOf(questionCue) : -1;
        const bIdx = bridgeCue ? voCues.indexOf(bridgeCue) : -1;

        const subHlMatch = subtitleText.match(/\{cue:(hl-[a-zA-Z0-9_-]+)/);
        const subHlCue = subHlMatch ? subHlMatch[1] : null;
        const sHlIdx = subHlCue ? voCues.indexOf(subHlCue) : -1;

        const qSlotMatch = body.match(/<div[^>]*slot=["']question["'][\s\S]*?<\/div>/);
        const qHlMatch = qSlotMatch ? qSlotMatch[0].match(/\{cue:(hl-[a-zA-Z0-9_-]+)/) : null;
        const qHlCue = qHlMatch ? qHlMatch[1] : null;

        const bSlotMatch = body.match(/<div[^>]*slot=["']bridge["'][\s\S]*?<\/div>/);
        const bHlMatch = bSlotMatch ? bSlotMatch[0].match(/\{cue:(hl-[a-zA-Z0-9_-]+)/) : null;
        const bHlCue = bHlMatch ? bHlMatch[1] : null;

        // Normalize bodyCues for section slides to match physical DOM cascade:
        // sub -> subHl -> dividerCue -> questionCue -> qHl -> bridgeCue -> bHl
        const orderedSectionCues = [];
        if (subCue) orderedSectionCues.push(subCue);
        if (subHlCue) orderedSectionCues.push(subHlCue);
        if (dividerCue) orderedSectionCues.push(dividerCue);
        if (questionCue) orderedSectionCues.push(questionCue);
        if (qHlCue) orderedSectionCues.push(qHlCue);
        if (bridgeCue) orderedSectionCues.push(bridgeCue);
        if (bHlCue) orderedSectionCues.push(bHlCue);

        for (const c of orderedSectionCues) {
          const idx = bodyCues.indexOf(c);
          if (idx !== -1) bodyCues.splice(idx, 1);
        }
        bodyCues.unshift(...orderedSectionCues);

        if (subIdx !== -1 && sHlIdx !== -1 && subIdx > sHlIdx) {
          console.error(`  ❌ [${slideFile}] Subtitle cue "{cue:sub}" must appear before subtitle highlight "{cue:${subHlCue}}" in voiceover.`);
          totalErrors++;
        }
        if (sHlIdx !== -1 && divIdx !== -1 && sHlIdx > divIdx) {
          console.error(`  ❌ [${slideFile}] Subtitle highlight "{cue:${subHlCue}}" must appear before divider cue "{cue:${dividerCue}}" in voiceover.`);
          totalErrors++;
        }
        if (divIdx !== -1 && qIdx !== -1 && divIdx > qIdx) {
          console.error(`  ❌ [${slideFile}] Divider cue "{cue:${dividerCue}}" must appear before Leitfrage cue "{cue:${questionCue}}" in voiceover.`);
          totalErrors++;
        }
        if (qIdx !== -1 && bIdx !== -1 && qIdx > bIdx) {
          console.error(`  ❌ [${slideFile}] Leitfrage cue "{cue:${questionCue}}" must appear before Bridge cue "{cue:${bridgeCue}}" in voiceover.`);
          totalErrors++;
        }

        if (qSlotMatch) {
          if (!qHlMatch) {
            console.error(`  ❌ [${slideFile}] Section slide Leitfrage must contain an inline highlight marker {cue:hl-...}.`);
            totalErrors++;
          } else {
            const qHlIdx = voCues.indexOf(qHlMatch[1]);
            if (qIdx !== -1 && qHlIdx !== -1 && qIdx > qHlIdx) {
              console.error(`  ❌ [${slideFile}] Leitfrage cue "{cue:${questionCue}}" must appear before Leitfrage highlight "{cue:${qHlMatch[1]}}" in voiceover.`);
              totalErrors++;
            }
            if (bIdx !== -1 && qHlIdx !== -1 && qHlIdx > bIdx) {
              console.error(`  ❌ [${slideFile}] Leitfrage highlight "{cue:${qHlMatch[1]}}" must appear before Bridge cue "{cue:${bridgeCue}}" in voiceover.`);
              totalErrors++;
            }
          }
        }

        if (bSlotMatch) {
          if (!bHlMatch) {
            console.error(`  ❌ [${slideFile}] Section slide Bridge must contain an inline highlight marker {cue:hl-...}.`);
            totalErrors++;
          } else {
            const bHlIdx = voCues.indexOf(bHlMatch[1]);
            if (bIdx !== -1 && bHlIdx !== -1 && bIdx > bHlIdx) {
              console.error(`  ❌ [${slideFile}] Bridge cue "{cue:${bridgeCue}}" must appear before Bridge highlight "{cue:${bHlMatch[1]}}" in voiceover.`);
              totalErrors++;
            }
          }
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
        if (/\baccent\s*:\s*["'][^"']+["']/.test(bl)) {
          console.error(`  ❌ [${slideFile}] Deprecated "accent" prop detected in BulletList item. Bullet points automatically receive ton-in-ton coloring from their container accent.`);
          totalErrors++;
        }
        if (/\bnum\s*:\s*["'][^"']+["']/.test(bl)) {
          console.error(`  ❌ [${slideFile}] Deprecated "num" property detected in BulletList item. Bullet points support only monochrome vector icons via "icon: ...".`);
          totalErrors++;
        }
      }
      if (/<CalloutBox[^>]*\bcue\s*=/g.test(body)) {
        console.error(`  ❌ [${slideFile}] Subelement cue detected on <CalloutBox>. Subelements must not be faded in; use inline text-highlights {cue:...}text{/cue} instead.`);
        totalErrors++;
      }
      if (/<CalloutBox[^>]*\bcolor\s*=/g.test(body)) {
        console.error(`  ❌ [${slideFile}] Deprecated "color" attribute on <CalloutBox>. Callouts automatically inherit color from the container.`);
        totalErrors++;
      }
      if (/<EntityGraphVisual[^>]*\b(?:cue|data-cue)\s*=/g.test(body)) {
        console.error(`  ❌ [${slideFile}] Subelement cue detected on <EntityGraphVisual>. Subelements must not be faded in; attach the block cue to the parent BentoCard instead.`);
        totalErrors++;
      }

      // 4c. Monochrome Icon & Zero-Emoji Enforcement
      const emojiMatch = content.match(/\p{Extended_Pictographic}/u);
      if (emojiMatch) {
        console.error(
          `  ❌ [${slideFile}] Emoji "${emojiMatch[0]}" detected. Emojis are prohibited on presentation slides; use monochrome vector icons (e.g. 'target', 'trending-down', 'keyboard', 'check') or sequential numbers ('num: ...').`
        );
        totalErrors++;
      }

      const ALLOWED_ICONS = new Set([
        'check', '✓', 'cross', '✗', 'arrow', '→', 'alert', 'warning',
        'target', 'trending-down', 'trending-up', 'keyboard', 'document', 'file',
        'shield', 'zap', 'cpu', 'database', 'search', 'network', 'code', 'sparkles',
        'globe', 'linkedin', 'github'
      ]);
      for (const bl of bulletListBlocks) {
        const iconMatches = bl.matchAll(/\bicon\s*:\s*["']([^"']+)["']/g);
        for (const im of iconMatches) {
          const iconName = im[1];
          if (!ALLOWED_ICONS.has(iconName)) {
            console.error(
              `  ❌ [${slideFile}] Unregistered icon "${iconName}" in BulletList. Allowed monochrome icons are: ${Array.from(ALLOWED_ICONS).join(', ')}`
            );
            totalErrors++;
          }
        }
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
      if (!isSyntaxOnly && voiceoverText.trim()) {
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
        const normalizedVo = voiceoverText.replace(/\r\n/g, '\n').trim();
        const expectedHash = crypto.createHash('md5').update(`${GENERATOR_VERSION}:${spokenText}:${normalizedVo}`).digest('hex');
        if (audioCache[slideId] !== expectedHash) {
          console.error(
            `  ❌ [${slideFile}] Audio is out-of-date: Spoken text was modified since last audio synthesis (hash mismatch). Run "npm run audio:presentations".`
          );
          totalErrors++;
        }
      }
    }

    // 7. Backward Audio Orphan Check: Detect leftover .mp3 / .cues.json without matching slide
    if (!isSyntaxOnly && fs.existsSync(audioDir)) {
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

    // 8. PDF Handouts & Visual Fingerprint Cache Integrity Gate
    if (!isSyntaxOnly) {
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

      const styleHash = computeSlideStyleHash();
      const { deckHash, slideHashes } = computePresentationDeckHash(presentationFolder, styleHash);
      const visualCache = loadVisualCache(presentationFolder);

      if (!visualCache) {
        console.error(
          `  ❌ [cache] Missing visual fingerprint cache ".visual-cache.json" for "${presentationFolder}". Run "npm run export:slides".`
        );
        totalErrors++;
      } else {
        if (visualCache.styleHash !== styleHash) {
          console.error(
            `  ❌ [style] Slide styles or layout components were modified (style hash mismatch). Run "npm run export:slides".`
          );
          totalErrors++;
        }

        if (visualCache.deckHash !== deckHash) {
          console.error(
            `  ❌ [pdf] Presentation visual content or assets were modified since PDF export (deck hash mismatch). Run "npm run export:slides".`
          );
          totalErrors++;
        }
      }

      // 9. Slide WebP Thumbnails Existence & Freshness Check
      const thumbnailsDir = path.join(presentationPath, 'thumbnails');
      if (!fs.existsSync(thumbnailsDir)) {
        console.error(`  ❌ [thumbnail] Missing "thumbnails/" directory for "${presentationFolder}". Run "npm run export:slides-thumbs".`);
        totalErrors++;
      } else {
        // Check each active slide has a thumbnail and matches fingerprint
        for (const slideId of activeSlideIds) {
          const thumbPath = path.join(thumbnailsDir, `${slideId}.webp`);
          if (!fs.existsSync(thumbPath)) {
            console.error(`  ❌ [thumbnail] Missing thumbnail for slide "${slideId}": "thumbnails/${slideId}.webp". Run "npm run export:slides-thumbs".`);
            totalErrors++;
          } else if (visualCache && visualCache.slides[slideId] !== slideHashes[slideId]) {
            console.error(`  ❌ [thumbnail] Slide "${slideId}" visual content was modified since thumbnail export (fingerprint mismatch). Run "npm run export:slides-thumbs".`);
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

        // Check for orphan cache entries
        if (visualCache && visualCache.slides) {
          for (const cachedId of Object.keys(visualCache.slides)) {
            if (!activeSlideIds.has(cachedId)) {
              console.error(`  ❌ [cache-orphan] Orphaned slide entry "${cachedId}" in ".visual-cache.json" has no matching slide in "slides/". Run "npm run export:slides-thumbs".`);
              totalErrors++;
            }
          }
        }
      }
    }
  }

  if (totalErrors > 0) {
    console.error(`\n[Slide Validator] Validation FAILED with ${totalErrors} error(s) and ${totalWarnings} warning(s) across ${totalSlides} slides.\n`);
    process.exit(1);
  } else {
    if (isSyntaxOnly) {
      console.log(`\n[Slide Validator] Passed! All ${totalSlides} slides have valid frontmatter, cues, highlights, and structure (${totalWarnings} warning(s)).\n`);
    } else {
      console.log(`\n[Slide Validator] Passed! All ${totalSlides} slides, audio assets, cues, and PDF handouts are valid and up-to-date (${totalWarnings} warning(s)).\n`);
    }
  }
}

validateSlides();
