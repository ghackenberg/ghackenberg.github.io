import { getCollection } from "astro:content";
import { formatAuthorsPlain, type AuthorEntry } from "@commons/shared/authors";
import { CITATION_GROUP_REGEX, generateCitationLabel, parseCitationGroup, type CitationRef } from "@commons/shared/citations";

const stripCues = (text: string) => (text ? text.replace(/\{(\/)?cue(?::[^}]+)?\}/g, "").trim() : "");

interface LlmsRefEntry extends Omit<CitationRef, "authors"> {
  id: string;
  title: string;
  authors?: AuthorEntry[];
  url?: string;
  doi?: string;
  booktitle?: string;
  journal?: string;
  publisher?: string;
  siteName?: string;
  howpublished?: string;
}

function buildRefLabelMap(refs?: LlmsRefEntry[]): Map<string, { label: string; ref: LlmsRefEntry }> {
  const map = new Map<string, { label: string; ref: LlmsRefEntry }>();
  if (!refs) return map;
  for (const ref of refs) {
    const label = generateCitationLabel(ref);
    map.set(ref.id, { label, ref });
  }
  return map;
}

function resolveInlineCitations(text: string, refMap: Map<string, { label: string; ref: LlmsRefEntry }>): string {
  if (!text) return "";
  return text.replace(CITATION_GROUP_REGEX, (fullMatch, inner: string) => {
    const keys = parseCitationGroup(inner);
    const resolved = keys.map((k) => refMap.get(k)?.label || k);
    return resolved.length > 0 ? `[${resolved.join("; ")}]` : fullMatch;
  });
}

function formatReferenceLines(refs: LlmsRefEntry[] | undefined, refMap: Map<string, { label: string; ref: LlmsRefEntry }>): string {
  if (!refs || refs.length === 0) return "";
  const lines = refs.map((ref) => {
    const label = refMap.get(ref.id)?.label || ref.id;
    const authors = Array.isArray(ref.authors) ? formatAuthorsPlain(ref.authors) : "";
    const venue = ref.booktitle || ref.journal || ref.siteName || ref.publisher || ref.howpublished || "";
    const year = ref.year ? ` (${ref.year})` : "";
    const url = ref.doi ? `https://doi.org/${ref.doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")}` : ref.url || "";
    return `- **[${label}]** ${authors ? `${authors}${year}: ` : ""}*${ref.title}*${venue ? `, ${venue}` : ""}${url ? ` — ${url}` : ""}`;
  });
  return `\n#### References\n${lines.join("\n")}\n`;
}

const SITE_ORIGIN = "https://hackenberg.tech";

function normalizeMarkdownLinksForLlm(markdown: string, baseEntityUrl: string): string {
  if (!markdown) return "";
  const normalizedBase = baseEntityUrl.endsWith("/") ? baseEntityUrl : `${baseEntityUrl}/`;
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  let fenceTicks = 0;

  const rewriteSegment = (segment: string): string =>
    segment.replace(/(!?\[[^\]]*\])\(([^)\s]+)((?:\s+"[^"]*")?)\)/g, (full, label: string, rawTarget: string, titlePart: string) => {
      if (
        rawTarget.startsWith("http://") ||
        rawTarget.startsWith("https://") ||
        rawTarget.startsWith("mailto:") ||
        rawTarget.startsWith("tel:") ||
        rawTarget.startsWith("#") ||
        rawTarget.startsWith("data:") ||
        rawTarget.startsWith("javascript:")
      ) {
        return full;
      }
      let resolvedTarget: string;
      if (rawTarget.startsWith("/")) {
        resolvedTarget = `${SITE_ORIGIN}${rawTarget}`;
      } else {
        try {
          resolvedTarget = new URL(rawTarget, normalizedBase).href;
        } catch {
          resolvedTarget = `${normalizedBase}${rawTarget.replace(/^\.\//, "")}`;
        }
      }
      return `${label}(${resolvedTarget}${titlePart || ""})`;
    });

  const outLines = lines.map((line) => {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(`{3,})/);
    if (fenceMatch) {
      const tickCount = fenceMatch[1].length;
      if (!inFence) {
        inFence = true;
        fenceTicks = tickCount;
      } else if (tickCount >= fenceTicks) {
        inFence = false;
        fenceTicks = 0;
      }
      return line;
    }
    if (inFence) return line;

    // Preserve inline code spans while rewriting Markdown links outside backticks
    return line
      .split(/(`[^`]*`)/g)
      .map((part, idx) => (idx % 2 === 1 ? part : rewriteSegment(part)))
      .join("");
  });

  return outLines.join("\n");
}

