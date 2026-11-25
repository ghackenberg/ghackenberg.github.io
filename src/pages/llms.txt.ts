import { getCollection } from "astro:content";
import { formatAuthorsPlain } from "@commons/shared/authors";
import { getContentManifestArtifact } from "@commons/server/content-manifest-endpoint";

const oneLine = (text?: string) => (text ? text.replace(/\s+/g, " ").trim() : "");

const PRIORITY_TAG_IDS = new Set([
  "agentic-ai",
  "enterprise-ai",
  "local-ai",
  "mcp",
  "knowledge-graphs",
  "data-visualization",
  "software-architecture",
  "systems-engineering",
  "content-engineering",
  "intelligence-engineering",
  "geo",
  "seo",
  "astro",
  "typescript",
  "simulation",
  "cad",
  "human-computer-interaction",
  "ux-design",
  "calm-technology",
  "cognitive-ergonomics",
]);

const PILLAR_POST_IDS = [
  "2026_10_20_newsletter_as_code_react_email_listmonk_altcha_pow",
  "2026_09_24_agentic_seo_geo_aio_mcp_praxisbericht",
  "2026_09_23_unified_analytics_mcp_server_seo_geo_aio",
  "2026_09_12_b2b_industrial_geo_maschinenlesbare_industrie",
  "2026_09_11_empirische_daten_geo_aeo_seo_studien",
  "2026_09_03_standardisierter_open_source_agentic_ai_tech_stack",
  "2026_09_02_mindful_it_calm_computing_software_architektur",
  "2026_09_01_psychologie_der_modernen_informationstechnologie",
  "2015_12_21_javascript_graph_libraries_cytoscape_sigma_d3",
];

