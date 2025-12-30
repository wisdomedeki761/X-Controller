import TelegramBot from 'node-telegram-bot-api';
import { AccountManager } from './accountManager.js';
import { PostDistributor } from './postDistributor.js';
import { OpenRouterClient } from './openRouterClient.js';
import { ModelUpdater } from './modelUpdater.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Telegram Bot for controlling X-Raider
 */
export class XRaiderTelegramBot {
  constructor(token) {
    this.bot = new TelegramBot(token, { polling: true });
    this.accountManager = new AccountManager();
    this.postDistributor = new PostDistributor(this.accountManager);
    this.userStates = new Map(); // Track user conversation states
    this.tempData = new Map(); // Store temporary data like images

    // Load admin IDs from environment
    this.adminIds = process.env.ADMIN_IDS ?
      process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [];

    if (this.adminIds.length === 0) {
      console.warn('⚠️  No ADMIN_IDS configured in .env file');
      console.warn('📝 Add your Telegram user ID(s) to ADMIN_IDS');
    } else {
      console.log(`✅ Loaded ${this.adminIds.length} admin ID(s)`);
    }

    // Initialize OpenRouter AI client
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (openRouterKey) {
      this.openRouterClient = new OpenRouterClient(openRouterKey);
      this.modelUpdater = new ModelUpdater(this.openRouterClient);
      this.modelUpdater.startCronJob(); // Start automatic updates
      console.log('🤖 OpenRouter AI integration enabled');
    } else {
      console.warn('⚠️  OPENROUTER_API_KEY not configured, AI features disabled');
      this.openRouterClient = null;
      this.modelUpdater = null;
    }

    this.setupCommands();
    this.setupMessageHandlers();
  }

  /**
   * Check if user is admin
   */
  isAdmin(userId) {
    return this.adminIds.includes(userId.toString());
  }

  /**
   * Set up bot commands
   */
  setupCommands() {
    const commands = [
      { command: 'start', description: 'Start the bot' },
      { command: 'accounts', description: 'List all accounts' },
      { command: 'post', description: 'Create posts (use /post5 for 5 accounts)' },
      { command: 'reply', description: 'Reply to tweets (use /reply3 for 3 accounts)' },
      { command: 'retweet', description: 'Retweet tweets (use /retweet2 for 2 accounts)' },
      { command: 'addaccount', description: 'Add a new account' },
      { command: 'help', description: 'Show help' }
    ];

    // Add AI commands if OpenRouter is configured
    if (this.openRouterClient) {
      commands.push(
        { command: 'ai', description: 'Chat with AI (send message after command)' },
        { command: 'models', description: 'List available AI models' },
        { command: 'updatemodels', description: 'Force update AI models' }
      );
    }

    this.bot.setMyCommands(commands);
  }

