# Feeds Master Database Instructions

This directory contains the local master databases for the website's external feeds (GitHub repositories, YouTube videos, and LinkedIn posts). 

Any future AI coding agents or human editors working on this repository must follow these rules when managing these feeds.

---

## 1. Directory Structure & Naming
* **LinkedIn posts** (`src/content/feeds/linkedin/posts/`) and **YouTube videos** (`src/content/feeds/youtube/videos/`) are organized into individual directories.
* Directories **must** follow the naming convention:
  `{index}_{descriptive_slug}`
  * *Example:* `001_teilzeit_studium_robotics_systems_engineering`
  * *Example:* `012_mindtastic_ai_first_linkedin_post`
* **Sequential Numbering:** The 3-digit prefix (e.g., `001_`, `002_`) is sequential and preserves the correct chronological order on disk. Keep this sequence intact when creating or editing directories.

---

## 2. Sync & Merge Behavior
* Running `npm run sync` (or executing `scripts/sync.js`) fetches external engagement metrics (likes, comments, views) from the platforms.
* **Frontmatter Merging:** The sync script uses a merge mechanism (`mergeFrontmatter`). It only updates the metrics and the publication date fields in the frontmatter.
* **Preservation of Manual Edits:** The sync script **will never** overwrite your custom titles, descriptions, or any text in the markdown body of your posts/videos. You can safely add custom markdown content directly in `index.md` files.

---

## 3. Managing Deletions (No Auto-Pruning)
* **No Auto-Pruning:** Auto-pruning/automatic deletion is disabled for LinkedIn and YouTube collections. If a video or post is deleted from the external platform, the sync script **will not** delete the local directory.
* **Manual Deletion:** To remove a post or video from the website, you must **manually delete** its directory from the repository.

---

## 4. Local Drafts
* You can draft new content locally in this repository before publishing it to LinkedIn or YouTube.
* To create a local draft:
  1. Add a new sequentially numbered folder under the respective feed.
  2. Create an `index.md` with your custom text.
  3. **Omit the `id` field** (or set it to `null`/leave it out) from the frontmatter.
* The sync script will ignore directories without a platform `id` in the frontmatter, preserving them as local drafts.