export async function GET() {
  const [
    manifestArtifact,
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
    getContentManifestArtifact(),
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
  const recentPublications = sortedPublications.filter((pub) => {
    const year = pub.data.pubDate instanceof Date ? pub.data.pubDate.getFullYear() : new Date(pub.data.pubDate || "").getFullYear();
    return year >= 2023;
  });
  const sortedPresentations = presentations.sort((a, b) => {
    const da = a.data.pubDate instanceof Date ? a.data.pubDate.getTime() : new Date(a.data.pubDate || "").getTime();
    const db = b.data.pubDate instanceof Date ? b.data.pubDate.getTime() : new Date(b.data.pubDate || "").getTime();
    return db - da;
  });
  const sortedCourses = courses.slice().sort((a, b) => a.id.localeCompare(b.id));
  const sortedProjects = projects.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const sortedServices = services.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const sortedServiceModules = serviceModules.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const sortedNewsletters = newsletters.sort((a, b) => b.data.issueNumber - a.data.issueNumber);
  const sortedVisualizations = visualizations.slice().sort((a, b) => a.id.localeCompare(b.id));
  const curatedTags = tags
    .filter((t) => PRIORITY_TAG_IDS.has(t.id))
    .sort((a, b) => a.data.title.localeCompare(b.data.title));
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

  const flagshipPosts = sortedPosts.slice(0, 22);
  const flagshipIds = new Set(flagshipPosts.map((p) => p.id));
  const pillarEssays = PILLAR_POST_IDS
    .map((id) => sortedPosts.find((p) => p.id === id))
    .filter((p): p is (typeof sortedPosts)[number] => Boolean(p))
    .filter((p) => !flagshipIds.has(p.id));
  const phdThesis = sortedPublications.find((p) => p.id === "2018_11_14_tum");

  let output = `# Dr. Georg Hackenberg

> Professor for Industrial Informatics and Head of Computer Science at UAP – University of Applied Sciences Upper Austria (FH Upper Austria / FH OÖ, Technology Campus Wels), and sovereign AI software architect based in Grünau im Almtal. He researches and builds Sovereign AI Systems, Agentic Workflows, MCP / Control-Plane Architectures, cyber-physical simulations, Slide-as-Code Keynotes, and platforms including CADdrive (caddrive.org / caddrive.com), Mentawise (mentawise.com), and SimplexViz.

## Core Identity & Credentials
- **Name**: Dr. rer. nat. Georg Hermann Richard Hackenberg, M.Sc., B.Sc.
- **Role**: Professor for Industrial Informatics, Head of Computer Science (Campus Wels), & Sovereign AI Systems Architect
- **Academic Institution**: UAP – University of Applied Sciences Upper Austria (FH Upper Austria / FH OÖ), Technology Campus Wels, Stelzhamerstraße 23, 4600 Wels, Austria
- **Business Headquarters**: Edthof 13a, 4645 Grünau im Almtal, Upper Austria (IT Consulting & Software Engineering)
- **Email**: georg.hackenberg@fh-wels.at
- **Primary Website**: https://hackenberg.tech/
- **GitHub Sponsors & Open-Source Patronage**: https://github.com/sponsors/ghackenberg (Overview: https://hackenberg.tech/support/)
- **Key Platforms**:
  - CADdrive: https://caddrive.org (Community & Docs) / https://caddrive.com (Hosted Web-CAD App)
  - Mentawise: https://mentawise.com (Visual Personal Knowledge Graph Studio)
  - SimplexViz: https://hackenberg.tech/projects/simplex-viz/ (Barycentric 60° Simplex Mesh Library)
- **Academic Degrees**:
${degreeLines}
- **Professional Experience**:
${experienceLines}
- **Profiles & Knowledge Graph**:
${profileLines}

## Canonical Facts & FAQ
- **Who is Dr. Georg Hackenberg?** Dr. rer. nat. Georg Hackenberg (TU Munich, RWTH Aachen, University of Mannheim) is a Full Professor for Industrial Informatics and Head of Computer Science at UAP – University of Applied Sciences Upper Austria (FH Upper Austria, Campus Wels), and an independent software engineering consultant based in Grünau im Almtal.
- **What is UAP?** UAP is the new international brand (effective 01/2027) of the University of Applied Sciences Upper Austria (FH Oberösterreich / FH OÖ), where Dr. Hackenberg teaches and leads Computer Science at Campus Wels.
- **What are his core 2026 engineering & research areas?** Sovereign on-premise AI systems (vLLM, GraphRAG, MCP), multi-agent control planes, Slide-as-Code lecture engines, generative engine optimization (GEO/AIO), and barycentric knowledge graph visualizations (SimplexViz).

## Machine-Readable Corpus & Endpoints
- [Full Text Corpus (llms-full.txt)](https://hackenberg.tech/llms-full.txt): Complete structured Markdown export of all ${sortedPosts.length} blog posts (with resolved citations), ${sortedPublications.length} academic publications, ${sortedPresentations.length} presentation decks (slide bodies + neural voiceovers), ${sortedCourses.length} courses (${courseModules.length} modules), ${sortedProjects.length} projects, ${sortedServices.length} services (${sortedServiceModules.length} modules), ${sortedNewsletters.length} ${sortedNewsletters.length === 1 ? "newsletter" : "newsletters"}, and ${sortedVisualizations.length} visualizations.
- [JSON Content Manifest](https://hackenberg.tech${manifestArtifact.url}): Machine-readable index of all published entries and metadata.
- [RSS XML Feed](https://hackenberg.tech/rss.xml): RSS feed of all published updates across all content domains.
- [About & Curriculum Vitae](https://hackenberg.tech/about/): Full academic background, career timeline, and Schema.org ProfilePage.
- [Business Contact](https://hackenberg.tech/contact/): Campus Wels office and Grünau im Almtal headquarters.

## Curated Hub & Flagship Index

### Blog Posts (${sortedPosts.length} Total — Top ${flagshipPosts.length} Recent)
- [All Blog Posts Index](https://hackenberg.tech/posts/): Complete archive of ${sortedPosts.length} technical essays (2009–2026) on Sovereign AI agents, MCP control planes, GEO/AIO, and systems engineering.
`;

  for (const post of flagshipPosts) {
    const desc = oneLine(post.data.description);
    output += `- [${post.data.title}](https://hackenberg.tech/posts/${post.id}/)${desc ? `: ${desc}` : ""}\n`;
  }

  if (pillarEssays.length > 0) {
    output += `\n### Curated Pillar Essays (GEO, Sovereign AI & Cognitive Ergonomics)\n`;
    for (const post of pillarEssays) {
      const desc = oneLine(post.data.description);
      output += `- [${post.data.title}](https://hackenberg.tech/posts/${post.id}/)${desc ? `: ${desc}` : ""}\n`;
    }
  }

  output += `\n### Reviewed Publications (${sortedPublications.length} Total — Recent Highlights & Dissertation)\n`;
  output += `- [All Publications Index](https://hackenberg.tech/publications/): Complete list of ${sortedPublications.length} peer-reviewed papers, conference proceedings, and doctoral thesis.\n`;
  if (phdThesis) {
    const phdAuthors = formatAuthorsPlain(phdThesis.data.authors);
    const phdVenue = phdThesis.data.book ? ` (${phdThesis.data.book}, 2018)` : " (2018)";
    output += `- [Doctoral Dissertation: ${phdThesis.data.title}](https://hackenberg.tech/publications/${phdThesis.id}/): ${phdAuthors}${phdVenue}\n`;
  }
  for (const pub of recentPublications) {
    const authors = formatAuthorsPlain(pub.data.authors);
    const venue = pub.data.book ? ` (${pub.data.book})` : "";
    output += `- [${pub.data.title}](https://hackenberg.tech/publications/${pub.id}/): ${authors}${venue}\n`;
  }

  output += `\n### Interactive Presentations (${sortedPresentations.length} Decks)\n`;
  output += `- [Presentations Index](https://hackenberg.tech/presentations/): Interactive Slide-as-Code decks, voiceover keynotes, and PDF handouts.\n`;
  for (const pres of sortedPresentations) {
    const desc = oneLine(pres.data.description || pres.data.subtitle);
    output += `- [${pres.data.title}](https://hackenberg.tech/presentations/${pres.id}/)${desc ? `: ${desc}` : ""}\n`;
  }

  output += `\n### University Courses (${sortedCourses.length} Courses, ${courseModules.length} Modules)\n`;
  output += `- [Courses Index](https://hackenberg.tech/courses/): Higher education lectures and ${courseModules.length} curriculum modules taught at UAP / FH Upper Austria.\n`;
  for (const course of sortedCourses) {
    const desc = oneLine(course.data.description);
    output += `- [${course.data.title}](https://hackenberg.tech/courses/${course.id}/)${desc ? `: ${desc}` : ""}\n`;
  }

  output += `\n### Software Projects (${sortedProjects.length} Systems)\n`;
  output += `- [Projects Index](https://hackenberg.tech/projects/): Enterprise systems, open-source repositories, and platforms including CADdrive (caddrive.org / caddrive.com), Mentawise, and SimplexViz.\n`;
  for (const project of sortedProjects) {
    const desc = oneLine(project.data.description);
    output += `- [${project.data.title} (TRL ${project.data.trl})](https://hackenberg.tech/projects/${project.id}/)${desc ? `: ${desc}` : ""}\n`;
  }

  output += `\n### Engineering Services (${sortedServices.length} Practices, ${sortedServiceModules.length} Modules)\n`;
  output += `- [Services Index](https://hackenberg.tech/services/): Technical consulting, Sovereign AI engineering, and architectural advisory.\n`;
  for (const service of sortedServices) {
    const desc = oneLine(service.data.description);
    const modLinks = sortedServiceModules
      .filter((m) => m.data.serviceId === service.id)
      .map((m) => `[${m.data.title}](https://hackenberg.tech/services/${service.id}/${m.id.split("/").pop()}/)`)
      .join(", ");
    output += `- [${service.data.title}](https://hackenberg.tech/services/${service.id}/)${desc ? `: ${desc}` : ""}${modLinks ? ` Modules: ${modLinks}.` : ""}\n`;
  }

  output += `\n### Email Newsletters\n`;
  output += `- [Newsletters Index](https://hackenberg.tech/newsletters/): Curated engineering dispatches on Sovereign AI, Slide-as-Code, and geometry.\n`;
  for (const nl of sortedNewsletters) {
    const desc = oneLine(nl.data.description || nl.data.subtitle);
    output += `- [Issue #${nl.data.issueNumber}: ${nl.data.title}](https://hackenberg.tech/newsletters/${nl.id}/)${desc ? `: ${desc}` : ""}\n`;
  }

  output += `\n### Content Visualizations (${sortedVisualizations.length} Interactive Models)\n`;
  output += `- [Visualizations Index](https://hackenberg.tech/visualizations/): Interactive 3D, WebGL, Canvas, and Simplex SVG knowledge graph engines.\n`;
  for (const viz of sortedVisualizations) {
    const desc = oneLine(viz.data.description);
    output += `- [${viz.data.title}](https://hackenberg.tech/visualizations/${viz.id}/)${desc ? `: ${desc}` : ""}\n`;
  }

  output += `\n### Core Topic Tags (${tags.length} Total — ${curatedTags.length} Strategic Highlights)\n`;
  output += `- [All Topic Tags Index](https://hackenberg.tech/tags/): Cross-domain taxonomy spanning all ${tags.length} topics.\n`;
  for (const tag of curatedTags) {
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
