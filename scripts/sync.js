import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { Octokit } from "@octokit/core";
import { google } from "googleapis";

// Load environment variables from local .env files
function loadEnv() {
  for (const envFile of ['.env', '.env.local', '.env.development']) {
    const envPath = path.resolve(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let val = match[2] || '';
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

// Clear a directory and make sure it exists
function clearAndCreateDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
  fs.mkdirSync(dirPath, { recursive: true });
}

// Search destDir for a file named "image.<ext>"
function findExistingImage(destDir) {
  if (!fs.existsSync(destDir)) return null;
  const files = fs.readdirSync(destDir);
  const found = files.find(f => f.startsWith("image."));
  if (found) {
    return path.extname(found);
  }
  return null;
}

// Download image to destDir as image.<ext>
async function downloadImage(url, destDir) {
  try {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const existingExt = findExistingImage(destDir);
    if (existingExt) {
      return existingExt;
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) {
      console.warn(`⚠️ Failed to download image from ${url}: Status ${res.status}`);
      return null;
    }
    const contentType = res.headers.get("content-type");
    let ext = ".jpg";
    if (contentType) {
      if (contentType.includes("image/png")) ext = ".png";
      else if (contentType.includes("image/webp")) ext = ".webp";
      else if (contentType.includes("image/gif")) ext = ".gif";
      else if (contentType.includes("image/svg+xml")) ext = ".svg";
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(path.join(destDir, `image${ext}`), buffer);
    return ext;
  } catch (err) {
    console.warn(`⚠️ Error downloading image ${url}: ${err.message || err}`);
    return null;
  }
}

// Helper: Slugify text
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Helper: Parse frontmatter and body
function parseMarkdown(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content, hasFrontmatter: false };
  const fmText = match[1];
  const body = match[2];
  const frontmatter = {};
  for (const line of fmText.split('\n')) {
    const idx = line.indexOf(':');
    if (idx !== -1) {
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      const isQuoted = (val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"));
      if (isQuoted) {
        val = val.slice(1, -1);
      }

      let parsedVal = val;
      if (val === 'null') {
        parsedVal = null;
      } else if (val === 'true') {
        parsedVal = true;
      } else if (val === 'false') {
        parsedVal = false;
      } else if (/^\d+$/.test(val)) {
        if (key !== 'id') {
          parsedVal = parseInt(val, 10);
        }
      } else if (/^\d+\.\d+$/.test(val)) {
        if (key !== 'id') {
          parsedVal = parseFloat(val);
        }
      }
      frontmatter[key] = parsedVal;
    }
  }
  return { frontmatter, body, hasFrontmatter: true };
}

// Helper: Stringify frontmatter and body
function stringifyMarkdown(frontmatter, body) {
  const fmLines = [];
  for (const [key, val] of Object.entries(frontmatter)) {
    if (val === null || val === undefined) {
      fmLines.push(`${key}: null`);
    } else if (typeof val === 'string') {
      fmLines.push(`${key}: ${JSON.stringify(val)}`);
    } else {
      fmLines.push(`${key}: ${val}`);
    }
  }
  const trimmedBody = body.trimStart();
  return `---\n${fmLines.join('\n')}\n---\n${trimmedBody}`;
}

// Helper: Merge new metrics/fields into frontmatter of an existing file
function mergeFrontmatter(filePath, newFields) {
  if (!fs.existsSync(filePath)) return false;
  const { frontmatter, body } = parseMarkdown(filePath);
  const mergedFrontmatter = { ...frontmatter, ...newFields };
  const newContent = stringifyMarkdown(mergedFrontmatter, body);
  fs.writeFileSync(filePath, newContent, 'utf8');
  return true;
}

// Helper: Scan collection directory and find index.md file matching target platform ID
function findFileByPlatformId(collectionDir, platformId) {
  if (!fs.existsSync(collectionDir)) return null;
  const folders = fs.readdirSync(collectionDir).filter(f => fs.statSync(path.join(collectionDir, f)).isDirectory());
  for (const folder of folders) {
    const indexPath = path.join(collectionDir, folder, 'index.md');
    if (fs.existsSync(indexPath)) {
      const { frontmatter } = parseMarkdown(indexPath);
      if (frontmatter.id === platformId) {
        return indexPath;
      }
    }
  }
  return null;
}

async function syncGitHub() {
  const username = "ghackenberg";
  const token = process.env.GITHUB_TOKEN;
  console.log("Syncing GitHub profile and repositories...");

  const octokit = new Octokit({
    auth: token || undefined
  });

  // Fetch Profile
  const profileRes = await octokit.request("GET /users/{username}", { username });
  if (profileRes.status !== 200) {
    throw new Error(`Profile fetch responded with status ${profileRes.status}`);
  }
  const profile = {
    followers: profileRes.data.followers
  };

  // Fetch Repositories
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required for GitHub GraphQL sync");
  }

  let repos = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const reposRes = await octokit.graphql(
      `query ($username: String!, $cursor: String) {
        user(login: $username) {
          repositories(first: 100, after: $cursor, orderBy: {field: PUSHED_AT, direction: DESC}, privacy: PUBLIC) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              name
              description
              url
              stargazerCount
              primaryLanguage {
                name
              }
              openGraphImageUrl
              updatedAt
              pushedAt
            }
          }
        }
      }`,
      {
        username,
        cursor
      }
    );

    const connection = reposRes.user?.repositories;
    const nodes = connection?.nodes || [];
    for (const repo of nodes) {
      repos.push({
        name: repo.name,
        description: repo.description || "No description provided.",
        html_url: repo.url,
        stargazers_count: repo.stargazerCount || 0,
        language: repo.primaryLanguage?.name || "Web",
        social_preview: repo.openGraphImageUrl || "",
        updatedAt: repo.updatedAt || "",
        pushedAt: repo.pushedAt || ""
      });
    }

    hasNextPage = connection?.pageInfo?.hasNextPage || false;
    cursor = connection?.pageInfo?.endCursor || null;
  }

  // Write out collection data
  const profileDir = path.resolve(process.cwd(), "src/content/feeds/github");
  const reposDir = path.resolve(process.cwd(), "src/content/feeds/github/repositories");

  clearAndCreateDir(profileDir);
  if (!fs.existsSync(reposDir)) {
    fs.mkdirSync(reposDir, { recursive: true });
  }

  fs.writeFileSync(path.join(profileDir, "profile.json"), JSON.stringify(profile, null, 2), "utf8");

  const activeRepoDirs = new Set();
  for (const repo of repos) {
    const safeName = repo.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    activeRepoDirs.add(safeName);

    const repoDir = path.join(reposDir, safeName);
    if (!fs.existsSync(repoDir)) {
      fs.mkdirSync(repoDir, { recursive: true });
    }

    let localExt = null;
    if (repo.social_preview && !repo.social_preview.includes("avatars.githubusercontent.com")) {
      localExt = await downloadImage(repo.social_preview, repoDir);
    }

    const pubDateStr = repo.pushedAt || repo.updatedAt || new Date().toISOString();

    const mdContent = `---
title: ${JSON.stringify(repo.name)}
description: ${JSON.stringify(repo.description)}
html_url: ${JSON.stringify(repo.html_url)}
stars: ${repo.stargazers_count}
language: ${JSON.stringify(repo.language)}
image: ${localExt ? `"./image${localExt}"` : "null"}
updatedAt: ${JSON.stringify(repo.updatedAt)}
pubDate: ${pubDateStr}
---
`;
    fs.writeFileSync(path.join(repoDir, "index.md"), mdContent, "utf8");
  }

  // Prune deleted repositories
  const existingDirs = fs.readdirSync(reposDir).filter(f => fs.statSync(path.join(reposDir, f)).isDirectory());
  for (const dirName of existingDirs) {
    if (!activeRepoDirs.has(dirName)) {
      console.log(`Pruning deleted repository directory: ${dirName}`);
      fs.rmSync(path.join(reposDir, dirName), { recursive: true, force: true });
    }
  }
  console.log(`✓ GitHub sync completed: 1 profile, ${repos.length} repos.`);
}

async function syncYouTube() {
  const channelHandle = "@georghackenberg";
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY environment variable is not defined");
  }
  console.log("Syncing YouTube channel and video listings...");

  const youtube = google.youtube({
    version: "v3",
    auth: apiKey
  });

  // Fetch channel details and stats
  const channelRes = await youtube.channels.list({
    part: ["statistics", "contentDetails"],
    forHandle: channelHandle
  });

  if (!channelRes.data.items || channelRes.data.items.length === 0) {
    throw new Error("Channel search returned no results");
  }
  const item = channelRes.data.items[0];

  const rawSubs = parseInt(item.statistics?.subscriberCount || "0");
  const stats = {
    subscribers: rawSubs >= 1000 ? `${(rawSubs / 1000).toFixed(1)}k+` : rawSubs.toString()
  };

  const uploadsPlaylistId = item.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) {
    throw new Error("Uploads playlist not found for channel");
  }

  // Fetch playlist items (all uploads)
  let playlistItems = [];
  let nextPageToken = undefined;

  do {
    const playlistRes = await youtube.playlistItems.list({
      part: ["snippet"],
      playlistId: uploadsPlaylistId,
      maxResults: 50,
      pageToken: nextPageToken
    });

    if (playlistRes.data.items && playlistRes.data.items.length > 0) {
      playlistItems.push(...playlistRes.data.items);
    }
    nextPageToken = playlistRes.data.nextPageToken;
  } while (nextPageToken);

  let videos = [];
  if (playlistItems.length > 0) {
    const videoIds = playlistItems.map(v => v.snippet?.resourceId?.videoId).filter(Boolean);

    // Fetch video metrics in chunks of 50
    const statsMap = {};
    for (let i = 0; i < videoIds.length; i += 50) {
      const chunk = videoIds.slice(i, i + 50);
      try {
        const videoDetailsRes = await youtube.videos.list({
          part: ["statistics"],
          id: chunk
        });
        if (videoDetailsRes.data.items) {
          for (const videoDetail of videoDetailsRes.data.items) {
            if (videoDetail.id) {
              const rViews = parseInt(videoDetail.statistics?.viewCount || "0", 10);
              const rLikes = parseInt(videoDetail.statistics?.likeCount || "0", 10);
              statsMap[videoDetail.id] = {
                views: rViews,
                likes: rLikes
              };
            }
          }
        }
      } catch (e) {
        console.warn(`! Failed to fetch video stats for chunk starting at ${i}, falling back to 0.`);
      }
    }

    videos = playlistItems.map(video => {
      const vidId = video.snippet?.resourceId?.videoId || "";
      const vidStats = statsMap[vidId] || { views: 0, likes: 0 };

      return {
        title: video.snippet?.title || "No Title",
        id: vidId,
        publishedAt: video.snippet?.publishedAt || new Date().toISOString(),
        thumbnail: video.snippet?.thumbnails?.high?.url || `https://img.youtube.com/vi/${vidId}/hqdefault.jpg`,
        description: video.snippet?.description || "",
        views: vidStats.views,
        likes: vidStats.likes
      };
    });
  }

  // Write out channel profile JSON
  const profileDir = path.resolve(process.cwd(), "src/content/feeds/youtube");
  const videosDir = path.resolve(process.cwd(), "src/content/feeds/youtube/videos");

  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }
  fs.writeFileSync(path.join(profileDir, "profile.json"), JSON.stringify(stats, null, 2), "utf8");

  if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true });
  }

  // Sync videos
  for (const video of videos) {
    const existingFilePath = findFileByPlatformId(videosDir, video.id);
    if (existingFilePath) {
      console.log(`Updating YouTube video ${video.id} stats in ${path.relative(process.cwd(), existingFilePath)}`);
      mergeFrontmatter(existingFilePath, {
        views: video.views,
        likes: video.likes,
        pubDate: video.publishedAt
      });
    } else {
      // Create new video entry
      const folders = fs.readdirSync(videosDir).filter(f => fs.statSync(path.join(videosDir, f)).isDirectory());
      const nextIndex = String(folders.length + 1).padStart(3, '0');
      const slug = slugify(video.title) || 'youtube_video';
      const newDirName = `${nextIndex}_${slug}`;
      const newVideoDir = path.join(videosDir, newDirName);

      fs.mkdirSync(newVideoDir, { recursive: true });

      let localExt = null;
      if (video.thumbnail) {
        localExt = await downloadImage(video.thumbnail, newVideoDir);
      }

      console.log(`New YouTube video detected. Creating folder: ${newDirName}`);

      const mdContent = `---
title: ${JSON.stringify(video.title)}
id: ${JSON.stringify(video.id)}
pubDate: ${JSON.stringify(video.publishedAt)}
image: ${localExt ? `"./image${localExt}"` : "null"}
description: ${JSON.stringify(video.description)}
views: ${video.views}
likes: ${video.likes}
---
`;
      fs.writeFileSync(path.join(newVideoDir, "index.md"), mdContent, "utf8");
    }
  }

  // PRUNING IS REMOVED as requested.
  console.log(`✓ YouTube sync completed: 1 profile, ${videos.length} videos synced.`);
}

