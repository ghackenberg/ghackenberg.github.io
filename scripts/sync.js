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
  clearAndCreateDir(reposDir);

  fs.writeFileSync(path.join(profileDir, "profile.json"), JSON.stringify(profile, null, 2), "utf8");
  for (const repo of repos) {
    const safeName = repo.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    fs.writeFileSync(path.join(reposDir, `${safeName}.json`), JSON.stringify(repo, null, 2), "utf8");
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
  clearAndCreateDir(videosDir);

  fs.writeFileSync(path.join(profileDir, "profile.json"), JSON.stringify(stats, null, 2), "utf8");
  for (const video of videos) {
    fs.writeFileSync(path.join(videosDir, `${video.id}.json`), JSON.stringify(video, null, 2), "utf8");
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

  // Sync the first 3 posts (newest) and any posts that do not exist on disk
  const idsToSync = [];
  for (let i = 0; i < postIds.length; i++) {
    const id = postIds[i];
    const filePath = path.join(postsDir, `${id}.md`);
    if (i < 3 || !fs.existsSync(filePath)) {
      idsToSync.push(id);
    }
  }

  console.log(`Syncing ${idsToSync.length} LinkedIn posts (out of ${postIds.length} total)...`);

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  for (let idx = 0; idx < idsToSync.length; idx++) {
    const id = idsToSync[idx];
    const filename = `${id}.md`;
    const url = `https://www.linkedin.com/feed/update/urn:li:activity:${id}`;
    const filePath = path.join(postsDir, filename);
    const fileExists = fs.existsSync(filePath);

    if (idx > 0) {
      const waitMs = Math.floor(2000 + Math.random() * 3000);
      console.log(`Waiting ${waitMs}ms to simulate natural delay...`);
      await delay(waitMs);
    }

    console.log(`Syncing LinkedIn post URN ID: ${id} -> ${filename}`);
    try {
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
          // ignore parsing errors on other JSON-LD blocks
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

      // Extract image preview
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

      const bodyText = postData.articleBody || "";

      // Construct markdown content with YAML frontmatter
      const mdContent = `---
pubDate: ${pubDateStr}
likes: ${likes}
comments: ${comments}
shares: 0
${imageUrl ? `image: ${imageUrl}\n` : ''}url: ${url}
---
${bodyText}
`;

      fs.writeFileSync(filePath, mdContent, "utf8");
      console.log(`✓ Generated/updated ${filename}`);
    } catch (e) {
      if (fileExists) {
        console.warn(`⚠️ Failed to update LinkedIn post ${id}, retaining existing file. Error: ${e.message || e}`);
      } else {
        console.error(`❌ Failed to sync new LinkedIn post ${id}:`, e.message || e);
        throw e;
      }
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
