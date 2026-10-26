import { getCollection } from "astro:content";
import { formatAuthorsPlain } from "@commons/shared/authors";

const stripCues = (text: string) => (text ? text.replace(/\{(\/)?cue(?::[^}]+)?\}/g, "").trim() : "");

export async function GET() {
  const posts = await getCollection("posts");
  const presentations = await getCollection("presentations");
  const allSlides = await getCollection("slides");
  const publications = await getCollection("publications");
  const courses = await getCollection("courses");
  const projects = await getCollection("projects");
  const services = await getCollection("services");
  const modules = await getCollection("modules");
  const tags = await getCollection("tags");
  const degrees = await getCollection("degrees");
  const profiles = await getCollection("profiles");

  // Sort posts, presentations, and publications by date descending
  const sortedPosts = posts.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
  const sortedPresentations = presentations.sort((a, b) => {
    const da = a.data.pubDate instanceof Date ? a.data.pubDate.getTime() : new Date(a.data.pubDate || '').getTime();
    const db = b.data.pubDate instanceof Date ? b.data.pubDate.getTime() : new Date(b.data.pubDate || '').getTime();
    return db - da;
  });
  const sortedPublications = publications.sort((a, b) => {
    const da = a.data.pubDate instanceof Date ? a.data.pubDate.getTime() : new Date(a.data.pubDate || '').getTime();
    const db = b.data.pubDate instanceof Date ? b.data.pubDate.getTime() : new Date(b.data.pubDate || '').getTime();
    return db - da;
  });
  const sortedDegrees = degrees.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const sortedProfiles = profiles.sort((a, b) => a.data.order - b.data.order);

  const degreeLines = sortedDegrees
    .map((d) => `- ${d.data.degree} in ${d.data.program} - ${d.data.organization.name} (${d.data.startYear}-${d.data.endYear})`)
    .join("\n");
  const profileLines = sortedProfiles
    .map((p) => `- ${p.data.name} (${p.data.handle}): ${p.data.url}`)
    .join("\n");

  let output = `# Dr. Georg Hackenberg - Complete Website Corpus (llms-full.txt)

> Professor for Industrial Informatics at UAP - University of Applied Sciences Upper Austria (Technology Campus Wels) and enterprise software architect. He bridges academic systems engineering with autonomous agent workflows and modern digital production across Web, YouTube, LinkedIn, and GitHub. Founder of CADdrive (caddrive.com) and Mentawise (mentawise.com).
> Website: https://hackenberg.tech
> Contact: georg.hackenberg@fh-wels.at

---

## 1. About Dr. Georg Hackenberg

Dr. rer. nat. Georg Hermann Richard Hackenberg is a Full Professor for Industrial Informatics at UAP – University of Applied Sciences Upper Austria (Technology Campus Wels). He holds a Doctor of Natural Sciences (Dr. rer. nat.) in Software and Systems Engineering from the Technical University of Munich (TUM), a Master of Science (M.Sc.) in Software Systems Engineering from RWTH Aachen University, and a Bachelor of Science (B.Sc.) in Software & Internet Technology from the University of Mannheim. His academic research and software engineering practice bridge model-based systems engineering, cyber-physical systems simulation, knowledge graph architectures, and sovereign agentic AI workflows. He is the founder and architect of software platforms including CADdrive (https://caddrive.com) and Mentawise (https://mentawise.com).

### Academic Degrees & Education
${degreeLines}

### External Profiles & Identifiers
${profileLines}

---

## 2. Blog Posts & Technical Articles

`;

  for (const post of sortedPosts) {
    const formattedDate = post.data.pubDate.toISOString().split('T')[0];
    const tags = post.data.tags ? post.data.tags.join(', ') : '';
    output += `### ${post.data.title}\n`;
    output += `- URL: https://hackenberg.tech/posts/${post.id}/\n`;
    output += `- Date: ${formattedDate}\n`;
    if (tags) output += `- Tags: ${tags}\n`;
    if (post.data.description) output += `- Summary: ${post.data.description}\n`;
    output += `\n${post.body}\n\n---\n\n`;
  }

  output += `## 3. Academic Publications & Research Papers\n\n`;
  for (const pub of sortedPublications) {
    const pubDateStr = pub.data.pubDate instanceof Date ? pub.data.pubDate.toISOString().split('T')[0] : String(pub.data.pubDate);
    output += `### ${pub.data.title}\n`;
    output += `- URL: https://hackenberg.tech/publications/${pub.id}/\n`;
    output += `- Date/Venue: ${pubDateStr}${pub.data.book ? ` (${pub.data.book})` : ''}\n`;
    output += `- Authors: ${formatAuthorsPlain(pub.data.authors)}\n`;
    if (pub.data.abstract) output += `- Abstract: ${pub.data.abstract}\n`;
    if (pub.data.bibtex) output += `\n\`\`\`bibtex\n${pub.data.bibtex}\n\`\`\`\n`;
    output += `\n${pub.body}\n\n---\n\n`;
  }

  output += `## 4. Keynote Presentations & Slide Decks\n\n`;
  for (const pres of sortedPresentations) {
    const rawDate = pres.data.pubDate instanceof Date ? pres.data.pubDate.toISOString().split('T')[0] : (pres.data.pubDate || '');
    const tags = pres.data.tags ? pres.data.tags.join(', ') : '';
    const deckSlides = allSlides
      .filter((s) => s.id.startsWith(pres.id))
      .sort((a, b) => a.id.localeCompare(b.id));

    output += `### ${pres.data.title}\n`;
    output += `- URL: https://hackenberg.tech/presentations/${pres.id}/\n`;
    if (pres.data.subtitle) output += `- Subtitle: ${pres.data.subtitle}\n`;
    output += `- Date: ${rawDate}\n`;
    if (tags) output += `- Tags: ${tags}\n`;
    if (pres.data.description) output += `- Summary: ${pres.data.description}\n`;
    if (pres.body) output += `\n${pres.body}\n`;

    if (deckSlides.length > 0) {
      output += `\n#### Spoken Transcript & Slide Sequence (${deckSlides.length} Slides)\n\n`;
      deckSlides.forEach((slide, idx) => {
        const slideNum = String(idx + 1).padStart(2, '0');
        const cleanSub = stripCues(slide.data.subtitle || '');
        const cleanVoice = stripCues(slide.data.voiceover || '');
        output += `##### Slide ${slideNum}: ${slide.data.title}${cleanSub ? ` — ${cleanSub}` : ''}\n`;
        if (cleanVoice) {
          output += `${cleanVoice}\n\n`;
        }
      });
    }
    output += `---\n\n`;
  }

  output += `## 5. University Courses & Educational Content\n\n`;
  for (const course of courses) {
    output += `### ${course.data.title}\n`;
    output += `- URL: https://hackenberg.tech/courses/${course.id}/\n`;
    output += `- Repository: ${course.data.repoName}\n`;
    output += `- Language: ${course.data.inLanguage}\n`;
    if (course.data.description) output += `- Description: ${course.data.description}\n`;
    if (course.data.learningGoals && course.data.learningGoals.length > 0) {
      output += `- Learning Goals:\n  * ${course.data.learningGoals.join('\n  * ')}\n`;
    }
    output += `\n${course.body}\n\n---\n\n`;
  }

  output += `## 6. Software Projects & Systems\n\n`;
  for (const project of projects) {
    output += `### ${project.data.title}\n`;
    output += `- URL: https://hackenberg.tech/projects/${project.id}/\n`;
    output += `- External Link: ${project.data.href}\n`;
    output += `- Technology Readiness Level: TRL ${project.data.trl}\n`;
    output += `- Description: ${project.data.description}\n`;
    if (project.data.tags && project.data.tags.length > 0) {
      output += `- Technologies: ${project.data.tags.join(', ')}\n`;
    }
    output += `\n${project.body}\n\n---\n\n`;
  }

  output += `## 7. Business Services & Modules\n\n`;
  for (const service of services) {
    output += `### Service: ${service.data.title}\n`;
    output += `- URL: https://hackenberg.tech/services/${service.id}/\n`;
    output += `- Description: ${service.data.description}\n\n`;
  }

  for (const mod of modules) {
    output += `### Module: ${mod.data.title}\n`;
    output += `- Description: ${mod.data.description}\n`;
    if (mod.data.highlights && mod.data.highlights.length > 0) {
      output += `- Key Highlights:\n  * ${mod.data.highlights.join('\n  * ')}\n`;
    }
    output += `\n${mod.body}\n\n---\n\n`;
  }

  output += `## 8. Knowledge Index & Topic Tags\n\n`;
  const sortedTags = tags.sort((a, b) => a.data.title.localeCompare(b.data.title));
  for (const tag of sortedTags) {
    output += `### #${tag.data.title}\n`;
    output += `- URL: https://hackenberg.tech/tags/${tag.id}/\n`;
    output += `- Description: ${tag.data.description}\n\n`;
  }

  return new Response(output, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
