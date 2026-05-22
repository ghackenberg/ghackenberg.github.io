import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');

// Simple static server to serve local HTML/assets to Puppeteer
const server = http.createServer((req, res) => {
  // Resolve paths safely
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(publicDir, urlPath);
  if (filePath === publicDir || fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.css': 'text/css',
    '.js': 'application/javascript',
  };
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(content);
    }
  });
});

const PORT = 9876;
server.listen(PORT, async () => {
  console.log(`[Asset Generator] Temporary web server listening on http://localhost:${PORT}`);
  
  try {
    const browser = await puppeteer.launch({
      headless: 'shell',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    // Helper function to capture a snapshot with custom sizes and transparency
    async function capture(url, width, height, destPath) {
      const page = await browser.newPage();
      
      // Set viewport to the exact size requested
      await page.setViewport({ 
        width, 
        height, 
        deviceScaleFactor: 1 
      });
      
      // Force background transparency on body
      await page.evaluateOnNewDocument(() => {
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = 'html, body { background: transparent !important; }';
        document.head.appendChild(style);
      });
      
      // Navigate to the target template url
      await page.goto(url, { waitUntil: 'networkidle0' });
      
      // Wait for fonts to be ready so titles render with correct typography
      await page.evaluateHandle(() => document.fonts.ready);
      
      // Take transparent screenshot (omitBackground: true makes PNG transparent where applicable)
      await page.screenshot({ 
        path: destPath, 
        omitBackground: true 
      });
      
      await page.close();
      console.log(`[✔] Generated: ${path.basename(destPath)} (${width}x${height})`);
    }

    const baseUrl = `http://localhost:${PORT}`;

    // Ensure the output directory for OG images exists
    const ogDir = path.join(publicDir, 'images');
    if (!fs.existsSync(ogDir)) {
      fs.mkdirSync(ogDir, { recursive: true });
    }
    
    console.log('[Asset Generator] Starting screenshots compilation...');

    // 1. Generate Favicons & App Icons (Transparent)
    await capture(`${baseUrl}/icon-generator.html?mode=transparent`, 16, 16, path.join(publicDir, 'favicon-16x16.png'));
    await capture(`${baseUrl}/icon-generator.html?mode=transparent`, 32, 32, path.join(publicDir, 'favicon-32x32.png'));
    await capture(`${baseUrl}/icon-generator.html?mode=transparent`, 180, 180, path.join(publicDir, 'apple-touch-icon.png'));
    await capture(`${baseUrl}/icon-generator.html?mode=transparent`, 192, 192, path.join(publicDir, 'icon-192x192.png'));
    await capture(`${baseUrl}/icon-generator.html?mode=transparent`, 512, 512, path.join(publicDir, 'icon-512x512.png'));
    
    // 2. Generate Maskable Icon (Solid Theme Background)
    await capture(`${baseUrl}/icon-generator.html?mode=maskable`, 512, 512, path.join(publicDir, 'icon-512x512-maskable.png'));
    
    // 3. Generate Social Sharing Banner (1200x630)
    await capture(`${baseUrl}/og-template.html`, 1200, 630, path.join(publicDir, 'images/og-share-preview.png'));
    
    await browser.close();
    console.log('[Asset Generator] All assets compiled successfully!');
  } catch (err) {
    console.error('[Asset Generator] Error during generation:', err);
  } finally {
    server.close();
    console.log('[Asset Generator] Temporary server stopped.');
  }
});
