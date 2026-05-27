import fs from 'fs';
import path from 'path';
import { google } from "googleapis";
import { mergeFrontmatter, findExistingImage, downloadImage } from "./utils.js";

export async function syncYouTube() {
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
    const videoDir = path.join(videosDir, video.id);
    const existingFilePath = path.join(videoDir, "index.md");
    if (fs.existsSync(existingFilePath)) {
      console.log(`Updating YouTube video ${video.id} stats in ${path.relative(process.cwd(), existingFilePath)}`);
      mergeFrontmatter(existingFilePath, {
        views: video.views,
        likes: video.likes,
        pubDate: video.publishedAt
      });
    } else {
      // Create new video entry
      fs.mkdirSync(videoDir, { recursive: true });

      let localExt = null;
      if (video.thumbnail) {
        localExt = await downloadImage(video.thumbnail, videoDir);
      }

      console.log(`New YouTube video detected. Creating folder: ${video.id}`);

      const mdContent = `---
title: ${JSON.stringify(video.title)}
pubDate: ${JSON.stringify(video.publishedAt)}
image: ${localExt ? `"./image${localExt}"` : "null"}
description: ${JSON.stringify(video.description)}
views: ${video.views}
likes: ${video.likes}
---
`;
      fs.writeFileSync(existingFilePath, mdContent, "utf8");
    }
  }

  // Prune deleted YouTube videos
  console.log("Pruning deleted YouTube videos...");
  const activeVideoIds = new Set(videos.map(v => v.id));
  const existingVideoDirs = fs.readdirSync(videosDir).filter(f => fs.statSync(path.join(videosDir, f)).isDirectory());
  for (const dirName of existingVideoDirs) {
    if (!activeVideoIds.has(dirName)) {
      console.log(`Pruning deleted YouTube video directory: ${dirName}`);
      fs.rmSync(path.join(videosDir, dirName), { recursive: true, force: true });
    }
  }

  console.log(`✓ YouTube sync completed: 1 profile, ${videos.length} videos synced.`);
}