  /**
   * Set up message and command handlers
   */
  setupMessageHandlers() {
    // Start command
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      if (!this.isAdmin(userId)) {
        return this.bot.sendMessage(chatId, '❌ Access denied. You are not authorized to use this bot.');
      }

      const welcomeMessage = `
🤖 *X-Raider Telegram Bot*

I can help you manage multiple X (Twitter) accounts!

*Available commands:*
/post - Create posts with images
/reply - Reply to tweets
/retweet - Retweet posts
/accounts - List your accounts
/addaccount - Add new accounts
/help - Show help

*How to post multiple tweets:*
Send multiple paragraphs separated by empty lines, and I'll distribute them across your accounts (1 tweet per account).

*Example:*
\`\`\`
First tweet here

Second tweet here

Third tweet here
\`\`\`

Send me the text, then optionally add an image!
      `;
      this.bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
    });

    // Help command
    this.bot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      if (!this.isAdmin(userId)) {
        return this.bot.sendMessage(chatId, '❌ Access denied. You are not authorized to use this bot.');
      }

      const helpMessage = `
📚 *X-Raider Bot Help*

*Creating Posts:*
1. Send /post command (uses all accounts)
   Or /post{N} (uses N accounts) - e.g., /post1, /post5, /post11, /post99
2. Send your tweet text (use paragraphs for multiple tweets)
3. Optionally send an image
4. Bot will distribute across selected accounts

*Example Multi-Tweet:*
\`\`\`
Tweet 1 content here

Tweet 2 content here

Tweet 3 content here
\`\`\`

*Replying to Tweets:*
1. Send /reply command (uses all accounts)
   Or /reply{N} (uses N accounts) - e.g., /reply1, /reply2, /reply7
2. Send the tweet URL or ID
3. Send your reply text
4. Bot will reply from selected accounts

*Retweeting:*
1. Send /retweet command (uses all accounts)
   Or /retweet{N} (uses N accounts) - e.g., /retweet1, /retweet4, /retweet10
2. Send the tweet URL or ID
3. Bot will retweet from selected accounts

*Adding Accounts:*
1. Send /addaccount command
2. Send account name
3. Send API_KEY
4. Send API_SECRET
5. Send ACCESS_TOKEN
6. Send ACCESS_SECRET

*Rate Limits:* 500 posts/month per account
*Delay:* 2 seconds between posts by default

Need help? Contact the developer.
      `;
      this.bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
    });

    // Accounts command
    this.bot.onText(/\/accounts/, (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      if (!this.isAdmin(userId)) {
        return this.bot.sendMessage(chatId, '❌ Access denied. You are not authorized to use this bot.');
      }

      const accounts = this.accountManager.getAccounts();

      if (accounts.length === 0) {
        this.bot.sendMessage(chatId, '❌ No accounts configured. Use /addaccount to add accounts.');
        return;
      }

      let accountList = `📋 *Loaded Accounts (${accounts.length}):*\n\n`;
      accounts.forEach((account, index) => {
        accountList += `${index + 1}. \`${account.name}\`\n`;
      });

      this.bot.sendMessage(chatId, accountList, { parse_mode: 'Markdown' });
    });

    // Post command with optional account count
    this.bot.onText(/\/post(\d*)/, (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      if (!this.isAdmin(userId)) {
        return this.bot.sendMessage(chatId, '❌ Access denied. You are not authorized to use this bot.');
      }

      const maxAccounts = match[1] ? parseInt(match[1]) : null; // null means use all accounts
      const accountCountText = maxAccounts ? ` (using ${maxAccounts} account${maxAccounts === 1 ? '' : 's'})` : ' (using all accounts)';

      this.userStates.set(userId, { action: 'waiting_for_post_text', chatId, maxAccounts });
      this.tempData.set(userId, { maxAccounts });

      this.bot.sendMessage(chatId, `📝 *Send me your tweet text${accountCountText}:*\n\n- For multiple tweets, separate with empty lines\n- Then optionally send an image\n\nExample:\n\`\`\`\nFirst tweet\n\nSecond tweet\n\nThird tweet\n\`\`\``, { parse_mode: 'Markdown' });
    });

    // Reply command with optional account count
    this.bot.onText(/\/reply(\d*)/, (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      if (!this.isAdmin(userId)) {
        return this.bot.sendMessage(chatId, '❌ Access denied. You are not authorized to use this bot.');
      }

      const maxAccounts = match[1] ? parseInt(match[1]) : null;
      const accountCountText = maxAccounts ? ` (using ${maxAccounts} account${maxAccounts === 1 ? '' : 's'})` : ' (using all accounts)';

      this.userStates.set(userId, { action: 'waiting_for_tweet_id', chatId, replyMode: true, maxAccounts });
      this.tempData.set(userId, { maxAccounts });

      this.bot.sendMessage(chatId, `🔗 *Send me the tweet URL or ID to reply to${accountCountText}:*`, { parse_mode: 'Markdown' });
    });

    // Retweet command with optional account count
    this.bot.onText(/\/retweet(\d*)/, (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      if (!this.isAdmin(userId)) {
        return this.bot.sendMessage(chatId, '❌ Access denied. You are not authorized to use this bot.');
      }

      const maxAccounts = match[1] ? parseInt(match[1]) : null;
      const accountCountText = maxAccounts ? ` (using ${maxAccounts} account${maxAccounts === 1 ? '' : 's'})` : ' (using all accounts)';

      this.userStates.set(userId, { action: 'waiting_for_tweet_id', chatId, retweetMode: true, maxAccounts });
      this.tempData.set(userId, { maxAccounts });

      this.bot.sendMessage(chatId, `🔄 *Send me the tweet URL or ID to retweet${accountCountText}:*`, { parse_mode: 'Markdown' });
    });

    // Add account command
    this.bot.onText(/\/addaccount/, (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      if (!this.isAdmin(userId)) {
        return this.bot.sendMessage(chatId, '❌ Access denied. You are not authorized to use this bot.');
      }

      this.userStates.set(userId, { action: 'waiting_for_account_name', chatId });
      this.tempData.set(userId, {});

      this.bot.sendMessage(chatId, '🏷️ *Send me the account name:* (e.g., account1, account2)', { parse_mode: 'Markdown' });
    });

    // AI chat command
    this.bot.onText(/\/ai/, (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      if (!this.isAdmin(userId)) {
        return this.bot.sendMessage(chatId, '❌ Access denied. You are not authorized to use this bot.');
      }

      if (!this.openRouterClient) {
        return this.bot.sendMessage(chatId, '❌ AI features not configured. Please set OPENROUTER_API_KEY in .env file.');
      }

      // Check if there's text after /ai command
      const messageText = msg.text.replace('/ai', '').trim();
      if (messageText) {
        // Direct message after command
        this.handleAIMessage(chatId, userId, messageText);
      } else {
        // Wait for next message
        this.userStates.set(userId, { action: 'waiting_for_ai_message', chatId });
        this.bot.sendMessage(chatId, '🤖 *Send me your message for AI chat:*', { parse_mode: 'Markdown' });
      }
    });

    // Models command
    this.bot.onText(/\/models/, (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      if (!this.isAdmin(userId)) {
        return this.bot.sendMessage(chatId, '❌ Access denied. You are not authorized to use this bot.');
      }

      if (!this.openRouterClient) {
        return this.bot.sendMessage(chatId, '❌ AI features not configured.');
      }

      const stats = this.openRouterClient.getModelStats();
      const updaterStats = this.modelUpdater ? this.modelUpdater.getStatus() : null;

      let message = `🤖 *AI Models Status*\n\n`;
      message += `📊 Available: ${stats.total} free models\n`;

      if (updaterStats) {
        message += `🔄 Auto-update: ${updaterStats.nextUpdate}\n`;
        message += `⚡ Updating: ${updaterStats.isRunning ? 'Yes' : 'No'}\n\n`;
      }

      message += `*Free Models:*\n`;
      stats.models.slice(0, 10).forEach((model, index) => {
        message += `${index + 1}. \`${model.name}\` (${model.context_length} tokens)\n`;
      });

      if (stats.models.length > 10) {
        message += `\n... and ${stats.models.length - 10} more`;
      }

      this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });

    // Update models command
    this.bot.onText(/\/updatemodels/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      if (!this.isAdmin(userId)) {
        return this.bot.sendMessage(chatId, '❌ Access denied. You are not authorized to use this bot.');
      }

      if (!this.modelUpdater) {
        return this.bot.sendMessage(chatId, '❌ Model updater not configured.');
      }

      try {
        this.bot.sendMessage(chatId, '🔄 Updating AI models...', { parse_mode: 'Markdown' });
        const models = await this.modelUpdater.forceUpdate();
        this.bot.sendMessage(chatId, `✅ Successfully updated ${models.length} free AI models!`, { parse_mode: 'Markdown' });
      } catch (error) {
        this.bot.sendMessage(chatId, `❌ Failed to update models: ${error.message}`, { parse_mode: 'Markdown' });
      }
    });

    // Handle text messages
    this.bot.on('message', (msg) => {
      if (msg.text && !msg.text.startsWith('/')) {
        this.handleTextMessage(msg);
      }
    });

    // Handle photo messages
    this.bot.on('photo', (msg) => {
      this.handlePhotoMessage(msg);
    });
  }

  /**
   * Handle text messages based on user state
   */
  async handleTextMessage(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    // Check admin access for all interactions
    if (!this.isAdmin(userId)) {
      return this.bot.sendMessage(chatId, '❌ Access denied. You are not authorized to use this bot.');
    }

    const userState = this.userStates.get(userId);
    if (!userState) return;

    // Handle AI messages
    if (userState.action === 'waiting_for_ai_message') {
      await this.handleAIMessage(chatId, userId, text);
      return;
    }

    const tempData = this.tempData.get(userId) || {};

    switch (userState.action) {
      case 'waiting_for_post_text':
        tempData.postText = text;
        this.userStates.set(userId, { action: 'waiting_for_image', chatId });
        this.bot.sendMessage(chatId, '🖼️ *Got the text! Now send an image (optional) or send /done to post without image:*', { parse_mode: 'Markdown' });
        break;

      case 'waiting_for_tweet_id':
        tempData.tweetId = this.extractTweetId(text);
        if (!tempData.tweetId) {
          this.bot.sendMessage(chatId, '❌ Invalid tweet URL or ID. Please send a valid Twitter URL or tweet ID.');
          return;
        }

        if (userState.replyMode) {
          this.userStates.set(userId, { action: 'waiting_for_reply_text', chatId });
          this.bot.sendMessage(chatId, '💬 *Send me your reply text:*', { parse_mode: 'Markdown' });
        } else if (userState.retweetMode) {
          await this.handleRetweet(chatId, userId, tempData.tweetId);
        }
        break;

      case 'waiting_for_reply_text':
        tempData.replyText = text;
        this.userStates.set(userId, { action: 'waiting_for_image', chatId });
        this.bot.sendMessage(chatId, '🖼️ *Got the reply! Send an image (optional) or send /done to reply without image:*', { parse_mode: 'Markdown' });
        break;

      case 'waiting_for_account_name':
        tempData.accountName = text.replace(/[^a-zA-Z0-9]/g, '');
        this.userStates.set(userId, { action: 'waiting_for_api_key', chatId });
        this.bot.sendMessage(chatId, `🔑 *Send me the API_KEY for ${tempData.accountName}:*`, { parse_mode: 'Markdown' });
        break;

      case 'waiting_for_api_key':
        tempData.apiKey = text;
        this.userStates.set(userId, { action: 'waiting_for_api_secret', chatId });
        this.bot.sendMessage(chatId, '🔐 *Send me the API_SECRET:*', { parse_mode: 'Markdown' });
        break;

      case 'waiting_for_api_secret':
        tempData.apiSecret = text;
        this.userStates.set(userId, { action: 'waiting_for_access_token', chatId });
        this.bot.sendMessage(chatId, '🔑 *Send me the ACCESS_TOKEN:*', { parse_mode: 'Markdown' });
        break;

      case 'waiting_for_access_token':
        tempData.accessToken = text;
        this.userStates.set(userId, { action: 'waiting_for_access_secret', chatId });
        this.bot.sendMessage(chatId, '🔐 *Send me the ACCESS_SECRET:*', { parse_mode: 'Markdown' });
        break;

      case 'waiting_for_access_secret':
        tempData.accessSecret = text;
        await this.handleAddAccount(chatId, userId, tempData);
        break;
    }
  }

  /**
   * Handle photo messages
   */
  async handlePhotoMessage(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Check admin access
    if (!this.isAdmin(userId)) {
      return this.bot.sendMessage(chatId, '❌ Access denied. You are not authorized to use this bot.');
    }

    const userState = this.userStates.get(userId);
    if (!userState) return;

    const tempData = this.tempData.get(userId) || {};

    // Get the highest resolution photo
    const photo = msg.photo[msg.photo.length - 1];
    const fileId = photo.file_id;

    try {
      const fileLink = await this.bot.getFileLink(fileId);
      tempData.imageUrl = fileLink;

      this.bot.sendMessage(chatId, '🖼️ *Image received!* Processing...', { parse_mode: 'Markdown' });

      // Execute the pending action
      if (userState.action === 'waiting_for_image') {
        if (tempData.postText) {
          await this.handlePost(chatId, userId, tempData);
        } else if (tempData.replyText) {
          await this.handleReply(chatId, userId, tempData);
        }
      }
    } catch (error) {
      console.error('Error downloading image:', error);
      this.bot.sendMessage(chatId, '❌ Error processing image. Try again.');
    }
  }

  /**
   * Handle posting tweets
   */
  async handlePost(chatId, userId, data) {
    try {
      // Parse multiple tweets from text (separated by double newlines)
      const tweets = data.postText.split(/\n\s*\n/).map(t => t.trim()).filter(t => t.length > 0);

      if (tweets.length === 0) {
        this.bot.sendMessage(chatId, '❌ No valid tweets found.');
        return;
      }

      this.bot.sendMessage(chatId, `📊 Processing ${tweets.length} tweet(s)...`);

      // If image provided, download it temporarily
      let imagePath = null;
      if (data.imageUrl) {
        imagePath = await this.downloadImage(data.imageUrl);
      }

      // Distribute posts across accounts
      const results = await this.postDistributor.distributePosts(tweets, {
        delay: 2000,
        imagePath: imagePath,
        maxAccounts: data.maxAccounts
      });

      // Send results back
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      let resultMessage = `✅ *Posted ${successful.length} tweet(s)*\n\n`;

      successful.forEach(result => {
        resultMessage += `🔗 [${result.account}] ${result.tweetUrl}\n`;
      });

      if (failed.length > 0) {
        resultMessage += `\n❌ *Failed ${failed.length} tweet(s):*\n`;
        failed.forEach(result => {
          resultMessage += `❌ [${result.account}] ${result.error}\n`;
        });
      }

      this.bot.sendMessage(chatId, resultMessage, { parse_mode: 'Markdown' });

      // Clean up
      if (imagePath) {
        fs.unlinkSync(imagePath);
      }
      this.userStates.delete(userId);
      this.tempData.delete(userId);

    } catch (error) {
      console.error('Post error:', error);
      this.bot.sendMessage(chatId, `❌ Error posting: ${error.message}`);
    }
  }

  /**
   * Handle replying to tweets
   */
  async handleReply(chatId, userId, data) {
    try {
      // Parse multiple replies
      const replies = data.replyText.split(/\n\s*\n/).map(r => r.trim()).filter(r => r.length > 0);

      if (replies.length === 0) {
        this.bot.sendMessage(chatId, '❌ No valid replies found.');
        return;
      }

      this.bot.sendMessage(chatId, `💬 Processing ${replies.length} reply(ies)...`);

      // If image provided, download it temporarily
      let imagePath = null;
      if (data.imageUrl) {
        imagePath = await this.downloadImage(data.imageUrl);
      }

      const results = await this.postDistributor.distributeReplies(data.tweetId, replies, {
        delay: 2000,
        imagePath: imagePath,
        maxAccounts: data.maxAccounts
      });

      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      let resultMessage = `✅ *Replied ${successful.length} time(s)*\n\n`;

      successful.forEach(result => {
        resultMessage += `🔗 [${result.account}] ${result.tweetUrl}\n`;
      });

      if (failed.length > 0) {
        resultMessage += `\n❌ *Failed ${failed.length} reply(ies):*\n`;
        failed.forEach(result => {
          resultMessage += `❌ [${result.account}] ${result.error}\n`;
        });
      }

      this.bot.sendMessage(chatId, resultMessage, { parse_mode: 'Markdown' });

      this.userStates.delete(userId);
      this.tempData.delete(userId);

    } catch (error) {
      console.error('Reply error:', error);
      this.bot.sendMessage(chatId, `❌ Error replying: ${error.message}`);
    }
  }

  /**
   * Handle retweeting
   */
  async handleRetweet(chatId, userId, tweetId) {
    try {
      this.bot.sendMessage(chatId, '🔄 Retweeting...');

      const results = await this.postDistributor.distributeRetweets(tweetId, {
        delay: 2000,
        maxAccounts: userState.maxAccounts
      });

      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      let resultMessage = `✅ *Retweeted by ${successful.length} account(s)*\n\n`;

      successful.forEach(result => {
        resultMessage += `✅ [${result.account}] Retweeted\n`;
      });

      if (failed.length > 0) {
        resultMessage += `\n❌ *Failed ${failed.length} retweet(s):*\n`;
        failed.forEach(result => {
          resultMessage += `❌ [${result.account}] ${result.error}\n`;
        });
      }

      this.bot.sendMessage(chatId, resultMessage, { parse_mode: 'Markdown' });

      this.userStates.delete(userId);
      this.tempData.delete(userId);

    } catch (error) {
      console.error('Retweet error:', error);
      this.bot.sendMessage(chatId, `❌ Error retweeting: ${error.message}`);
    }
  }

  /**
   * Handle adding new accounts
   */
  async handleAddAccount(chatId, userId, data) {
    try {
      // Create .env file content
      const envContent = `API_KEY=${data.apiKey}\nAPI_SECRET=${data.apiSecret}\nACCESS_TOKEN=${data.accessToken}\nACCESS_SECRET=${data.accessSecret}\n`;

      const accountsDir = path.join(__dirname, 'accounts');
      if (!fs.existsSync(accountsDir)) {
        fs.mkdirSync(accountsDir, { recursive: true });
      }

      const envFilePath = path.join(accountsDir, `${data.accountName}.env`);
      fs.writeFileSync(envFilePath, envContent);

      // Reload accounts
      this.accountManager = new AccountManager();
      this.postDistributor = new PostDistributor(this.accountManager);

      this.bot.sendMessage(chatId, `✅ *Account "${data.accountName}" added successfully!*`, { parse_mode: 'Markdown' });

      this.userStates.delete(userId);
      this.tempData.delete(userId);

    } catch (error) {
      console.error('Add account error:', error);
      this.bot.sendMessage(chatId, `❌ Error adding account: ${error.message}`);
    }
  }

  /**
   * Handle AI chat messages
   */
  async handleAIMessage(chatId, userId, message) {
    if (!this.openRouterClient) {
      return this.bot.sendMessage(chatId, '❌ AI features not configured.');
    }

    try {
      // Send typing indicator
      this.bot.sendChatAction(chatId, 'typing');

      // Send initial response
      this.bot.sendMessage(chatId, '🤖 *Thinking...*', { parse_mode: 'Markdown' });

      // Get AI response with fallback logic
      const result = await this.openRouterClient.chat(message);

      // Send the AI response
      let responseMessage = `🤖 *AI Response (${result.model})*\n\n`;
      responseMessage += result.reply;

      // Truncate if too long for Telegram
      if (responseMessage.length > 4000) {
        responseMessage = responseMessage.substring(0, 4000) + '\n\n*...response truncated...*';
      }

      this.bot.sendMessage(chatId, responseMessage, { parse_mode: 'Markdown' });

      // Clean up user state
      this.userStates.delete(userId);

    } catch (error) {
      console.error('AI chat error:', error);
      this.bot.sendMessage(chatId, `❌ *AI Error:* ${error.message}`, { parse_mode: 'Markdown' });
      this.userStates.delete(userId);
    }
  }

  /**
   * Extract tweet ID from URL or return as-is if already ID
   */
  extractTweetId(input) {
    const urlMatch = input.match(/status\/(\d+)/);
    if (urlMatch) return urlMatch[1];

    const idMatch = input.match(/^\d+$/);
    if (idMatch) return input;

    return null;
  }

  /**
   * Download image from URL and return local path
   */
  async downloadImage(url) {
    const https = await import('https');
    const tempDir = path.join(__dirname, 'temp');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filename = `image_${Date.now()}.jpg`;
    const filepath = path.join(tempDir, filename);

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(filepath);
      https.get(url, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(filepath);
        });
      }).on('error', (err) => {
        fs.unlink(filepath, () => {});
        reject(err);
      });
    });
  }

  /**
   * Start the bot
   */
  start() {
    console.log('🤖 X-Raider Telegram Bot started!');
  }
}