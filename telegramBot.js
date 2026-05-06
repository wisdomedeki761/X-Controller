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
    this.lastBotMessages = new Map(); // Track last bot message per chat for cleanup

    // Load admin IDs from environment
    this.adminIds = process.env.ADMIN_IDS ?
      process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [];

    // Track authorized private groups
    this.authorizedGroups = new Set();

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
   * Initialize the bot (call this after construction)
   */
  async initialize() {
    await this.accountManager.initialize();
  }

  /**
   * Check if user is authorized (admin or member of authorized private group)
   */
  isAuthorized(userId, chatId, chatType) {
    // Admins are always authorized
    if (this.adminIds.includes(userId.toString())) {
      return true;
    }
    // In private groups, all members are authorized
    if ((chatType === 'group' || chatType === 'supergroup') && this.authorizedGroups.has(chatId.toString())) {
      return true;
    }
    return false;
  }

  /**
   * Check if user is admin (for admin-only commands)
   */
  isAdmin(userId) {
    return this.adminIds.includes(userId.toString());
  }

  /**
   * Delete previous bot message in a chat
   */
  async deletePreviousMessage(chatId) {
    const lastMsgId = this.lastBotMessages.get(chatId);
    if (lastMsgId) {
      try {
        await this.bot.deleteMessage(chatId, lastMsgId);
      } catch (error) {
        // Ignore errors (message may already be deleted or too old)
      }
    }
  }

  /**
   * Send message and track it for cleanup
   */
  async sendAndTrack(chatId, text, options = {}) {
    await this.deletePreviousMessage(chatId);
    const sentMsg = await this.bot.sendMessage(chatId, text, options);
    this.lastBotMessages.set(chatId, sentMsg.message_id);
    return sentMsg;
  }

  /**
   * Set up bot commands
   */
  setupCommands() {
    const commands = [
      { command: 'start', description: 'Start the bot' },
      { command: 'accounts', description: 'List all accounts' },
      { command: 'post', description: 'Create posts (/post, /post5, /post accountname)' },
      { command: 'reply', description: 'Reply to tweets (/reply, /reply accountname)' },
      { command: 'comment', description: 'Comment on tweets (alias for /reply)' },
      { command: 'retweet', description: 'Retweet (/retweet, /retweet accountname)' },
      { command: 'like', description: 'Like tweets (/like, /like accountname)' },
      { command: 'done', description: 'Finish post/reply without image' },
      { command: 'cancel', description: 'Cancel current operation' },
      { command: 'addaccount', description: 'Add a new account (admin only)' },
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
    // Handle bot being added to a group
    this.bot.on('new_chat_members', (msg) => {
      const chatId = msg.chat.id;
      const chatType = msg.chat.type;
      const newMembers = msg.new_chat_members;
      const botInfo = this.bot.options;

      // Check if bot was added to a private group
      newMembers.forEach(async (member) => {
        if (member.is_bot && member.username === (await this.bot.getMe()).username) {
          if (chatType === 'group' || chatType === 'supergroup') {
            // Authorize this group
            this.authorizedGroups.add(chatId.toString());
            console.log(`✅ Bot added to group ${chatId}, group is now authorized`);
            this.sendAndTrack(chatId, '✅ *X-Raider Bot Activated!*\n\nAll members of this group can now use the bot.\n\nType /help to see available commands.', { parse_mode: 'Markdown' });
          }
        }
      });
    });

    // Handle bot being removed from a group
    this.bot.on('left_chat_member', async (msg) => {
      const chatId = msg.chat.id;
      const leftMember = msg.left_chat_member;

      if (leftMember.is_bot && leftMember.username === (await this.bot.getMe()).username) {
        this.authorizedGroups.delete(chatId.toString());
        console.log(`🚪 Bot removed from group ${chatId}, group deauthorized`);
      }
    });

    // Start command
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const chatType = msg.chat.type;

      // If in a group, authorize it
      if (chatType === 'group' || chatType === 'supergroup') {
        this.authorizedGroups.add(chatId.toString());
      }

      if (!this.isAuthorized(userId, chatId, chatType)) {
        return this.sendAndTrack(chatId, '❌ Access denied. You are not authorized to use this bot.');
      }

      const welcomeMessage = `
🤖 *X-Raider Telegram Bot*

I can help you manage multiple X (Twitter) accounts!

*Available commands:*
/post - Create posts (all accounts)
/post accountname - Post from specific account
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
      await this.sendAndTrack(chatId, welcomeMessage, { parse_mode: 'Markdown' });
    });

    // Help command
    this.bot.onText(/\/help/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const chatType = msg.chat.type;

      if (!this.isAuthorized(userId, chatId, chatType)) {
        return this.sendAndTrack(chatId, '❌ Access denied. You are not authorized to use this bot.');
      }

      const helpMessage = `
📚 *X-Raider Bot Help*

*Creating Posts:*
1. Send /post command (uses all accounts)
   Or /post accountname (uses specific account)
   Or /post{N} (uses N accounts) - e.g., /post1, /post5
2. Send your tweet text (use paragraphs for multiple tweets)
3. Optionally send an image
4. Bot will distribute across selected accounts

*Example - Post from specific account:*
\`/post myaccount\` then send your tweet

*Example Multi-Tweet:*
\`\`\`
Tweet 1 content here

Tweet 2 content here

Tweet 3 content here
\`\`\`

*Replying/Commenting:*
1. Send /reply or /comment command (uses all accounts)
   Or /reply accountname (uses specific account)
   Or /reply{N} (uses N accounts)
2. Send the tweet URL or ID
3. Send your reply text
4. Bot will reply from selected accounts

*Retweeting:*
1. Send /retweet command (uses all accounts)
   Or /retweet accountname (uses specific account)
   Or /retweet{N} (uses N accounts)
2. Send the tweet URL or ID
3. Bot will retweet from selected accounts

*Liking Tweets:*
1. Send /like command (uses all accounts)
   Or /like accountname (uses specific account)
   Or /like{N} (uses N accounts)
2. Send the tweet URL or ID
3. Bot will like from selected accounts

*Adding Accounts (Admin only):*
1. Send /addaccount command
2. Send account name (must be unique)
3. Send API\\_KEY
4. Send API\\_SECRET
5. Send ACCESS\\_TOKEN
6. Send ACCESS\\_SECRET

*Rate Limits:* 500 posts/month per account
*Delay:* 2 seconds between posts by default

Need help? Contact the developer.
      `;
      await this.sendAndTrack(chatId, helpMessage, { parse_mode: 'Markdown' });
    });

    // Accounts command
    this.bot.onText(/\/accounts/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const chatType = msg.chat.type;

      if (!this.isAuthorized(userId, chatId, chatType)) {
        return this.sendAndTrack(chatId, '❌ Access denied. You are not authorized to use this bot.');
      }

      const accounts = this.accountManager.getAccounts();

      if (accounts.length === 0) {
        await this.sendAndTrack(chatId, '❌ No accounts configured. Use /addaccount to add accounts.');
        return;
      }

      let accountList = `📋 *Loaded Accounts (${accounts.length}):*\n\n`;
      accounts.forEach((account, index) => {
        accountList += `${index + 1}. \`${account.name}\`\n`;
      });

      await this.sendAndTrack(chatId, accountList, { parse_mode: 'Markdown' });
    });

    // Post command with optional account count or account name
    // Matches: /post, /post5, /post accountname
    this.bot.onText(/\/post(?:\s+(.+)|(\d*))?$/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const chatType = msg.chat.type;

      if (!this.isAuthorized(userId, chatId, chatType)) {
        return this.sendAndTrack(chatId, '❌ Access denied. You are not authorized to use this bot.');
      }

      const accountNameArg = match[1]?.trim(); // Account name after space
      const numberArg = match[2]; // Number directly after /post

      let maxAccounts = null;
      let specificAccount = null;
      let accountCountText = ' (using all accounts)';

      if (accountNameArg && !/^\d+$/.test(accountNameArg)) {
        // It's an account name, not a number
        const accounts = this.accountManager.getAccounts();
        specificAccount = accounts.find(acc => acc.name.toLowerCase() === accountNameArg.toLowerCase());

        if (!specificAccount) {
          const availableNames = accounts.map(a => `\`${a.name}\``).join(', ');
          await this.sendAndTrack(chatId, `❌ Account "${accountNameArg}" not found.\n\n*Available accounts:* ${availableNames || 'None'}`, { parse_mode: 'Markdown' });
          return;
        }
        accountCountText = ` (using account: ${specificAccount.name})`;
      } else if (numberArg) {
        maxAccounts = parseInt(numberArg);
        accountCountText = ` (using ${maxAccounts} account${maxAccounts === 1 ? '' : 's'})`;
      } else if (accountNameArg && /^\d+$/.test(accountNameArg)) {
        maxAccounts = parseInt(accountNameArg);
        accountCountText = ` (using ${maxAccounts} account${maxAccounts === 1 ? '' : 's'})`;
      }

      this.userStates.set(userId, { action: 'waiting_for_post_text', chatId, maxAccounts, specificAccount: specificAccount?.name });
      this.tempData.set(userId, { maxAccounts, specificAccount: specificAccount?.name });

      await this.sendAndTrack(chatId, `📝 *Send me your tweet text${accountCountText}:*\n\n- For multiple tweets, separate with empty lines\n- Then optionally send an image\n\nExample:\n\`\`\`\nFirst tweet\n\nSecond tweet\n\nThird tweet\n\`\`\``, { parse_mode: 'Markdown' });
    });

    // Reply command with optional account count or account name
    this.bot.onText(/\/reply(?:\s+(.+)|(\d*))?$/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const chatType = msg.chat.type;

      if (!this.isAuthorized(userId, chatId, chatType)) {
        return this.sendAndTrack(chatId, '❌ Access denied. You are not authorized to use this bot.');
      }

      const accountNameArg = match[1]?.trim();
      const numberArg = match[2];

      let maxAccounts = null;
      let specificAccount = null;
      let accountCountText = ' (using all accounts)';

      if (accountNameArg && !/^\d+$/.test(accountNameArg)) {
        const accounts = this.accountManager.getAccounts();
        specificAccount = accounts.find(acc => acc.name.toLowerCase() === accountNameArg.toLowerCase());

        if (!specificAccount) {
          const availableNames = accounts.map(a => `\`${a.name}\``).join(', ');
          await this.sendAndTrack(chatId, `❌ Account "${accountNameArg}" not found.\n\n*Available accounts:* ${availableNames || 'None'}`, { parse_mode: 'Markdown' });
          return;
        }
        accountCountText = ` (using account: ${specificAccount.name})`;
      } else if (numberArg) {
        maxAccounts = parseInt(numberArg);
        accountCountText = ` (using ${maxAccounts} account${maxAccounts === 1 ? '' : 's'})`;
      } else if (accountNameArg && /^\d+$/.test(accountNameArg)) {
        maxAccounts = parseInt(accountNameArg);
        accountCountText = ` (using ${maxAccounts} account${maxAccounts === 1 ? '' : 's'})`;
      }

      this.userStates.set(userId, { action: 'waiting_for_tweet_id', chatId, replyMode: true, maxAccounts, specificAccount: specificAccount?.name });
      this.tempData.set(userId, { maxAccounts, specificAccount: specificAccount?.name });

      await this.sendAndTrack(chatId, `🔗 *Send me the tweet URL or ID to reply to${accountCountText}:*`, { parse_mode: 'Markdown' });
    });

    // Retweet command with optional account count or account name
    this.bot.onText(/\/retweet(?:\s+(.+)|(\d*))?$/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const chatType = msg.chat.type;

      if (!this.isAuthorized(userId, chatId, chatType)) {
        return this.sendAndTrack(chatId, '❌ Access denied. You are not authorized to use this bot.');
      }

      const accountNameArg = match[1]?.trim();
      const numberArg = match[2];

      let maxAccounts = null;
      let specificAccount = null;
      let accountCountText = ' (using all accounts)';

      if (accountNameArg && !/^\d+$/.test(accountNameArg)) {
        const accounts = this.accountManager.getAccounts();
        specificAccount = accounts.find(acc => acc.name.toLowerCase() === accountNameArg.toLowerCase());

        if (!specificAccount) {
          const availableNames = accounts.map(a => `\`${a.name}\``).join(', ');
          await this.sendAndTrack(chatId, `❌ Account "${accountNameArg}" not found.\n\n*Available accounts:* ${availableNames || 'None'}`, { parse_mode: 'Markdown' });
          return;
        }
        accountCountText = ` (using account: ${specificAccount.name})`;
      } else if (numberArg) {
        maxAccounts = parseInt(numberArg);
        accountCountText = ` (using ${maxAccounts} account${maxAccounts === 1 ? '' : 's'})`;
      } else if (accountNameArg && /^\d+$/.test(accountNameArg)) {
        maxAccounts = parseInt(accountNameArg);
        accountCountText = ` (using ${maxAccounts} account${maxAccounts === 1 ? '' : 's'})`;
      }

      this.userStates.set(userId, { action: 'waiting_for_tweet_id', chatId, retweetMode: true, maxAccounts, specificAccount: specificAccount?.name });
      this.tempData.set(userId, { maxAccounts, specificAccount: specificAccount?.name });

      await this.sendAndTrack(chatId, `🔄 *Send me the tweet URL or ID to retweet${accountCountText}:*`, { parse_mode: 'Markdown' });
    });

    // Like command with optional account count or account name
    this.bot.onText(/\/like(?:\s+(.+)|(\d*))?$/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const chatType = msg.chat.type;

      if (!this.isAuthorized(userId, chatId, chatType)) {
        return this.sendAndTrack(chatId, '❌ Access denied. You are not authorized to use this bot.');
      }

      const accountNameArg = match[1]?.trim();
      const numberArg = match[2];

      let maxAccounts = null;
      let specificAccount = null;
      let accountCountText = ' (using all accounts)';

      if (accountNameArg && !/^\d+$/.test(accountNameArg)) {
        const accounts = this.accountManager.getAccounts();
        specificAccount = accounts.find(acc => acc.name.toLowerCase() === accountNameArg.toLowerCase());

        if (!specificAccount) {
          const availableNames = accounts.map(a => `\`${a.name}\``).join(', ');
          await this.sendAndTrack(chatId, `❌ Account "${accountNameArg}" not found.\n\n*Available accounts:* ${availableNames || 'None'}`, { parse_mode: 'Markdown' });
          return;
        }
        accountCountText = ` (using account: ${specificAccount.name})`;
      } else if (numberArg) {
        maxAccounts = parseInt(numberArg);
        accountCountText = ` (using ${maxAccounts} account${maxAccounts === 1 ? '' : 's'})`;
      } else if (accountNameArg && /^\d+$/.test(accountNameArg)) {
        maxAccounts = parseInt(accountNameArg);
        accountCountText = ` (using ${maxAccounts} account${maxAccounts === 1 ? '' : 's'})`;
      }

      this.userStates.set(userId, { action: 'waiting_for_tweet_id', chatId, likeMode: true, maxAccounts, specificAccount: specificAccount?.name });
      this.tempData.set(userId, { maxAccounts, specificAccount: specificAccount?.name });

      await this.sendAndTrack(chatId, `❤️ *Send me the tweet URL or ID to like${accountCountText}:*`, { parse_mode: 'Markdown' });
    });

    // Comment command (alias for reply)
    this.bot.onText(/\/comment(?:\s+(.+)|(\d*))?$/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const chatType = msg.chat.type;

      if (!this.isAuthorized(userId, chatId, chatType)) {
        return this.sendAndTrack(chatId, '❌ Access denied. You are not authorized to use this bot.');
      }

      const accountNameArg = match[1]?.trim();
      const numberArg = match[2];

      let maxAccounts = null;
      let specificAccount = null;
      let accountCountText = ' (using all accounts)';

      if (accountNameArg && !/^\d+$/.test(accountNameArg)) {
        const accounts = this.accountManager.getAccounts();
        specificAccount = accounts.find(acc => acc.name.toLowerCase() === accountNameArg.toLowerCase());

        if (!specificAccount) {
          const availableNames = accounts.map(a => `\`${a.name}\``).join(', ');
          await this.sendAndTrack(chatId, `❌ Account "${accountNameArg}" not found.\n\n*Available accounts:* ${availableNames || 'None'}`, { parse_mode: 'Markdown' });
          return;
        }
        accountCountText = ` (using account: ${specificAccount.name})`;
      } else if (numberArg) {
        maxAccounts = parseInt(numberArg);
        accountCountText = ` (using ${maxAccounts} account${maxAccounts === 1 ? '' : 's'})`;
      } else if (accountNameArg && /^\d+$/.test(accountNameArg)) {
        maxAccounts = parseInt(accountNameArg);
        accountCountText = ` (using ${maxAccounts} account${maxAccounts === 1 ? '' : 's'})`;
      }

      this.userStates.set(userId, { action: 'waiting_for_tweet_id', chatId, replyMode: true, maxAccounts, specificAccount: specificAccount?.name });
      this.tempData.set(userId, { maxAccounts, specificAccount: specificAccount?.name });

      await this.sendAndTrack(chatId, `💬 *Send me the tweet URL or ID to comment on${accountCountText}:*`, { parse_mode: 'Markdown' });
    });

    // Add account command (admin only)
    this.bot.onText(/\/addaccount/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      // Only admins can add accounts
      if (!this.isAdmin(userId)) {
        return this.sendAndTrack(chatId, '❌ Access denied. Only admins can add accounts.');
      }

      this.userStates.set(userId, { action: 'waiting_for_account_name', chatId });
      this.tempData.set(userId, {});

      await this.sendAndTrack(chatId, '🏷️ *Send me the account name:* (e.g., account1, myaccount)\n\n⚠️ Name must be unique and contain only letters and numbers.', { parse_mode: 'Markdown' });
    });

    // Done command - post/reply without image
    this.bot.onText(/\/done/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const chatType = msg.chat.type;

      if (!this.isAuthorized(userId, chatId, chatType)) {
        return this.sendAndTrack(chatId, '❌ Access denied. You are not authorized to use this bot.');
      }

      const userState = this.userStates.get(userId);
      if (!userState || userState.action !== 'waiting_for_image') {
        return this.sendAndTrack(chatId, '❌ Nothing to finish. Start with /post or /reply first.');
      }

      const tempData = this.tempData.get(userId) || {};

      if (tempData.postText) {
        await this.handlePost(chatId, userId, tempData, userState);
      } else if (tempData.replyText) {
        await this.handleReply(chatId, userId, tempData, userState);
      } else {
        await this.sendAndTrack(chatId, '❌ No text provided. Start over with /post or /reply.');
        this.userStates.delete(userId);
        this.tempData.delete(userId);
      }
    });

    // Cancel command - cancel current operation
    this.bot.onText(/\/cancel/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const chatType = msg.chat.type;

      if (!this.isAuthorized(userId, chatId, chatType)) {
        return this.sendAndTrack(chatId, '❌ Access denied. You are not authorized to use this bot.');
      }

      const userState = this.userStates.get(userId);
      if (userState) {
        this.userStates.delete(userId);
        this.tempData.delete(userId);
        await this.sendAndTrack(chatId, '✅ Operation cancelled.');
      } else {
        await this.sendAndTrack(chatId, '❌ No active operation to cancel.');
      }
    });

    // AI chat command
    this.bot.onText(/\/ai/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const chatType = msg.chat.type;

      if (!this.isAuthorized(userId, chatId, chatType)) {
        return this.sendAndTrack(chatId, '❌ Access denied. You are not authorized to use this bot.');
      }

      if (!this.openRouterClient) {
        return this.sendAndTrack(chatId, '❌ AI features not configured. Please set OPENROUTER_API_KEY in .env file.');
      }

      // Check if there's text after /ai command
      const messageText = msg.text.replace('/ai', '').trim();
      if (messageText) {
        // Direct message after command
        this.handleAIMessage(chatId, userId, messageText);
      } else {
        // Wait for next message
        this.userStates.set(userId, { action: 'waiting_for_ai_message', chatId });
        await this.sendAndTrack(chatId, '🤖 *Send me your message for AI chat:*', { parse_mode: 'Markdown' });
      }
    });

    // Models command
    this.bot.onText(/\/models/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const chatType = msg.chat.type;

      if (!this.isAuthorized(userId, chatId, chatType)) {
        return this.sendAndTrack(chatId, '❌ Access denied. You are not authorized to use this bot.');
      }

      if (!this.openRouterClient) {
        return this.sendAndTrack(chatId, '❌ AI features not configured.');
      }

      const stats = this.openRouterClient.getModelStats();
      const updaterStats = this.modelUpdater ? this.modelUpdater.getStatus() : null;

      let message = `🤖 *AI Models Status*\n\n`;
      message += `📊 Available: ${stats.total} free models\n`;
      if (stats.blacklisted > 0) {
        message += `🚫 Blacklisted: ${stats.blacklisted} problematic models\n`;
      }

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

      // Show blacklisted models if any
      if (stats.blacklisted > 0) {
        message += `\n\n*🚫 Blacklisted Models:*`;
        stats.blacklistedModels.slice(0, 5).forEach((modelId, index) => {
          const modelName = modelId.split('/')[1]?.split(':')[0] || modelId;
          message += `\n${index + 1}. \`${modelName}\``;
        });
        if (stats.blacklisted > 5) {
          message += `\n...and ${stats.blacklisted - 5} more`;
        }
      }

      await this.sendAndTrack(chatId, message, { parse_mode: 'Markdown' });
    });

    // Update models command (admin only)
    this.bot.onText(/\/updatemodels/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      if (!this.isAdmin(userId)) {
        return this.sendAndTrack(chatId, '❌ Access denied. Only admins can update models.');
      }

      if (!this.modelUpdater) {
        return this.sendAndTrack(chatId, '❌ Model updater not configured.');
      }

      try {
        await this.sendAndTrack(chatId, '🔄 Updating AI models...', { parse_mode: 'Markdown' });
        const models = await this.modelUpdater.forceUpdate();
        await this.sendAndTrack(chatId, `✅ Successfully updated ${models.length} free AI models!`, { parse_mode: 'Markdown' });
      } catch (error) {
        await this.sendAndTrack(chatId, `❌ Failed to update models: ${error.message}`, { parse_mode: 'Markdown' });
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
    const chatType = msg.chat.type;
    const text = msg.text;

    // Check authorization for all interactions
    if (!this.isAuthorized(userId, chatId, chatType)) {
      return this.sendAndTrack(chatId, '❌ Access denied. You are not authorized to use this bot.');
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
        this.userStates.set(userId, { ...userState, action: 'waiting_for_image' });
        await this.sendAndTrack(chatId, '🖼️ *Got the text! Now send an image (optional) or send /done to post without image:*', { parse_mode: 'Markdown' });
        break;

      case 'waiting_for_tweet_id':
        tempData.tweetId = this.extractTweetId(text);
        if (!tempData.tweetId) {
          await this.sendAndTrack(chatId, '❌ Invalid tweet URL or ID. Please send a valid Twitter URL or tweet ID.');
          return;
        }

        if (userState.replyMode) {
          this.userStates.set(userId, { ...userState, action: 'waiting_for_reply_text' });
          await this.sendAndTrack(chatId, '💬 *Send me your reply text:*', { parse_mode: 'Markdown' });
        } else if (userState.retweetMode) {
          await this.handleRetweet(chatId, userId, tempData.tweetId, userState);
        } else if (userState.likeMode) {
          await this.handleLike(chatId, userId, tempData.tweetId, userState);
        }
        break;

      case 'waiting_for_reply_text':
        tempData.replyText = text;
        this.userStates.set(userId, { ...userState, action: 'waiting_for_image' });
        await this.sendAndTrack(chatId, '🖼️ *Got the reply! Send an image (optional) or send /done to reply without image:*', { parse_mode: 'Markdown' });
        break;

      case 'waiting_for_account_name':
        const accountName = text.replace(/[^a-zA-Z0-9_]/g, '');
        if (!accountName) {
          await this.sendAndTrack(chatId, '❌ Invalid account name. Please use only letters, numbers, and underscores.');
          return;
        }

        // Check for duplicate account names
        const existingAccounts = this.accountManager.getAccounts();
        const accountExists = existingAccounts.some(acc => acc.name.toLowerCase() === accountName.toLowerCase());

        // Also check for .env file on disk
        const accountsDir = path.join(__dirname, 'accounts');
        const envFilePath = path.join(accountsDir, `${accountName}.env`);
        const fileExists = fs.existsSync(envFilePath);

        if (accountExists || fileExists) {
          await this.sendAndTrack(chatId, `❌ Account "${accountName}" already exists! Please choose a different name.`, { parse_mode: 'Markdown' });
          return;
        }

        tempData.accountName = accountName;
        this.userStates.set(userId, { action: 'waiting_for_api_key', chatId });
        await this.sendAndTrack(chatId, `🔑 *Send me the API_KEY for ${tempData.accountName}:*`, { parse_mode: 'Markdown' });
        break;

      case 'waiting_for_api_key':
        tempData.apiKey = text.trim();
        this.userStates.set(userId, { action: 'waiting_for_api_secret', chatId });
        await this.sendAndTrack(chatId, '🔐 *Send me the API_SECRET:*', { parse_mode: 'Markdown' });
        break;

      case 'waiting_for_api_secret':
        tempData.apiSecret = text.trim();
        this.userStates.set(userId, { action: 'waiting_for_access_token', chatId });
        await this.sendAndTrack(chatId, '🔑 *Send me the ACCESS_TOKEN:*', { parse_mode: 'Markdown' });
        break;

      case 'waiting_for_access_token':
        tempData.accessToken = text.trim();
        this.userStates.set(userId, { action: 'waiting_for_access_secret', chatId });
        await this.sendAndTrack(chatId, '🔐 *Send me the ACCESS_SECRET:*', { parse_mode: 'Markdown' });
        break;

      case 'waiting_for_access_secret':
        tempData.accessSecret = text.trim();
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
    const chatType = msg.chat.type;

    // Check authorization
    if (!this.isAuthorized(userId, chatId, chatType)) {
      return this.sendAndTrack(chatId, '❌ Access denied. You are not authorized to use this bot.');
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

      await this.sendAndTrack(chatId, '🖼️ *Image received!* Processing...', { parse_mode: 'Markdown' });

      // Execute the pending action
      if (userState.action === 'waiting_for_image') {
        if (tempData.postText) {
          await this.handlePost(chatId, userId, tempData, userState);
        } else if (tempData.replyText) {
          await this.handleReply(chatId, userId, tempData, userState);
        }
      }
    } catch (error) {
      console.error('Error downloading image:', error);
      await this.sendAndTrack(chatId, '❌ Error processing image. Try again.');
    }
  }

  /**
   * Handle posting tweets
   */
  async handlePost(chatId, userId, data, userState = {}) {
    try {
      // Parse multiple tweets from text (separated by double newlines)
      const tweets = data.postText.split(/\n\s*\n/).map(t => t.trim()).filter(t => t.length > 0);

      if (tweets.length === 0) {
        await this.sendAndTrack(chatId, '❌ No valid tweets found.');
        return;
      }

      const specificAccount = data.specificAccount || userState.specificAccount;
      const processingMsg = specificAccount
        ? `📊 Processing ${tweets.length} tweet(s) for account: ${specificAccount}...`
        : `📊 Processing ${tweets.length} tweet(s)...`;

      await this.sendAndTrack(chatId, processingMsg);

      // If image provided, download it temporarily
      let imagePath = null;
      if (data.imageUrl) {
        imagePath = await this.downloadImage(data.imageUrl);
      }

      // Distribute posts across accounts
      const results = await this.postDistributor.distributePosts(tweets, {
        delay: 2000,
        imagePath: imagePath,
        maxAccounts: data.maxAccounts,
        specificAccount: specificAccount
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

      await this.sendAndTrack(chatId, resultMessage, { parse_mode: 'Markdown' });

      // Clean up
      if (imagePath) {
        fs.unlinkSync(imagePath);
      }
      this.userStates.delete(userId);
      this.tempData.delete(userId);

    } catch (error) {
      console.error('Post error:', error);
      await this.sendAndTrack(chatId, `❌ Error posting: ${error.message}`);
    }
  }

  /**
   * Handle replying to tweets
   */
  async handleReply(chatId, userId, data, userState = {}) {
    try {
      // Parse multiple replies
      const replies = data.replyText.split(/\n\s*\n/).map(r => r.trim()).filter(r => r.length > 0);

      if (replies.length === 0) {
        await this.sendAndTrack(chatId, '❌ No valid replies found.');
        return;
      }

      const specificAccount = data.specificAccount || userState.specificAccount;
      const processingMsg = specificAccount
        ? `💬 Processing ${replies.length} reply(ies) for account: ${specificAccount}...`
        : `💬 Processing ${replies.length} reply(ies)...`;

      await this.sendAndTrack(chatId, processingMsg);

      // If image provided, download it temporarily
      let imagePath = null;
      if (data.imageUrl) {
        imagePath = await this.downloadImage(data.imageUrl);
      }

      const results = await this.postDistributor.distributeReplies(data.tweetId, replies, {
        delay: 2000,
        imagePath: imagePath,
        maxAccounts: data.maxAccounts,
        specificAccount: specificAccount
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

      await this.sendAndTrack(chatId, resultMessage, { parse_mode: 'Markdown' });

      this.userStates.delete(userId);
      this.tempData.delete(userId);

    } catch (error) {
      console.error('Reply error:', error);
      await this.sendAndTrack(chatId, `❌ Error replying: ${error.message}`);
    }
  }

  /**
   * Handle retweeting
   */
  async handleRetweet(chatId, userId, tweetId, userState = {}) {
    try {
      const specificAccount = userState.specificAccount;
      const processingMsg = specificAccount
        ? `🔄 Retweeting from account: ${specificAccount}...`
        : '🔄 Retweeting...';

      await this.sendAndTrack(chatId, processingMsg);

      const results = await this.postDistributor.distributeRetweets(tweetId, {
        delay: 2000,
        maxAccounts: userState.maxAccounts,
        specificAccount: specificAccount
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

      await this.sendAndTrack(chatId, resultMessage, { parse_mode: 'Markdown' });

      this.userStates.delete(userId);
      this.tempData.delete(userId);

    } catch (error) {
      console.error('Retweet error:', error);
      await this.sendAndTrack(chatId, `❌ Error retweeting: ${error.message}`);
    }
  }

  /**
   * Handle liking tweets
   */
  async handleLike(chatId, userId, tweetId, userState = {}) {
    try {
      const specificAccount = userState.specificAccount;
      const processingMsg = specificAccount
        ? `❤️ Liking from account: ${specificAccount}...`
        : '❤️ Liking tweet...';

      await this.sendAndTrack(chatId, processingMsg);

      const results = await this.postDistributor.distributeLikes(tweetId, {
        delay: 2000,
        maxAccounts: userState.maxAccounts,
        specificAccount: specificAccount
      });

      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      let resultMessage = `✅ *Liked by ${successful.length} account(s)*\n\n`;

      successful.forEach(result => {
        resultMessage += `❤️ [${result.account}] Liked\n`;
      });

      if (failed.length > 0) {
        resultMessage += `\n❌ *Failed ${failed.length} like(s):*\n`;
        failed.forEach(result => {
          resultMessage += `❌ [${result.account}] ${result.error}\n`;
        });
      }

      await this.sendAndTrack(chatId, resultMessage, { parse_mode: 'Markdown' });

      this.userStates.delete(userId);
      this.tempData.delete(userId);

    } catch (error) {
      console.error('Like error:', error);
      await this.sendAndTrack(chatId, `❌ Error liking: ${error.message}`);
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

      await this.sendAndTrack(chatId, `⏳ *Validating credentials for "${data.accountName}"...*`, { parse_mode: 'Markdown' });

      // Reload accounts properly by creating new instance and initializing
      this.accountManager = new AccountManager();
      await this.accountManager.initialize();
      this.postDistributor = new PostDistributor(this.accountManager);

      // Check if the account was actually loaded (credentials validated)
      const loadedAccounts = this.accountManager.getAccounts();
      const wasLoaded = loadedAccounts.some(acc => acc.name === data.accountName);

      if (wasLoaded) {
        await this.sendAndTrack(chatId, `✅ *Account "${data.accountName}" added and validated successfully!*\n\n📋 Total accounts loaded: ${loadedAccounts.length}`, { parse_mode: 'Markdown' });
      } else {
        // Credentials failed validation, remove the file
        fs.unlinkSync(envFilePath);
        await this.sendAndTrack(chatId, `❌ *Failed to validate credentials for "${data.accountName}".*\n\nThe account file has been removed. Please check your API keys and try again.`, { parse_mode: 'Markdown' });
      }

      this.userStates.delete(userId);
      this.tempData.delete(userId);

    } catch (error) {
      console.error('Add account error:', error);
      await this.sendAndTrack(chatId, `❌ Error adding account: ${error.message}`);
      this.userStates.delete(userId);
      this.tempData.delete(userId);
    }
  }

  /**
   * Handle AI chat messages
   */
  async handleAIMessage(chatId, userId, message) {
    if (!this.openRouterClient) {
      return this.sendAndTrack(chatId, '❌ AI features not configured.');
    }

    try {
      // Send typing indicator
      this.bot.sendChatAction(chatId, 'typing');

      // Send initial response
      await this.sendAndTrack(chatId, '🤖 *Thinking...*', { parse_mode: 'Markdown' });

      // Get AI response with fallback logic
      const result = await this.openRouterClient.chat(message);

      // Send the AI response
      let responseMessage = `🤖 *AI Response (${result.model})*\n\n`;
      responseMessage += result.reply;

      // Truncate if too long for Telegram
      if (responseMessage.length > 4000) {
        responseMessage = responseMessage.substring(0, 4000) + '\n\n*...response truncated...*';
      }

      await this.sendAndTrack(chatId, responseMessage, { parse_mode: 'Markdown' });

      // Clean up user state
      this.userStates.delete(userId);

    } catch (error) {
      console.error('AI chat error:', error);
      await this.sendAndTrack(chatId, `❌ *AI Error:* ${error.message}`, { parse_mode: 'Markdown' });
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