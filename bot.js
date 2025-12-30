#!/usr/bin/env node

import { Command } from "commander";
import { AccountManager } from "./accountManager.js";
import { PostDistributor } from "./postDistributor.js";
import { extractTweetId, isValidTweetId } from "./utils.js";
import fs from "fs";

const program = new Command();
const accountManager = new AccountManager();
const postDistributor = new PostDistributor(accountManager);

program
  .name("x-raider")
  .description("Multi-account X (Twitter) bot for posting, retweeting, and replying")
  .version("1.0.0");

// Post command
program
  .command("post")
  .description("Post tweets across multiple accounts")
  .option("-t, --text <text>", "Single post text")
  .option("-f, --file <file>", "File containing posts (one per line)")
  .option("-d, --delay <ms>", "Delay between posts in milliseconds", "2000")
  .action(async (options) => {
    try {
      let posts = [];

      if (options.file) {
        // Read posts from file
        if (!fs.existsSync(options.file)) {
          console.error(`❌ File not found: ${options.file}`);
          process.exit(1);
        }
        const content = fs.readFileSync(options.file, "utf-8");
        posts = content
          .split("\n")
          .map(line => line.trim())
          .filter(line => line.length > 0);
        
        if (posts.length === 0) {
          console.error("❌ No posts found in file");
          process.exit(1);
        }
      } else if (options.text) {
        posts = [options.text];
      } else {
        console.error("❌ Please provide either --text or --file option");
        program.help();
        process.exit(1);
      }

      const delay = parseInt(options.delay, 10);
      const results = await postDistributor.distributePosts(posts, { delay });

      // Summary
      console.log("\n" + "=".repeat(60));
      console.log("📊 SUMMARY");
      console.log("=".repeat(60));
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      console.log(`✅ Successful: ${successful}`);
      console.log(`❌ Failed: ${failed}`);
      console.log("=".repeat(60) + "\n");

      // Show successful posts
      if (successful > 0) {
        console.log("✅ Successful Posts:");
        results.filter(r => r.success).forEach(r => {
          console.log(`  [${r.account}] ${r.tweetUrl}`);
        });
        console.log();
      }

      // Show failed posts
      if (failed > 0) {
        console.log("❌ Failed Posts:");
        results.filter(r => !r.success).forEach(r => {
          console.log(`  [${r.account}] ${r.error}`);
        });
        console.log();
      }

    } catch (error) {
      console.error("❌ Error:", error.message);
      process.exit(1);
    }
  });

// Retweet command
program
  .command("retweet")
  .description("Retweet a tweet across multiple accounts")
  .requiredOption("-i, --id <tweetId>", "Tweet ID or URL to retweet")
  .option("-d, --delay <ms>", "Delay between retweets in milliseconds", "2000")
  .action(async (options) => {
    try {
      let tweetId = options.id;

      // Extract tweet ID from URL if provided
      if (tweetId.includes("twitter.com") || tweetId.includes("x.com")) {
        tweetId = extractTweetId(tweetId);
        if (!tweetId) {
          console.error("❌ Invalid Twitter URL. Could not extract tweet ID.");
          process.exit(1);
        }
      }

      // Validate tweet ID
      if (!isValidTweetId(tweetId)) {
        console.error("❌ Invalid tweet ID. Must be numeric.");
        process.exit(1);
      }

      const delay = parseInt(options.delay, 10);
      const results = await postDistributor.distributeRetweets(tweetId, { delay });

      // Summary
      console.log("\n" + "=".repeat(60));
      console.log("📊 SUMMARY");
      console.log("=".repeat(60));
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      console.log(`✅ Successful: ${successful}`);
      console.log(`❌ Failed: ${failed}`);
      console.log("=".repeat(60) + "\n");

    } catch (error) {
      console.error("❌ Error:", error.message);
      process.exit(1);
    }
  });

// Reply command
program
  .command("reply")
  .description("Reply to a tweet across multiple accounts")
  .requiredOption("-i, --id <tweetId>", "Tweet ID or URL to reply to")
  .option("-t, --text <text>", "Single reply text")
  .option("-f, --file <file>", "File containing replies (one per line)")
  .option("-d, --delay <ms>", "Delay between replies in milliseconds", "2000")
  .action(async (options) => {
    try {
      let tweetId = options.id;

      // Extract tweet ID from URL if provided
      if (tweetId.includes("twitter.com") || tweetId.includes("x.com")) {
        tweetId = extractTweetId(tweetId);
        if (!tweetId) {
          console.error("❌ Invalid Twitter URL. Could not extract tweet ID.");
          process.exit(1);
        }
      }

      // Validate tweet ID
      if (!isValidTweetId(tweetId)) {
        console.error("❌ Invalid tweet ID. Must be numeric.");
        process.exit(1);
      }

      let replies = [];

      if (options.file) {
        // Read replies from file
        if (!fs.existsSync(options.file)) {
          console.error(`❌ File not found: ${options.file}`);
          process.exit(1);
        }
        const content = fs.readFileSync(options.file, "utf-8");
        replies = content
          .split("\n")
          .map(line => line.trim())
          .filter(line => line.length > 0);
        
        if (replies.length === 0) {
          console.error("❌ No replies found in file");
          process.exit(1);
        }
      } else if (options.text) {
        replies = [options.text];
      } else {
        console.error("❌ Please provide either --text or --file option");
        program.help();
        process.exit(1);
      }

      const delay = parseInt(options.delay, 10);
      const results = await postDistributor.distributeReplies(tweetId, replies, { delay });

      // Summary
      console.log("\n" + "=".repeat(60));
      console.log("📊 SUMMARY");
      console.log("=".repeat(60));
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      console.log(`✅ Successful: ${successful}`);
      console.log(`❌ Failed: ${failed}`);
      console.log("=".repeat(60) + "\n");

      // Show successful replies
      if (successful > 0) {
        console.log("✅ Successful Replies:");
        results.filter(r => r.success).forEach(r => {
          console.log(`  [${r.account}] ${r.tweetUrl}`);
        });
        console.log();
      }

      // Show failed replies
      if (failed > 0) {
        console.log("❌ Failed Replies:");
        results.filter(r => !r.success).forEach(r => {
          console.log(`  [${r.account}] ${r.error}`);
        });
        console.log();
      }

    } catch (error) {
      console.error("❌ Error:", error.message);
      process.exit(1);
    }
  });

// List accounts command
program
  .command("accounts")
  .description("List all loaded accounts")
  .action(() => {
    const accounts = accountManager.getAccounts();
    
    if (accounts.length === 0) {
      console.log("⚠️  No accounts loaded.");
      console.log("\nTo add accounts:");
      console.log("1. Create an 'accounts' directory in the project root");
      console.log("2. Add .env files for each account (e.g., account1.env, account2.env)");
      console.log("3. Each .env file should contain:");
      console.log("   API_KEY=your_api_key");
      console.log("   API_SECRET=your_api_secret");
      console.log("   ACCESS_TOKEN=your_access_token");
      console.log("   ACCESS_SECRET=your_access_token_secret");
      return;
    }

    console.log(`\n📋 Loaded Accounts (${accounts.length}):\n`);
    accounts.forEach((account, index) => {
      console.log(`${index + 1}. ${account.name}`);
      console.log(`   Path: ${account.path}\n`);
    });
  });

// Parse arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

