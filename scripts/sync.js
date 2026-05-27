import { execSync } from 'child_process';
import { loadEnv } from "./sync/utils.js";
import { syncGitHub } from "./sync/github.js";
import { syncYouTube } from "./sync/youtube.js";
import { syncLinkedIn } from "./sync/linkedin.js";

async function main() {
  loadEnv();
  console.log("Starting feed sync process...");

  // Parse command line arguments
  const args = process.argv.slice(2);
  const runGitHub = args.includes('--github');
  const runYouTube = args.includes('--youtube');
  const runLinkedIn = args.includes('--linkedin');
  
  // If no specific flag is provided, run all
  const runAll = !runGitHub && !runYouTube && !runLinkedIn;

  let hasErrors = false;

  if (runAll || runGitHub) {
    try {
      await syncGitHub();
    } catch (error) {
      console.error("❌ GitHub sync failed:", error.message || error);
      hasErrors = true;
    }
  }

  if (runAll || runYouTube) {
    try {
      await syncYouTube();
    } catch (error) {
      console.error("❌ YouTube sync failed:", error.message || error);
      hasErrors = true;
    }
  }

  if (runAll || runLinkedIn) {
    try {
      await syncLinkedIn();
    } catch (error) {
      console.error("❌ LinkedIn sync failed:", error.message || error);
      hasErrors = true;
    }
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
    console.log("\n✅ Feed sync completed successfully!");
    process.exit(0);
  }
}

main();
