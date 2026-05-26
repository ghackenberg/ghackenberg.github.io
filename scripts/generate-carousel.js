import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const folderArg = process.argv[2];
  if (!folderArg) {
    console.error("❌ Error: Please specify the target LinkedIn post directory name.");
    console.error("Usage: npm run generate-carousel -- <folder_name>");
    process.exit(1);
  }

  const postDir = path.resolve(process.cwd(), 'src', 'content', 'feeds', 'linkedin', 'posts', folderArg);
  if (!fs.existsSync(postDir)) {
    console.error(`❌ Error: Post directory does not exist: ${postDir}`);
    process.exit(1);
  }

  const slidesJsonPath = path.join(postDir, 'slides.json');
  const outputPdfPath = path.join(postDir, 'carousel.pdf');

  if (!fs.existsSync(slidesJsonPath)) {
    console.error(`❌ Error: slides.json not found in: ${postDir}`);
    process.exit(1);
  }

  // Create temporary placeholder image.jpg if it doesn't exist yet to prevent Astro startup validation errors
  const coverShotPath = path.join(postDir, 'image.jpg');
  if (!fs.existsSync(coverShotPath)) {
    console.log("Creating temporary placeholder image.jpg to prevent Astro validation errors...");
    fs.writeFileSync(coverShotPath, Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60,
      0x00, 0x60, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x10, 0x0c, 0x0a, 0x0a, 0x0c, 0x19, 0x12, 0x13, 0x0f, 0x19,
      0x24, 0x20, 0x26, 0x26, 0x24, 0x20, 0x22, 0x22, 0x28, 0x2d, 0x3a, 0x31, 0x28, 0x2b, 0x37, 0x2c,
      0x22, 0x22, 0x33, 0x45, 0x34, 0x37, 0x3c, 0x3e, 0x41, 0x41, 0x41, 0x27, 0x31, 0x47, 0x4c, 0x47,
      0x3f, 0x4b, 0x3a, 0x40, 0x41, 0x3e, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01,
      0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01,
      0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
      0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x0c, 0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00,
      0x3f, 0x00, 0xb2, 0xc0, 0x07, 0xff, 0xd9
    ]));
  }

  const port = 8099;
  console.log(`Starting Astro dev server on port ${port}...`);

  // Start Astro dev server in the background
  const devServer = spawn('npx', ['astro', 'dev', '--port', port.toString()], {
    shell: true,
    stdio: 'ignore'
  });

  // Give the server 4 seconds to boot and resolve dependencies
  await delay(4000);
  console.log("Astro dev server should be ready.");

  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const slidesData = JSON.parse(fs.readFileSync(slidesJsonPath, 'utf8'));
    const slides = slidesData.slides;

    // 1. Capture screenshots for pages defined in the slides
    for (const slide of slides) {
      if (slide.screenshotUrl) {
        const url = slide.screenshotUrl;
        const relativeUrl = url.startsWith('/') ? url : '/' + url;
        
        let screenshotName = 'shot-home.png';
        if (url.includes('courses')) screenshotName = 'shot-courses.png';
        else if (url.includes('projects')) screenshotName = 'shot-projects.png';

        const targetShotPath = path.join(postDir, screenshotName);

        console.log(`Navigating to http://localhost:${port}${relativeUrl} to capture screenshot...`);
        await page.goto(`http://localhost:${port}${relativeUrl}`, { waitUntil: 'networkidle2' });
        // Small wait to ensure transitions/fonts load completely
        await delay(1000);
        await page.screenshot({ path: targetShotPath });
        console.log(`Saved screenshot: ${screenshotName}`);
      }
    }

    // Give dev server a moment to recognize the new screenshot assets
    await delay(2000);

    // 2. Open the dynamic Astro carousel path and print to PDF
    const carouselUrl = `http://localhost:${port}/feeds/linkedin/${folderArg}`;
    console.log(`Opening carousel layout at: ${carouselUrl}`);
    await page.goto(carouselUrl, { waitUntil: 'networkidle2' });
    await delay(1500); // Wait for fonts and Tailwind to compile

    // Capture cover screenshot as preview image (image.jpg)
    await page.setViewport({ width: 1080, height: 1080 });
    const coverShotPath = path.join(postDir, 'image.jpg');
    console.log(`Capturing carousel cover preview image...`);
    await page.screenshot({ path: coverShotPath, type: 'jpeg', quality: 90 });
    console.log(`Saved cover preview image: image.jpg`);

    // Reset viewport back to desktop size and wait a moment for layout to settle
    await page.setViewport({ width: 1440, height: 900 });
    await delay(1000);

    console.log(`Printing LinkedIn PDF Carousel to: ${path.relative(process.cwd(), outputPdfPath)}...`);
    await page.pdf({
      path: outputPdfPath,
      width: '1080px',
      height: '1080px',
      printBackground: true,
      preferCSSPageSize: true
    });

    await browser.close();
    console.log(`\n✅ Carousel PDF and preview image generated successfully!`);
    console.log(`Saved PDF: ${path.relative(process.cwd(), outputPdfPath)}`);
    console.log(`Saved image: ${path.relative(process.cwd(), coverShotPath)}`);

  } catch (err) {
    console.error("❌ Error generating carousel:", err);
  } finally {
    console.log("Shutting down Astro dev server...");
    devServer.kill();
    // Force kill process tree if on Windows
    if (process.platform === 'win32') {
      try {
        spawn('taskkill', ['/pid', devServer.pid.toString(), '/f', '/t'], { shell: true });
      } catch (e) {}
    }
  }
}

main();
