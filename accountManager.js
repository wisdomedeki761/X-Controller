import { TwitterApi } from "twitter-api-v2";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Loads and manages multiple X (Twitter) accounts
 */
export class AccountManager {
  constructor() {
    this.accounts = [];
    this.loadAccounts();
  }

  /**
   * Loads all account .env files from the accounts directory
   */
  loadAccounts() {
    const accountsDir = path.join(__dirname, "accounts");
    
    // Create accounts directory if it doesn't exist
    if (!fs.existsSync(accountsDir)) {
      fs.mkdirSync(accountsDir, { recursive: true });
      console.log("📁 Created 'accounts' directory. Please add your account .env files there.");
      return;
    }

    // Find all .env files in accounts directory
    const files = fs.readdirSync(accountsDir).filter(file => file.endsWith(".env"));
    
    if (files.length === 0) {
      console.log("⚠️  No account .env files found in 'accounts' directory.");
      return;
    }

    // Load each account
    for (const file of files) {
      const accountPath = path.join(accountsDir, file);
      const accountName = path.basename(file, ".env");
      
      try {
        const config = dotenv.config({ path: accountPath }).parsed;
        
        if (this.validateAccountConfig(config, accountName)) {
          // Trim whitespace from credentials
          const apiKey = (config.API_KEY || config.API_Key || "").trim();
          const apiSecret = (config.API_SECRET || config.API_Key_Secret || "").trim();
          const accessToken = (config.ACCESS_TOKEN || config.Access_Token || "").trim();
          const accessSecret = (config.ACCESS_SECRET || config.Access_Token_Secret || "").trim();

          const client = new TwitterApi({
            appKey: apiKey,
            appSecret: apiSecret,
            accessToken: accessToken,
            accessSecret: accessSecret,
          });

          this.accounts.push({
            name: accountName,
            client: client,
            config: config,
            path: accountPath
          });
        }
      } catch (error) {
        console.error(`❌ Error loading account ${accountName}:`, error.message);
      }
    }

    console.log(`✅ Loaded ${this.accounts.length} account(s)`);
  }

  /**
   * Validates account configuration
   */
  validateAccountConfig(config, accountName) {
    const required = [
      "API_KEY", "API_Key",
      "API_SECRET", "API_Key_Secret",
      "ACCESS_TOKEN", "Access_Token",
      "ACCESS_SECRET", "Access_Token_Secret"
    ];

    const hasApiKey = config.API_KEY || config.API_Key;
    const hasApiSecret = config.API_SECRET || config.API_Key_Secret;
    const hasAccessToken = config.ACCESS_TOKEN || config.Access_Token;
    const hasAccessSecret = config.ACCESS_SECRET || config.Access_Token_Secret;

    if (!hasApiKey || !hasApiSecret || !hasAccessToken || !hasAccessSecret) {
      console.error(`⚠️  Account ${accountName} is missing required credentials`);
      return false;
    }

    return true;
  }

  /**
   * Gets all loaded accounts
   */
  getAccounts() {
    return this.accounts;
  }

  /**
   * Gets account count
   */
  getAccountCount() {
    return this.accounts.length;
  }

  /**
   * Gets a random account
   */
  getRandomAccount() {
    if (this.accounts.length === 0) return null;
    return this.accounts[Math.floor(Math.random() * this.accounts.length)];
  }

  /**
   * Gets accounts in a round-robin fashion
   */
  getAccountRoundRobin(index) {
    if (this.accounts.length === 0) return null;
    return this.accounts[index % this.accounts.length];
  }
}