async function syncLinkedIn() {
  console.log("Syncing LinkedIn posts...");

  const postsDir = path.resolve(process.cwd(), "src/content/feeds/linkedin/posts");
  if (!fs.existsSync(postsDir)) {
    fs.mkdirSync(postsDir, { recursive: true });
  }

  // Scan existing folders/index.md files to find URN IDs to sync
  const existingPosts = [];
  const folders = fs.readdirSync(postsDir).filter(f => fs.statSync(path.join(postsDir, f)).isDirectory());
  for (const folder of folders) {
    const indexPath = path.join(postsDir, folder, 'index.md');
    if (fs.existsSync(indexPath)) {
      const { frontmatter } = parseMarkdown(indexPath);
      if (frontmatter.id) {
        existingPosts.push({ id: frontmatter.id, filePath: indexPath });
      }
    }
  }

  if (existingPosts.length === 0) {
    console.log("No published LinkedIn posts found (no folders with id in frontmatter). Skipping posts sync.");
    return;
  }

  console.log(`Syncing metrics for ${existingPosts.length} LinkedIn posts...`);

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  for (let idx = 0; idx < existingPosts.length; idx++) {
    const post = existingPosts[idx];
    const id = post.id;
    const filePath = post.filePath;

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

      // Merge metrics back
      mergeFrontmatter(filePath, {
        likes: likes,
        comments: comments,
        pubDate: pubDateStr
      });
      console.log(`✓ Updated metrics in ${path.relative(process.cwd(), filePath)}`);
    } catch (e) {
      console.warn(`⚠️ Failed to update LinkedIn post ${id}. Error: ${e.message || e}`);
    }
  }

  // PRUNING IS REMOVED as requested.
}

async function main() {
  loadEnv();
  console.log("Starting feed sync process...");

  let hasErrors = false;

  try {
    await syncGitHub();
  } catch (error) {
    console.error("❌ GitHub sync failed:", error.message || error);
    hasErrors = true;
  }

  try {
    await syncYouTube();
  } catch (error) {
    console.error("❌ YouTube sync failed:", error.message || error);
    hasErrors = true;
  }

  try {
    await syncLinkedIn();
  } catch (error) {
    console.error("❌ LinkedIn sync failed:", error.message || error);
    hasErrors = true;
  }

  if (hasErrors) {
    console.log("\n⚠️ Sync completed with errors. Check warnings/errors above.");
    process.exit(1);
  } else {
    try {
      console.log("Synchronizing Astro content collections...");
      execSync("npx astro sync", { stdio: "inherit" });
    } catch (syncError) {
      console.warn("⚠️ Warning: Failed to run 'npx astro sync' automatically:", syncError.message || syncError);
    }
    console.log("\n✅ All feeds synced successfully!");
    process.exit(0);
  }
}

main();
