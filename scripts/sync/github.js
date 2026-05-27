import fs from 'fs';
import path from 'path';
import { Octokit } from "@octokit/core";
import { findExistingImage, downloadImage } from "./utils.js";

export async function syncGitHub() {
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
              createdAt
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
        url: repo.url,
        stargazers_count: repo.stargazerCount || 0,
        language: repo.primaryLanguage?.name || "Web",
        social_preview: repo.openGraphImageUrl || "",
        createdAt: repo.createdAt || "",
        pushedAt: repo.pushedAt || ""
      });
    }

    hasNextPage = connection?.pageInfo?.hasNextPage || false;
    cursor = connection?.pageInfo?.endCursor || null;
  }

  // Write out collection data
  const profileDir = path.resolve(process.cwd(), "src/content/feeds/github");
  const reposDir = path.resolve(process.cwd(), "src/content/feeds/github/repositories");

  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }
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

    let localExt = findExistingImage(repoDir);
    if (!localExt && repo.social_preview && !repo.social_preview.includes("avatars.githubusercontent.com")) {
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const waitMs = Math.floor(1000 + Math.random() * 1500);
      console.log(`Downloading new social preview image for ${repo.name}, waiting ${waitMs}ms first...`);
      await delay(waitMs);
      localExt = await downloadImage(repo.social_preview, repoDir);
    }

    const pubDateStr = repo.createdAt || new Date().toISOString();
    const pushDateStr = repo.pushedAt || new Date().toISOString();

    const mdContent = `---
description: ${JSON.stringify(repo.description)}
url: ${JSON.stringify(repo.url)}
stars: ${repo.stargazers_count}
language: ${JSON.stringify(repo.language)}
image: ${localExt ? `"./image${localExt}"` : "null"}
pubDate: ${pubDateStr}
pushDate: ${pushDateStr}
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
