import { getCollection } from "astro:content";

function parseItemDate(id: string, dateVal?: string | Date): number {
  if (!dateVal) {
    // Try to extract from the folder ID (e.g. 2007_07_vldb)
    const match = id.match(/^(\d{4})_(\d{2})(?:_(\d{2}))?/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // 0-based
      const day = match[3] ? parseInt(match[3], 10) : 1;
      return Date.UTC(year, month, day);
    }
    return 0;
  }
  
  if (dateVal instanceof Date) {
    return dateVal.getTime();
  }
  
  // If it's a string, prioritize the ID prefix if available because
  // fuzzy date range strings like "23-27 September 2007" parse incorrectly in JS.
  const match = id.match(/^(\d{4})_(\d{2})(?:_(\d{2}))?/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // 0-based
    const day = match[3] ? parseInt(match[3], 10) : 1;
    return Date.UTC(year, month, day);
  }
  
  const parsed = Date.parse(dateVal);
  return !isNaN(parsed) ? parsed : 0;
}

export async function GET() {
  const posts = await getCollection("posts");
  const courses = await getCollection("courses");
  const projects = await getCollection("projects");
  const publications = await getCollection("publications");
  const visualizations = await getCollection("visualizations");
  const services = await getCollection("services");

  const manifest = {
    posts: posts.map(p => ({
      id: p.id,
      url: `/posts/${p.id}`,
      date: parseItemDate(p.id, p.data.pubDate)
    })),
    courses: courses.map(c => ({
      id: c.id,
      url: `/courses/${c.id}`,
      date: parseItemDate(c.id, c.data.pubDate)
    })),
    projects: projects.map(p => ({
      id: p.id,
      url: `/projects/${p.id}`,
      date: parseItemDate(p.id, p.data.pubDate)
    })),
    publications: publications.map(p => ({
      id: p.id,
      url: `/publications/${p.id}`,
      date: parseItemDate(p.id, p.data.pubDate)
    })),
    visualizations: visualizations.map(v => ({
      id: v.id,
      url: `/visualizations/${v.id}`,
      date: parseItemDate(v.id, v.data.pubDate)
    })),
    services: services.map(s => ({
      id: s.id,
      url: `/services#${s.id}`,
      date: parseItemDate(s.id, s.data.pubDate)
    }))
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/json"
    }
  });
}
