import fs from 'fs';
import path from 'path';
import { mergeFrontmatter, findExistingImage, downloadImage } from "./utils.js";

export async function syncLinkedIn() {
  console.log("Syncing LinkedIn posts...");

  const profilePath = path.resolve(process.cwd(), "src/content/feeds/linkedin/profile.json");
  if (!fs.existsSync(profilePath)) {
    throw new Error(`LinkedIn profile file not found at ${profilePath}`);
  }

  const profileContent = fs.readFileSync(profilePath, 'utf8');
  const profileData = JSON.parse(profileContent);

  const postIds = profileData.postIds || [];
  if (postIds.length === 0) {
    console.log("No postIds configured in LinkedIn profile. Skipping posts sync.");
    return;
  }

  const postsDir = path.resolve(process.cwd(), "src/content/feeds/linkedin/posts");
  if (!fs.existsSync(postsDir)) {
    fs.mkdirSync(postsDir, { recursive: true });
  }

  // Determine which posts to sync (newest 3 or any that do not exist on disk)
  const idsToSync = [];

  for (let i = 0; i < postIds.length; i++) {
    const id = postIds[i];
    const filePath = path.join(postsDir, id, "index.md");
    if (i < 3 || !fs.existsSync(filePath)) {
      idsToSync.push(id);
    }
  }

  console.log(`Syncing ${idsToSync.length} LinkedIn posts (out of ${postIds.length} total)...`);

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  for (let idx = 0; idx < idsToSync.length; idx++) {
    const id = idsToSync[idx];
    const itemDir = path.join(postsDir, id);
    const filePath = path.join(itemDir, "index.md");
    const fileExists = fs.existsSync(filePath);

    if (idx > 0) {
      const waitMs = Math.floor(2000 + Math.random() * 3000);
      console.log(`Waiting ${waitMs}ms to simulate natural delay...`);
      await delay(waitMs);
    }

    console.log(`Syncing LinkedIn post URN ID: ${id} -> ${path.relative(process.cwd(), filePath)}`);
    try {
      const url = `https://www.linkedin.com/feed/update/urn:li:activity:${id}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP status ${res.status}`);
      }

      const html = await res.text();
      const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let match;
      let postData = null;

      while ((match = regex.exec(html)) !== null) {
        try {
          const json = JSON.parse(match[1].trim());
          if (json["@type"] === "SocialMediaPosting") {
            postData = json;
            break;
          }
        } catch (err) {
          // ignore parsing errors
        }
      }

      if (!postData) {
        throw new Error("Could not find SocialMediaPosting block in HTML");
      }

      // Extract metrics
      let likes = 0;
      let comments = 0;
      if (postData.interactionStatistic) {
        const stats = Array.isArray(postData.interactionStatistic) ? postData.interactionStatistic : [postData.interactionStatistic];
        for (const stat of stats) {
          if (stat.interactionType) {
            if (stat.interactionType.includes("LikeAction")) {
              likes = stat.userInteractionCount || 0;
            } else if (stat.interactionType.includes("CommentAction")) {
              comments = stat.userInteractionCount || 0;
            }
          }
        }
      }

      // Extract date and format as YYYY-MM-DD
      let pubDateStr = new Date().toISOString();
      if (postData.datePublished) {
        try {
          pubDateStr = new Date(postData.datePublished).toISOString();
        } catch (e) {
          console.warn(`! Failed to parse datePublished: ${postData.datePublished}`);
        }
      }

      if (fileExists) {
        mergeFrontmatter(filePath, {
          likes: likes,
          comments: comments,
          pubDate: pubDateStr
        });
        console.log(`✓ Updated metrics in ${path.relative(process.cwd(), filePath)}`);
      } else {
        if (!fs.existsSync(itemDir)) {
          fs.mkdirSync(itemDir, { recursive: true });
        }

        let imageUrl = "";
        if (postData.image) {
          if (Array.isArray(postData.image) && postData.image.length > 0) {
            const imgObj = postData.image[0];
            imageUrl = typeof imgObj === "string" ? imgObj : (imgObj.url || "");
          } else if (typeof postData.image === "object") {
            imageUrl = postData.image.url || "";
          } else if (typeof postData.image === "string") {
            imageUrl = postData.image;
          }
        }

        let localExt = null;
        if (imageUrl) {
          localExt = await downloadImage(imageUrl, itemDir);
        }

        const bodyText = postData.articleBody || "";

        const mdContent = `---
pubDate: ${JSON.stringify(pubDateStr)}
likes: ${likes}
comments: ${comments}
shares: 0
image: ${localExt ? `"./image${localExt}"` : "null"}
---
${bodyText}
`;
        fs.writeFileSync(filePath, mdContent, "utf8");
        console.log(`✓ Generated new post in ${path.relative(process.cwd(), filePath)}`);
      }
    } catch (e) {
      if (fileExists) {
        console.warn(`⚠️ Failed to update LinkedIn post ${id}, retaining existing file. Error: ${e.message || e}`);
      } else {
        console.error(`❌ Failed to sync new LinkedIn post ${id}:`, e.message || e);
        throw e;
      }
    }
  }

  // Prune deleted LinkedIn posts
  console.log("Pruning deleted LinkedIn posts...");
  const activePostIds = new Set(postIds);
  const existingPostDirs = fs.readdirSync(postsDir).filter(f => fs.statSync(path.join(postsDir, f)).isDirectory());
  for (const dirName of existingPostDirs) {
    if (!activePostIds.has(dirName)) {
      console.log(`Pruning deleted LinkedIn post directory: ${dirName}`);
      fs.rmSync(path.join(postsDir, dirName), { recursive: true, force: true });
    }
  }
}
