import fs from 'node:fs';
import path from 'node:path';
import { ensureBrandingAssets } from '@commons/server/branding-assets.js';
import { getFileContentHash, getHashedFilename } from '@commons/server/content-hash.js';

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const verbose = process.argv.includes('--verbose');

  const { cacheDir, ogImagePath, iconFiles, cacheHit } = await ensureBrandingAssets({
    force,
    verbose,
  });

  const distDir = path.resolve('dist');
  if (fs.existsSync(distDir)) {
    const ogHash = getFileContentHash(ogImagePath);
    const ogDestPath = path.join(
      distDir,
      'assets',
      'branding',
      getHashedFilename('og-share-preview.png', ogHash)
    );
    fs.mkdirSync(path.dirname(ogDestPath), { recursive: true });
    fs.copyFileSync(ogImagePath, ogDestPath);

    for (const iconFile of iconFiles) {
      const srcIconPath = path.join(cacheDir, iconFile);
      if (fs.existsSync(srcIconPath)) {
        fs.copyFileSync(srcIconPath, path.join(distDir, iconFile));
      }
    }

    const distInternalDir = path.join(distDir, '_internal');
    if (fs.existsSync(distInternalDir)) {
      fs.rmSync(distInternalDir, { recursive: true, force: true });
    }
  }

  if (cacheHit) {
    console.log('✅ [Asset Generator] Branding & OG assets unchanged (cache hit).');
  } else {
    console.log('✅ [Asset Generator] All 8 branding & OG assets compiled successfully.');
  }
}

main().catch((err) => {
  console.error('[Asset Generator] Error during generation:', err);
  process.exit(1);
});
