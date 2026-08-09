import { getCollection } from "astro:content";

export async function GET() {
  const posts = await getCollection("posts");
  const publications = await getCollection("publications");
  const courses = await getCollection("courses");
  const projects = await getCollection("projects");
  const services = await getCollection("services");
  const modules = await getCollection("modules");

  // Sort posts by date descending
  const sortedPosts = posts.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());

  let output = `# Dr. Georg Hackenberg - Complete Website Corpus (llms-full.txt)

> Full Professor for Industrial Informatics at the University of Applied Sciences Upper Austria (School of Engineering, Wels). Software engineer, digital entrepreneur, and researcher specializing in industrial informatics, knowledge graph architectures, model-based system validation, and AI agent integration.
> Website: https://ghackenberg.github.io
> Contact: georg.hackenberg@fh-wels.at

---

## 1. About Dr. Georg Hackenberg

Dr. Georg Hackenberg is a Full Professor for Industrial Informatics at the University of Applied Sciences Upper Austria (FH OÖ, Campus Wels). He holds a Doctorate in Computer Science and has extensive academic and industry experience in model-based software engineering, knowledge representation, automated system validation, and web applications. He is the founder/creator of software platforms including CADdrive (https://caddrive.com) and Mentawise (https://mentawise.com).

---

## 2. Blog Posts & Technical Articles

`;

  for (const post of sortedPosts) {
    const formattedDate = post.data.pubDate.toISOString().split('T')[0];
    const tags = post.data.tags ? post.data.tags.join(', ') : '';
    output += `### ${post.data.title}\n`;
    output += `- URL: https://ghackenberg.github.io/posts/${post.id}\n`;
    output += `- Date: ${formattedDate}\n`;
    if (tags) output += `- Tags: ${tags}\n`;
    if (post.data.description) output += `- Summary: ${post.data.description}\n`;
    output += `\n${post.body}\n\n---\n\n`;
  }

  output += `## 3. Academic Publications & Research Papers\n\n`;
  for (const pub of publications) {
    output += `### ${pub.data.title}\n`;
    output += `- URL: https://ghackenberg.github.io/publications/${pub.id}\n`;
    output += `- Date/Venue: ${pub.data.pubDate}${pub.data.book ? ` (${pub.data.book})` : ''}\n`;
    output += `- Authors: ${pub.data.author}\n`;
    if (pub.data.abstract) output += `- Abstract: ${pub.data.abstract}\n`;
    if (pub.data.bibtex) output += `\n\`\`\`bibtex\n${pub.data.bibtex}\n\`\`\`\n`;
    output += `\n${pub.body}\n\n---\n\n`;
  }

  output += `## 4. University Courses & Educational Content\n\n`;
  for (const course of courses) {
    output += `### ${course.data.title}\n`;
    output += `- URL: https://ghackenberg.github.io/courses/${course.id}\n`;
    output += `- Repository: ${course.data.repoName}\n`;
    output += `- Language: ${course.data.language}\n`;
    if (course.data.description) output += `- Description: ${course.data.description}\n`;
    if (course.data.learningGoals && course.data.learningGoals.length > 0) {
      output += `- Learning Goals:\n  * ${course.data.learningGoals.join('\n  * ')}\n`;
    }
    output += `\n${course.body}\n\n---\n\n`;
  }

  output += `## 5. Software Projects & Systems\n\n`;
  for (const project of projects) {
    output += `### ${project.data.title}\n`;
    output += `- URL: https://ghackenberg.github.io/projects/${project.id}\n`;
    output += `- External Link: ${project.data.href}\n`;
    output += `- Tagline: ${project.data.tagline}\n`;
    output += `- Description: ${project.data.description}\n`;
    if (project.data.tags && project.data.tags.length > 0) {
      output += `- Technologies: ${project.data.tags.join(', ')}\n`;
    }
    output += `\n${project.body}\n\n---\n\n`;
  }

  output += `## 6. Professional Services & Consulting Modules\n\n`;
  for (const service of services) {
    output += `### Service: ${service.data.title}\n`;
    output += `- URL: https://ghackenberg.github.io/services/${service.id}\n`;
    output += `- Tagline: ${service.data.tagline}\n`;
    output += `- Description: ${service.data.description}\n\n`;
  }

  for (const mod of modules) {
    output += `### Module: ${mod.data.title}\n`;
    output += `- Tagline: ${mod.data.tagline}\n`;
    output += `- Description: ${mod.data.description}\n`;
    if (mod.data.highlights && mod.data.highlights.length > 0) {
      output += `- Key Highlights:\n  * ${mod.data.highlights.join('\n  * ')}\n`;
    }
    output += `\n${mod.body}\n\n---\n\n`;
  }

  return new Response(output, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