function cleanPostBodyForLlm(
  body: string,
  refMap: Map<string, { label: string; ref: LlmsRefEntry }>,
  baseEntityUrl: string
): string {
  if (!body) return "";
  let cleaned = resolveInlineCitations(body, refMap);
  cleaned = cleaned
    .replace(/<details[^>]*>/gi, "")
    .replace(/<\/details>/gi, "")
    .replace(/<summary[^>]*>([\s\S]*?)<\/summary>/gi, (_, title: string) => `**${title.trim()}**\n`)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return normalizeMarkdownLinksForLlm(cleaned, baseEntityUrl);
}

function extractMdxSlideText(body: string, refMap: Map<string, { label: string; ref: LlmsRefEntry }>): string {
  if (!body) return "";
  let text = body
    .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  text = stripCues(resolveInlineCitations(text, refMap));

  // Unwrap fenced code blocks inside JSX or extract clean prose/props
  const outLines: string[] = [];
  const rawLines = text.split(/\r?\n/);
  let inCode = false;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (trimmed.startsWith("```")) {
      inCode = !inCode;
      outLines.push(rawLine);
      continue;
    }
    if (inCode) {
      outLines.push(rawLine);
      continue;
    }

    // Extract string props from MDX components (title, subtitle, label, sublabel, desc, caption, summary, name, quote, author, code)
    const propMatches = [...trimmed.matchAll(/\b(?:title|subtitle|label|sublabel|desc|description|caption|summary|quote|statement|leftTitle|rightTitle|header)\s*[:=]\s*"([^"]+)"/g)];
    if (propMatches.length > 0 && (trimmed.startsWith("<") || trimmed.startsWith("{") || trimmed.startsWith("items="))) {
      for (const m of propMatches) {
        const val = m[1].trim();
        if (val && val !== "{frontmatter.title}" && val !== "{frontmatter.subtitle}") {
          outLines.push(`- ${val}`);
        }
      }
      continue;
    }

    // Extract numeric/unit pairs for MetricStat
    const metricMatch = trimmed.match(/\bvalue\s*=\s*"([^"]+)"/);
    if (metricMatch) {
      const unitMatch = trimmed.match(/\bunit\s*=\s*"([^"]+)"/);
      outLines.push(`- Metric: ${metricMatch[1]}${unitMatch ? ` ${unitMatch[1]}` : ""}`);
      continue;
    }

    // Skip pure JSX structural lines & braces
    if (
      /^<\/?[A-Z][A-Za-z0-9]*(?:\s|>|$)/.test(trimmed) ||
      /^(?:slot|ratio|cue|slideNumber|totalSlides|icon|variant|type|size|columns|align)=/.test(trimmed) ||
      /^[\[\]{}(),;]+$/.test(trimmed) ||
      trimmed === "/>" ||
      trimmed === ">"
    ) {
      continue;
    }

    // Strip inline HTML/JSX tags on mixed lines
    const plain = trimmed
      .replace(/<\/?[A-Za-z][A-Za-z0-9-]*(?:\s+[^>]*)?>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (plain) {
      outLines.push(plain);
    }
  }

  return outLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function GET() {
  const posts = await getCollection("posts");
  const presentations = await getCollection("presentations");
  const allSlides = await getCollection("slides");
  const publications = await getCollection("publications");
  const courses = await getCollection("courses");
  const courseModules = await getCollection("course-modules");
  const projects = await getCollection("projects");
  const services = await getCollection("services");
  const serviceModules = await getCollection("service-modules");
  const visualizations = await getCollection("visualizations");
  const newsletters = await getCollection("newsletters");
  const tags = await getCollection("tags");
  const degrees = await getCollection("degrees");
  const experiences = await getCollection("experiences");
  const profiles = await getCollection("profiles");

  const sortedPosts = posts.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
  const sortedPresentations = presentations.sort((a, b) => {
    const da = a.data.pubDate instanceof Date ? a.data.pubDate.getTime() : new Date(a.data.pubDate || "").getTime();
    const db = b.data.pubDate instanceof Date ? b.data.pubDate.getTime() : new Date(b.data.pubDate || "").getTime();
    return db - da;
  });
  const sortedPublications = publications.sort((a, b) => {
    const da = a.data.pubDate instanceof Date ? a.data.pubDate.getTime() : new Date(a.data.pubDate || "").getTime();
    const db = b.data.pubDate instanceof Date ? b.data.pubDate.getTime() : new Date(b.data.pubDate || "").getTime();
    return db - da;
  });
  const sortedCourses = courses.slice().sort((a, b) => a.id.localeCompare(b.id));
  const sortedProjects = projects.slice().sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const sortedVisualizations = visualizations.slice().sort((a, b) => a.id.localeCompare(b.id));
  const sortedDegrees = degrees.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const sortedExperiences = experiences.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const sortedProfiles = profiles.sort((a, b) => a.data.order - b.data.order);
  const sortedCourseModules = courseModules.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const sortedServices = services.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const sortedServiceModules = serviceModules.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const sortedNewsletters = newsletters.sort((a, b) => b.data.issueNumber - a.data.issueNumber);

  const degreeLines = sortedDegrees
    .map((d) => `- ${d.data.degree} in ${d.data.program} - ${d.data.organization.name} (${d.data.startYear}-${d.data.endYear ?? "Present"})`)
    .join("\n");
  const experienceLines = sortedExperiences
    .map((e) => `- ${e.data.title} - ${e.data.organization.name} (${e.data.startYear}-${e.data.endYear ?? "Present"})`)
    .join("\n");
  const profileLines = sortedProfiles
    .map((p) => `- ${p.data.name} (${p.data.handle}): ${p.data.url}`)
    .join("\n");

  let output = `# Dr. Georg Hackenberg - Complete Website Corpus (llms-full.txt)

> Professor for Industrial Informatics and Head of Computer Science at UAP – University of Applied Sciences Upper Austria (FH Upper Austria / FH OÖ, Technology Campus Wels) and enterprise software architect based in Grünau im Almtal. He bridges academic systems engineering with Sovereign AI Systems, autonomous agent workflows, and modern digital production across Web, YouTube, LinkedIn, and GitHub. Creator of CADdrive (https://caddrive.org / https://caddrive.com), Mentawise (https://mentawise.com), and SimplexViz (https://hackenberg.tech/projects/simplex-viz/).
> Website: https://hackenberg.tech/
> Contact: georg.hackenberg@fh-wels.at
> GitHub Sponsors & Open-Source Patronage: https://github.com/sponsors/ghackenberg (Overview: https://hackenberg.tech/support/)

---

## 1. About Dr. Georg Hackenberg

Dr. rer. nat. Georg Hermann Richard Hackenberg is a Full Professor for Industrial Informatics and Head of Computer Science at UAP – University of Applied Sciences Upper Austria (FH Upper Austria, Technology Campus Wels), and founder of an IT consulting & software engineering practice in Grünau im Almtal. He holds a Doctor of Natural Sciences (Dr. rer. nat.) in Software and Systems Engineering from the Technical University of Munich (TUM), a Master of Science (M.Sc.) in Software Systems Engineering from RWTH Aachen University, and a Bachelor of Science (B.Sc.) in Software & Internet Technology from the University of Mannheim. His academic research and software engineering practice bridge model-based systems engineering, cyber-physical systems simulation, knowledge graph architectures, and sovereign agentic AI workflows. He is the founder and architect of software platforms including CADdrive (https://caddrive.org and https://caddrive.com), Mentawise (https://mentawise.com), and SimplexViz (https://hackenberg.tech/projects/simplex-viz/).

### Professional Experience
${experienceLines}

### Academic Degrees & Education
${degreeLines}

### External Profiles & Identifiers
${profileLines}

---

## 2. Blog Posts & Technical Articles

`;

  for (const post of sortedPosts) {
    const formattedDate = post.data.pubDate.toISOString().split("T")[0];
    const postTags = post.data.tags ? post.data.tags.join(", ") : "";
    const refs = (post.data.references || []) as LlmsRefEntry[];
    const refMap = buildRefLabelMap(refs);
    const postUrl = `${SITE_ORIGIN}/posts/${post.id}/`;

    output += `### ${post.data.title}\n`;
    output += `- URL: ${postUrl}\n`;
    output += `- Date: ${formattedDate}\n`;
    output += `- Language: ${post.data.inLanguage || "de"}\n`;
    if (postTags) output += `- Tags: ${postTags}\n`;
    if (post.data.description) output += `- Summary: ${post.data.description}\n`;
    output += `\n${cleanPostBodyForLlm(post.body || "", refMap, postUrl)}\n`;
    output += normalizeMarkdownLinksForLlm(formatReferenceLines(refs, refMap), postUrl);
    output += `\n---\n\n`;
  }

  output += `## 3. Academic Publications & Research Papers\n\n`;
  for (const pub of sortedPublications) {
    const pubDateStr = pub.data.pubDate instanceof Date ? pub.data.pubDate.toISOString().split("T")[0] : String(pub.data.pubDate);
    const pubUrl = `${SITE_ORIGIN}/publications/${pub.id}/`;
    output += `### ${pub.data.title}\n`;
    output += `- URL: ${pubUrl}\n`;
    output += `- Date/Venue: ${pubDateStr}${pub.data.book ? ` (${pub.data.book})` : ""}\n`;
    output += `- Language: ${pub.data.inLanguage || "en"}\n`;
    output += `- Authors: ${formatAuthorsPlain(pub.data.authors)}\n`;
    if (pub.data.doi) output += `- DOI: https://doi.org/${pub.data.doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")}\n`;
    if (pub.data.publisherUrl) output += `- Publisher URL: ${pub.data.publisherUrl}\n`;
    if (pub.data.abstract) output += `- Abstract: ${pub.data.abstract}\n`;
    if (pub.data.bibtex) output += `\n\`\`\`bibtex\n${pub.data.bibtex}\n\`\`\`\n`;
    output += `\n${normalizeMarkdownLinksForLlm(pub.body || "", pubUrl)}\n\n---\n\n`;
  }

  output += `## 4. Keynote Presentations & Slide Decks\n\n`;
  for (const pres of sortedPresentations) {
    const rawDate = pres.data.pubDate instanceof Date ? pres.data.pubDate.toISOString().split("T")[0] : (pres.data.pubDate || "");
    const presTags = pres.data.tags ? pres.data.tags.join(", ") : "";
    const presUrl = `${SITE_ORIGIN}/presentations/${pres.id}/`;
    const deckSlides = allSlides
      .filter((s) => s.id.startsWith(pres.id))
      .sort((a, b) => a.id.localeCompare(b.id));

    output += `### ${pres.data.title}\n`;
    output += `- URL: ${presUrl}\n`;
    if (pres.data.subtitle) output += `- Subtitle: ${pres.data.subtitle}\n`;
    output += `- Date: ${rawDate}\n`;
    if (presTags) output += `- Tags: ${presTags}\n`;
    if (pres.data.description) output += `- Summary: ${pres.data.description}\n`;
    if (pres.body) output += `\n${normalizeMarkdownLinksForLlm(pres.body, presUrl)}\n`;

    if (deckSlides.length > 0) {
      output += `\n#### Slide Content & Spoken Transcript (${deckSlides.length} Slides)\n\n`;
      deckSlides.forEach((slide, idx) => {
        const slideNum = String(idx + 1).padStart(2, "0");
        const cleanSub = stripCues(slide.data.subtitle || "");
        const cleanVoice = stripCues(slide.data.voiceover || "");
        const slideRefs = (slide.data.references || []) as LlmsRefEntry[];
        const slideRefMap = buildRefLabelMap(slideRefs);
        const slideContent = normalizeMarkdownLinksForLlm(extractMdxSlideText(slide.body || "", slideRefMap), presUrl);
        const resolvedVoice = normalizeMarkdownLinksForLlm(resolveInlineCitations(cleanVoice, slideRefMap), presUrl);

        output += `##### Slide ${slideNum}: ${slide.data.title}${cleanSub ? ` — ${cleanSub}` : ""}\n`;
        if (slideContent) {
          output += `${slideContent}\n\n`;
        }
        if (resolvedVoice) {
          output += `Voiceover: ${resolvedVoice}\n\n`;
        }
        if (slideRefs.length > 0) {
          output += normalizeMarkdownLinksForLlm(formatReferenceLines(slideRefs, slideRefMap), presUrl) + "\n";
        }
      });
    }
    output += `---\n\n`;
  }

  output += `## 5. University Courses & Educational Content\n\n`;
  for (const course of sortedCourses) {
    const courseUrl = `${SITE_ORIGIN}/courses/${course.id}/`;
    output += `### ${course.data.title}\n`;
    output += `- URL: ${courseUrl}\n`;
    output += `- Repository: ${course.data.repoName}\n`;
    output += `- Language: ${course.data.inLanguage}\n`;
    if (course.data.description) output += `- Description: ${course.data.description}\n`;
    if (course.data.overview) output += `- Overview: ${course.data.overview}\n`;
    if (course.data.targetAudience) output += `- Target Audience: ${course.data.targetAudience}\n`;
    if (course.data.prerequisites && course.data.prerequisites.length > 0) {
      output += `- Prerequisites:\n  * ${course.data.prerequisites.join("\n  * ")}\n`;
    }
    if (course.data.learningGoals && course.data.learningGoals.length > 0) {
      output += `- Learning Goals:\n  * ${course.data.learningGoals.join("\n  * ")}\n`;
    }
    if (course.data.competencies && course.data.competencies.length > 0) {
      output += `- Competencies:\n${course.data.competencies.map((c) => `  * **${c.title}**: ${c.description}`).join("\n")}\n`;
    }
    if (course.data.syllabus && course.data.syllabus.length > 0) {
      output += `- Syllabus:\n${course.data.syllabus
        .map(
          (s) =>
            `  * Module ${s.moduleNumber} — **${s.title}**: ${s.description}${s.topics?.length ? ` (Topics: ${s.topics.join(", ")})` : ""}${s.tools?.length ? ` [Tools: ${s.tools.join(", ")}]` : ""}`
        )
        .join("\n")}\n`;
    }
    output += `\n${normalizeMarkdownLinksForLlm(course.body || "", courseUrl)}\n\n---\n\n`;
  }

  for (const mod of sortedCourseModules) {
    const modUrl = `${SITE_ORIGIN}/courses/${mod.data.courseId}/${mod.id.split("/").pop()}/`;
    output += `### Course Module: ${mod.data.title}\n`;
    output += `- URL: ${modUrl}\n`;
    output += `- Course: ${mod.data.courseId}\n`;
    output += `- Description: ${mod.data.description}\n`;
    if (mod.data.topics && mod.data.topics.length > 0) {
      output += `- Topics: ${mod.data.topics.join(", ")}\n`;
    }
    if (mod.data.tools && mod.data.tools.length > 0) {
      output += `- Tools: ${mod.data.tools.join(", ")}\n`;
    }
    if (mod.data.competencies && mod.data.competencies.length > 0) {
      output += `- Competencies:\n  * ${mod.data.competencies.join("\n  * ")}\n`;
    }
    output += `\n${normalizeMarkdownLinksForLlm(mod.body || "", modUrl)}\n\n---\n\n`;
  }

  output += `## 6. Software Projects & Systems\n\n`;
  for (const project of sortedProjects) {
    const projectUrl = `${SITE_ORIGIN}/projects/${project.id}/`;
    output += `### ${project.data.title}\n`;
    output += `- URL: ${projectUrl}\n`;
    if (project.data.href) output += `- External Link: ${project.data.href}\n`;
    output += `- Technology Readiness Level: TRL ${project.data.trl}\n`;
    output += `- Description: ${project.data.description}\n`;
    if (project.data.tags && project.data.tags.length > 0) {
      output += `- Technologies: ${project.data.tags.join(", ")}\n`;
    }
    if (project.data.challenge) output += `- Challenge: ${project.data.challenge}\n`;
    if (project.data.solution) output += `- Solution: ${project.data.solution}\n`;
    if (project.data.keyCapabilities && project.data.keyCapabilities.length > 0) {
      output += `- Key Capabilities:\n${project.data.keyCapabilities.map((k) => `  * **${k.title}**: ${k.description}`).join("\n")}\n`;
    }
    if (project.data.techStackHighlights && project.data.techStackHighlights.length > 0) {
      output += `- Tech Stack Highlights:\n${project.data.techStackHighlights.map((t) => `  * **${t.category}**: ${t.technologies.join(", ")}`).join("\n")}\n`;
    }
    if (project.data.outcomes && project.data.outcomes.length > 0) {
      output += `- Outcomes:\n  * ${project.data.outcomes.join("\n  * ")}\n`;
    }
    output += `\n${normalizeMarkdownLinksForLlm(project.body || "", projectUrl)}\n\n---\n\n`;
  }

  output += `## 7. Business Services & Modules\n\n`;
  for (const service of sortedServices) {
    const serviceUrl = `${SITE_ORIGIN}/services/${service.id}/`;
    output += `### Service: ${service.data.title}\n`;
    output += `- URL: ${serviceUrl}\n`;
    output += `- Description: ${service.data.description}\n`;
    if (service.data.targetAudience && service.data.targetAudience.length > 0) {
      output += `- Target Audience: ${service.data.targetAudience.join("; ")}\n`;
    }
    if (service.data.guidingPrinciples && service.data.guidingPrinciples.length > 0) {
      output += `- Guiding Principles:\n${service.data.guidingPrinciples.map((g) => `  * **${g.title}**: ${g.description}`).join("\n")}\n`;
    }
    if (service.data.strategicPillars && service.data.strategicPillars.length > 0) {
      output += `- Strategic Pillars:\n  * ${service.data.strategicPillars.join("\n  * ")}\n`;
    }
    if (service.data.techFoundations && service.data.techFoundations.length > 0) {
      output += `- Technical Stack: ${service.data.techFoundations.join(", ")}\n`;
    }
    if (service.data.engagementFormats && service.data.engagementFormats.length > 0) {
      output += `- Engagement Formats:\n${service.data.engagementFormats.map((f) => `  * **${f.title}** (${f.duration}): ${f.description}`).join("\n")}\n`;
    }
    if (service.data.keyOutcomes && service.data.keyOutcomes.length > 0) {
      output += `- Key Outcomes:\n  * ${service.data.keyOutcomes.join("\n  * ")}\n`;
    }
    if (service.data.tags && service.data.tags.length > 0) {
      output += `- Tags: ${service.data.tags.join(", ")}\n`;
    }
    if (service.body) {
      output += `\n${normalizeMarkdownLinksForLlm(service.body, serviceUrl)}\n`;
    }
    output += `\n---\n\n`;
  }

  for (const mod of sortedServiceModules) {
    const modUrl = `${SITE_ORIGIN}/services/${mod.data.serviceId}/${mod.id.split("/").pop()}/`;
    output += `### Module: ${mod.data.title}\n`;
    output += `- URL: ${modUrl}\n`;
    output += `- Service: ${mod.data.serviceId}\n`;
    output += `- Description: ${mod.data.description}\n`;
    if (mod.data.duration) output += `- Duration: ${mod.data.duration}\n`;
    if (mod.data.format) output += `- Format: ${mod.data.format}\n`;
    if (mod.data.delivery) output += `- Delivery: ${mod.data.delivery}\n`;
    if (mod.data.highlights && mod.data.highlights.length > 0) {
      output += `- Key Highlights:\n  * ${mod.data.highlights.join("\n  * ")}\n`;
    }
    if (mod.data.inputs && mod.data.inputs.length > 0) {
      output += `- Required Inputs:\n  * ${mod.data.inputs.join("\n  * ")}\n`;
    }
    if (mod.data.outputs && mod.data.outputs.length > 0) {
      output += `- Deliverables:\n  * ${mod.data.outputs.join("\n  * ")}\n`;
    }
    if (mod.data.methodologyDescription) {
      output += `- Methodology: ${mod.data.methodologyDescription}\n`;
    }
    if (mod.data.methodologyPhases && mod.data.methodologyPhases.length > 0) {
      output += `- Methodology Phases:\n${mod.data.methodologyPhases.map((p) => `  * **${p.title}**: ${p.description}`).join("\n")}\n`;
    }
    output += `\n${normalizeMarkdownLinksForLlm(mod.body || "", modUrl)}\n\n---\n\n`;
  }

  output += `## 8. Technical Newsletters\n\n`;
  for (const nl of sortedNewsletters) {
    const nlDate = nl.data.pubDate instanceof Date ? nl.data.pubDate.toISOString().split("T")[0] : String(nl.data.pubDate);
    const nlUrl = `${SITE_ORIGIN}/newsletters/${nl.id}/`;
    output += `### Issue #${nl.data.issueNumber}: ${nl.data.title}\n`;
    output += `- URL: ${nlUrl}\n`;
    if (nl.data.subtitle) output += `- Subtitle: ${nl.data.subtitle}\n`;
    output += `- Date: ${nlDate}\n`;
    output += `- Description: ${nl.data.description}\n`;
    if (nl.data.tags && nl.data.tags.length > 0) {
      output += `- Tags: ${nl.data.tags.join(", ")}\n`;
    }
    output += `\n${normalizeMarkdownLinksForLlm(nl.body || "", nlUrl)}\n\n---\n\n`;
  }

  output += `## 9. Interactive Visualizations\n\n`;
  for (const viz of sortedVisualizations) {
    const vizUrl = `${SITE_ORIGIN}/visualizations/${viz.id}/`;
    output += `### ${viz.data.title}\n`;
    output += `- URL: ${vizUrl}\n`;
    output += `- Description: ${viz.data.description}\n`;
    if (viz.data.tags && viz.data.tags.length > 0) {
      output += `- Tags: ${viz.data.tags.join(", ")}\n`;
    }
    if (viz.data.specs) {
      output += `- Specs: Backend=${viz.data.specs.renderingBackend}, Topology=${viz.data.specs.spatialTopology}, Capacity=${viz.data.specs.nodeCapacity}, Solver=${viz.data.specs.physicsSolver}, Complexity=${viz.data.specs.computationalComplexity}\n`;
    }
    output += `\n${normalizeMarkdownLinksForLlm(viz.body || "", vizUrl)}\n\n---\n\n`;
  }

  output += `## 10. Knowledge Index & Topic Tags\n\n`;
  const sortedTags = tags.sort((a, b) => a.data.title.localeCompare(b.data.title));
  for (const tag of sortedTags) {
    output += `### #${tag.data.title}\n`;
    output += `- URL: https://hackenberg.tech/tags/${tag.id}/\n`;
    output += `- Description: ${tag.data.description}\n\n`;
  }

  return new Response(output, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
