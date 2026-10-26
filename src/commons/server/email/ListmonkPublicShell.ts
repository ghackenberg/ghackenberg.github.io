import fs from 'node:fs';
import path from 'node:path';
import { ensureBrandingAssets } from '@commons/server/branding-assets';

export interface CompiledListmonkPublicShell {
  indexHtmlPath: string;
  styleCssPath: string;
  logoSvgPath: string;
  faviconPngPath: string;
}

interface EmbeddedFontSpec {
  family: string;
  weight: number;
  relPath: string;
}

const EMBEDDED_FONTS: readonly EmbeddedFontSpec[] = [
  {
    family: 'Inter',
    weight: 400,
    relPath: 'node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2',
  },
  {
    family: 'Inter',
    weight: 500,
    relPath: 'node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2',
  },
  {
    family: 'Inter',
    weight: 600,
    relPath: 'node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2',
  },
  {
    family: 'Outfit',
    weight: 600,
    relPath: 'node_modules/@fontsource/outfit/files/outfit-latin-600-normal.woff2',
  },
  {
    family: 'Outfit',
    weight: 700,
    relPath: 'node_modules/@fontsource/outfit/files/outfit-latin-700-normal.woff2',
  },
  {
    family: 'Outfit',
    weight: 800,
    relPath: 'node_modules/@fontsource/outfit/files/outfit-latin-800-normal.woff2',
  },
];

function buildEmbeddedFontFacesCss(rootDir: string): string {
  const blocks: string[] = [];
  for (const font of EMBEDDED_FONTS) {
    const absPath = path.resolve(rootDir, font.relPath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Missing font file for Listmonk public shell: ${absPath}`);
    }
    const base64 = fs.readFileSync(absPath).toString('base64');
    blocks.push(
      `@font-face {\n  font-family: '${font.family}';\n  font-style: normal;\n  font-weight: ${font.weight};\n  font-display: block;\n  src: url('data:font/woff2;base64,${base64}') format('woff2');\n}`
    );
  }
  return blocks.join('\n\n') + '\n\n';
}

export async function compileListmonkPublicShell(
  rootDir: string
): Promise<CompiledListmonkPublicShell> {
  const buildListmonkDir = path.resolve(rootDir, '.build', 'listmonk');
  const publicTemplatesDir = path.join(buildListmonkDir, 'public-templates');
  const publicStaticDir = path.join(buildListmonkDir, 'public-static');

  fs.mkdirSync(publicTemplatesDir, { recursive: true });
  fs.mkdirSync(publicStaticDir, { recursive: true });

  const indexHtmlPath = path.join(publicTemplatesDir, 'index.html');
  fs.copyFileSync(path.resolve(rootDir, 'src', 'layouts', 'listmonk.html'), indexHtmlPath);

  const styleCssPath = path.join(publicStaticDir, 'style.css');
  const rawCss = fs.readFileSync(path.resolve(rootDir, 'src', 'styles', 'listmonk.css'), 'utf-8');
  const fontFacesCss = buildEmbeddedFontFacesCss(rootDir);
  fs.writeFileSync(styleCssPath, fontFacesCss + rawCss, 'utf-8');

  const { cacheDir } = await ensureBrandingAssets();

  const logoSvgPath = path.join(publicStaticDir, 'logo.svg');
  fs.copyFileSync(path.join(cacheDir, 'favicon.svg'), logoSvgPath);

  const faviconPngPath = path.join(publicStaticDir, 'favicon.png');
  fs.copyFileSync(path.join(cacheDir, 'favicon-32x32.png'), faviconPngPath);

  return {
    indexHtmlPath,
    styleCssPath,
    logoSvgPath,
    faviconPngPath,
  };
}
