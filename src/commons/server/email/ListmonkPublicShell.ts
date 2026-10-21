import fs from 'node:fs';
import path from 'node:path';
import { ensureBrandingAssets } from '@commons/server/branding-assets';

export interface CompiledListmonkPublicShell {
  indexHtmlPath: string;
  styleCssPath: string;
  logoSvgPath: string;
  faviconPngPath: string;
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
  fs.copyFileSync(path.resolve(rootDir, 'src', 'styles', 'listmonk.css'), styleCssPath);

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
