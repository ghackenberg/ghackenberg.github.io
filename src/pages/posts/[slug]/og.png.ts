import type { APIRoute } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

export async function getStaticPaths() {
  const posts = await getCollection('posts');
  return posts
    .filter((post) => post.data.icon?.format === 'svg')
    .map((post) => ({
      params: { slug: post.id },
      props: { post },
    }));
}

interface Props {
  post: CollectionEntry<'posts'>;
}

export const GET: APIRoute<Props> = async ({ props }) => {
  const { post } = props;
  const postDir = path.join(process.cwd(), 'src/content/posts', post.id);

  let svgBuffer: Buffer | undefined;

  // Try locating the SVG file via metadata fsPath if available
  const iconMetadata = post.data.icon as ({ fsPath?: string; src?: string } | undefined);
  if (iconMetadata?.fsPath && fs.existsSync(iconMetadata.fsPath)) {
    svgBuffer = fs.readFileSync(iconMetadata.fsPath);
  } else if (iconMetadata?.src) {
    const rawFileName = path.basename(iconMetadata.src.split('?')[0]);
    const candidatePath = path.join(postDir, rawFileName);
    if (fs.existsSync(candidatePath)) {
      svgBuffer = fs.readFileSync(candidatePath);
    }
  }

  // Fallback: search post directory for SVG files
  if (!svgBuffer && fs.existsSync(postDir)) {
    const svgFiles = fs.readdirSync(postDir).filter((f) => f.endsWith('.svg'));
    if (svgFiles.length > 0) {
      const preferred = svgFiles.find((f) => f.toLowerCase().includes('icon')) || svgFiles[0];
      svgBuffer = fs.readFileSync(path.join(postDir, preferred));
    }
  }

  if (!svgBuffer) {
    return new Response('SVG icon not found', { status: 404 });
  }

  // Render SVG into crisp buffer at high density
  const svgResized = await sharp(svgBuffer, { density: 150 })
    .resize(1100, 550, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  // Composite onto standard 1200x630 dark canvas matching theme (#030712)
  const png = await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: { r: 3, g: 7, b: 18, alpha: 1 },
    },
  })
    .composite([
      {
        input: svgResized,
        gravity: 'center',
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
