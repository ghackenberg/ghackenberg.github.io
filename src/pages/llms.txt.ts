import { getCollection } from "astro:content";
import { formatAuthorsPlain } from "@commons/shared/authors";

const oneLine = (text?: string) => (text ? text.replace(/\s+/g, " ").trim() : "");

export async function GET() {
  const [
    posts,
    publications,
    presentations,
    courses,
    courseModules,
    projects,
    services,
    serviceModules,
    newsletters,
    visualizations,
    tags,
    degrees,
    experiences,
    profiles,
  ] = await Promise.all([
    getCollection("posts"),
    getCollection("publications"),
    getCollection("presentations"),
    getCollection("courses"),
    getCollection("course-modules"),
    getCollection("projects"),
    getCollection("services"),
    getCollection("service-modules"),
    getCollection("newsletters"),
    getCollection("visualizations"),
    getCollection("tags"),
    getCollection("degrees"),
    getCollection("experiences"),
    getCollection("profiles"),
  ]);

  const sortedPosts = posts.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
  const sortedPublications = publications.sort((a, b) => {
    const da = a.data.pubDate instanceof Date ? a.data.pubDate.getTime() : new Date(a.data.pubDate || "").getTime();
    const db = b.data.pubDate instanceof Date ? b.data.pubDate.getTime() : new Date(b.data.pubDate || "").getTime();
    return db - da;
  });
  const sortedPresentations = presentations.sort((a, b) => {
    const da = a.data.pubDate instanceof Date ? a.data.pubDate.getTime() : new Date(a.data.pubDate || "").getTime();
    const db = b.data.pubDate instanceof Date ? b.data.pubDate.getTime() : new Date(b.data.pubDate || "").getTime();
    return db - da;
  });
  const sortedCourseModules = courseModules.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const sortedProjects = projects.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const sortedServices = services.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const sortedServiceModules = serviceModules.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const sortedNewsletters = newsletters.sort((a, b) => b.data.issueNumber - a.data.issueNumber);
  const sortedTags = tags.sort((a, b) => a.data.title.localeCompare(b.data.title));
  const sortedDegrees = degrees.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const sortedExperiences = experiences.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const sortedProfiles = profiles.sort((a, b) => a.data.order - b.data.order);

  const degreeLines = sortedDegrees
    .map((d) => `  - ${d.data.degree} in ${d.data.program} - ${d.data.organization.name} (${d.data.startYear}-${d.data.endYear ?? "Present"})`)
    .join("\n");
  const experienceLines = sortedExperiences
    .map((e) => `  - ${e.data.title} - ${e.data.organization.name} (${e.data.startYear}-${e.data.endYear ?? "Present"})`)
    .join("\n");
  const profileLines = sortedProfiles
    .map((p) => `  - ${p.data.name}: ${p.data.url}`)
    .join("\n");

  let output = `# Dr. Georg Hackenberg

> Professor for Industrial Informatics at UAP - University of Applied Sciences Upper Austria (Technology Campus Wels) and enterprise software architect. He bridges academic systems engineering with autonomous agent workflows and modern digital production across Web, YouTube, LinkedIn, and GitHub. Founder of CADdrive (caddrive.com) and Mentawise (mentawise.com).

## Core Identity & Credentials
- **Name**: Dr. rer. nat. Georg Hermann Richard Hackenberg, M.Sc., B.Sc.
- **Role**: Professor for Industrial Informatics & Enterprise Software Architect
- **Institution**: UAP – University of Applied Sciences Upper Austria, Technology Campus Wels, Austria
- **Email**: georg.hackenberg@fh-wels.at
- **Primary Website**: https://hackenberg.tech
- **Key Projects**: CADdrive (https://caddrive.com), Mentawise (https://mentawise.com)
- **Academic Degrees**:
${degreeLines}
- **Professional Experience**:
${experienceLines}
- **Profiles & Knowledge Graph**:
${profileLines}

## Full Content Export for LLMs & RAG
- [Full Text Corpus (llms-full.txt)](https://hackenberg.tech/llms-full.txt): Complete structured text of all blog posts, publication abstracts, course outlines, software projects, business services, email newsletters, and interactive visualizations.
- [JSON Content Manifest](https://hackenberg.tech/content-manifest.json): Machine-readable index of all published entries and metadata.
- [RSS XML Feed](https://hackenberg.tech/rss.xml): RSS feed of all published updates across all content domains.

## Key Sections & Topics

### Blog Posts
- [Blog Posts Index](https://hackenberg.tech/posts): Technical essays on AI agents, Web-LLMs, system architecture, and software engineering.
`;

  for (const post of sortedPosts) {
    const desc = oneLine(post.data.description);
    output += `- [${post.data.title}](https://hackenberg.tech/posts/${post.id}/)${desc ? `: ${desc}` : ""}\n`;
  }

  output += `\n### Reviewed Publications
- [Publications Index](https://hackenberg.tech/publications): Peer-reviewed research papers, conference proceedings, and book chapters on industrial informatics and systems engineering.
`;
  for (const pub of sortedPublications) {
    const authors = formatAuthorsPlain(pub.data.authors);
    const venue = pub.data.book ? ` (${pub.data.book})` : "";
    output += `- [${pub.data.title}](https://hackenberg.tech/publications/${pub.id}/): ${authors}${venue}\n`;
  }

  output += `\n### Interactive Presentations
- [Presentations Index](https://hackenberg.tech/presentations): Interactive slide decks, voiceover keynotes, and presentation handouts on SEO/GEO/AIO, software architecture, and industrial computing.
`;
  for (const pres of sortedPresentations) {
    const desc = oneLine(pres.data.description || pres.data.subtitle);
    output += `- [${pres.data.title}](https://hackenberg.tech/presentations/${pres.id}/)${desc ? `: ${desc}` : ""}\n`;
  }

  output += `\n### University Courses & Modules
- [Courses Index](https://hackenberg.tech/courses): University courses on software architecture, industrial computing, database systems, and software engineering principles.
`;
  for (const course of courses) {
    const desc = oneLine(course.data.description);
    output += `- [${course.data.title}](https://hackenberg.tech/courses/${course.id}/)${desc ? `: ${desc}` : ""}\n`;
  }
  for (const mod of sortedCourseModules) {
    const modSlug = mod.id.split("/").pop();
    const desc = oneLine(mod.data.description);
    output += `- [Course Module: ${mod.data.title}](https://hackenberg.tech/courses/${mod.data.courseId}/${modSlug}/)${desc ? `: ${desc}` : ""}\n`;
  }

  output += `\n### Software Projects
- [Projects Index](https://hackenberg.tech/projects): Enterprise systems, open source repositories, and web applications including CADdrive and Mentawise.
`;
  for (const project of sortedProjects) {
    const desc = oneLine(project.data.description);
    output += `- [${project.data.title} (TRL ${project.data.trl})](https://hackenberg.tech/projects/${project.id}/)${desc ? `: ${desc}` : ""}\n`;
  }

  output += `\n### Engineering Services & Modules
- [Services Index](https://hackenberg.tech/services): High-impact technical consulting, executive training, architectural reviews, and model-driven software engineering modules.
`;
  for (const service of sortedServices) {
    const desc = oneLine(service.data.description);
    output += `- [${service.data.title}](https://hackenberg.tech/services/${service.id}/)${desc ? `: ${desc}` : ""}\n`;
  }
  for (const mod of sortedServiceModules) {
    const modSlug = mod.id.split("/").pop();
    const desc = oneLine(mod.data.description);
    output += `- [Service Module: ${mod.data.title}](https://hackenberg.tech/services/${mod.data.serviceId}/${modSlug}/)${desc ? `: ${desc}` : ""}\n`;
  }

  output += `\n### Email Newsletters
- [Newsletters Index](https://hackenberg.tech/newsletters): Curated engineering digests and updates on AI systems, architecture, and research.
`;
  for (const nl of sortedNewsletters) {
    const desc = oneLine(nl.data.description || nl.data.subtitle);
    output += `- [Issue #${nl.data.issueNumber}: ${nl.data.title}](https://hackenberg.tech/newsletters/${nl.id}/)${desc ? `: ${desc}` : ""}\n`;
  }

  output += `\n### Content Visualizations
- [Visualizations Index](https://hackenberg.tech/visualizations): Interactive 3D, WebGL, and force-directed graph visualizers and scientific simulation models.
`;
  for (const viz of visualizations) {
    const desc = oneLine(viz.data.description);
    output += `- [${viz.data.title}](https://hackenberg.tech/visualizations/${viz.id}/)${desc ? `: ${desc}` : ""}\n`;
  }

  output += `\n### Topic Tags
- [Tags Index](https://hackenberg.tech/tags): Structured cross-domain taxonomy connecting posts, publications, presentations, courses, projects, services, newsletters, and visualizations.
`;
  for (const tag of sortedTags) {
    const desc = oneLine(tag.data.description);
    output += `- [#${tag.data.title}](https://hackenberg.tech/tags/${tag.id}/)${desc ? `: ${desc}` : ""}\n`;
  }

  return new Response(output, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
