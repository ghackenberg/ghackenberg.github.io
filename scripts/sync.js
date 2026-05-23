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

    const mdContent = `---
name: ${JSON.stringify(repo.name)}
description: ${JSON.stringify(repo.description)}
html_url: ${JSON.stringify(repo.html_url)}
stargazers_count: ${repo.stargazers_count}
language: ${JSON.stringify(repo.language)}
social_preview: ${localExt ? `"./image${localExt}"` : "null"}
updatedAt: ${JSON.stringify(repo.updatedAt)}
pushedAt: ${JSON.stringify(repo.pushedAt)}
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

    // Fetch video metrics (likes and views) in chunks of 50
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
              const rViews = parseInt(videoDetail.statistics?.viewCount || "0");
              const rLikes = parseInt(videoDetail.statistics?.likeCount || "0");
              statsMap[videoDetail.id] = {
                views: rViews >= 1000 ? `${(rViews / 1000).toFixed(1)}k` : rViews.toString(),
                likes: rLikes >= 1000 ? `${(rLikes / 1000).toFixed(0)}` : rLikes.toString()
              };
            }
          }
        }
      } catch (e) {
        console.warn(`! Failed to fetch video stats for chunk starting at ${i}, falling back to 0.`);
      }
    }

    videos = playlistItems.map(video => {
      const pubDate = new Date(video.snippet?.publishedAt || Date.now());
      const diffDays = Math.ceil(Math.abs(Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24));
      const relativeDate = diffDays > 30 ? `${Math.floor(diffDays / 30)} months ago` : `${diffDays} days ago`;

      const vidId = video.snippet?.resourceId?.videoId || "";
      const vidStats = statsMap[vidId] || { views: "0", likes: "0" };

      return {
        title: video.snippet?.title || "No Title",
        id: vidId,
        published: relativeDate,
        publishedAt: video.snippet?.publishedAt || new Date().toISOString(),
        thumbnail: video.snippet?.thumbnails?.high?.url || `https://img.youtube.com/vi/${vidId}/hqdefault.jpg`,
        description: video.snippet?.description || "",
        views: vidStats.views,
        likes: vidStats.likes
      };
    });
  }

  // Write out collection data
  const profileDir = path.resolve(process.cwd(), "src/content/feeds/youtube");
  const videosDir = path.resolve(process.cwd(), "src/content/feeds/youtube/videos");

  clearAndCreateDir(profileDir);
  if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true });
  }

  fs.writeFileSync(path.join(profileDir, "profile.json"), JSON.stringify(stats, null, 2), "utf8");

  const activeVideoDirs = new Set();
  for (const video of videos) {
    activeVideoDirs.add(video.id);

    const videoDir = path.join(videosDir, video.id);
    if (!fs.existsSync(videoDir)) {
      fs.mkdirSync(videoDir, { recursive: true });
    }

    let localExt = null;
    if (video.thumbnail) {
      localExt = await downloadImage(video.thumbnail, videoDir);
    }

    const mdContent = `---
title: ${JSON.stringify(video.title)}
id: ${JSON.stringify(video.id)}
published: ${JSON.stringify(video.published)}
publishedAt: ${JSON.stringify(video.publishedAt)}
thumbnail: ${localExt ? `"./image${localExt}"` : "null"}
description: ${JSON.stringify(video.description)}
views: ${JSON.stringify(video.views)}
likes: ${JSON.stringify(video.likes)}
---
`;
    fs.writeFileSync(path.join(videoDir, "index.md"), mdContent, "utf8");
  }

  // Prune deleted videos
  const existingVideoDirs = fs.readdirSync(videosDir).filter(f => fs.statSync(path.join(videosDir, f)).isDirectory());
  for (const dirName of existingVideoDirs) {
    if (!activeVideoDirs.has(dirName)) {
      console.log(`Pruning deleted video directory: ${dirName}`);
      fs.rmSync(path.join(videosDir, dirName), { recursive: true, force: true });
    }
  }
  console.log(`✓ YouTube sync completed: 1 profile, ${videos.length} videos.`);
}

async function syncLinkedIn() {
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

  // 1. Migrate flat .md files to folder/index.md structure
  const files = fs.readdirSync(postsDir);
  for (const file of files) {
    if (file.endsWith(".md") && file !== "index.md") {
      const id = path.basename(file, ".md");
      const oldPath = path.join(postsDir, file);
      const newDir = path.join(postsDir, id);
      const newPath = path.join(newDir, "index.md");

      console.log(`Migrating legacy LinkedIn post file: ${file} -> ${id}/index.md`);
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true });
      }
      fs.renameSync(oldPath, newPath);
    }
  }

  // 2. Download remote images for any existing folder-structured posts
  const postDirs = fs.readdirSync(postsDir).filter(f => fs.statSync(path.join(postsDir, f)).isDirectory());
  for (const id of postDirs) {
    const itemDir = path.join(postsDir, id);
    const indexPath = path.join(itemDir, "index.md");
    if (fs.existsSync(indexPath)) {
      let content = fs.readFileSync(indexPath, "utf8");
      const match = content.match(/^image:\s*["']?(https?:\/\/[^"'\r\n]+)["']?/m);
      if (match) {
        const remoteUrl = match[1];
        console.log(`Found remote image for existing LinkedIn post ${id}: ${remoteUrl}`);
        const ext = await downloadImage(remoteUrl, itemDir);
        if (ext) {
          content = content.replace(match[0], `image: "./image${ext}"`);
          fs.writeFileSync(indexPath, content, "utf8");
          console.log(`✓ Updated image path in ${id}/index.md to ./image${ext}`);
        }
      }
    }
  }

  // Sync the first 3 posts (newest) and any posts that do not exist on disk
  const idsToSync = [];
  for (let i = 0; i < postIds.length; i++) {
    const id = postIds[i];
    const itemDir = path.join(postsDir, id);
    const indexPath = path.join(itemDir, "index.md");
    if (i < 3 || !fs.existsSync(indexPath)) {
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

    console.log(`Syncing LinkedIn post URN ID: ${id} -> ${id}/index.md`);
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
      let pubDateStr = new Date().toISOString().split('T')[0];
      if (postData.datePublished) {
        try {
          pubDateStr = new Date(postData.datePublished).toISOString().split('T')[0];
        } catch (e) {
          console.warn(`! Failed to parse datePublished: ${postData.datePublished}`);
        }
      }

      // Extract image URL
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

      if (!fs.existsSync(itemDir)) {
        fs.mkdirSync(itemDir, { recursive: true });
      }

      let localExt = null;
      if (imageUrl) {
        localExt = await downloadImage(imageUrl, itemDir);
      }

      const bodyText = postData.articleBody || "";

      // Construct markdown content with YAML frontmatter
      const mdContent = `---
pubDate: ${pubDateStr}
likes: ${likes}
comments: ${comments}
shares: 0
image: ${localExt ? `"./image${localExt}"` : "null"}
url: ${url}
---
${bodyText}
`;

      fs.writeFileSync(filePath, mdContent, "utf8");
      console.log(`✓ Generated/updated ${id}/index.md`);
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
  const activePostIds = new Set(postIds);
  const existingPostDirs = fs.readdirSync(postsDir).filter(f => fs.statSync(path.join(postsDir, f)).isDirectory());
  for (const dirName of existingPostDirs) {
    if (!activePostIds.has(dirName)) {
      console.log(`Pruning deleted LinkedIn post directory: ${dirName}`);
      fs.rmSync(path.join(postsDir, dirName), { recursive: true, force: true });
    }
  }
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
