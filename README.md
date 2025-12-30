# X-Raider - Multi-Account X (Twitter) Bot with AI Integration

A powerful tool to manage multiple X (Twitter) accounts with intelligent post distribution, Telegram bot control, and AI chat capabilities using OpenRouter's free models.

## Features

### Core Features
- ✅ **Multi-Account Management** - Control multiple X accounts from terminal or Telegram
- ✅ **Smart Post Distribution** - Automatically distributes posts across accounts
- ✅ **Telegram Bot Control** - Full bot management through Telegram chat
- ✅ **Admin Authentication** - Secure access with admin-only permissions
- ✅ **Rate Limit Safe** - Built-in delays to prevent rate limiting
- ✅ **Compliant** - Uses official X API v2 (Free Tier)

### AI Integration
- 🤖 **AI Chat** - Chat with free AI models through OpenRouter API
- 🔄 **Automatic Fallback** - If one AI model fails, tries the next automatically
- 📊 **Model Management** - Automatic discovery and caching of free models
- ⏰ **Cron Updates** - Models update every 6 hours automatically
- 💾 **Offline Cache** - Models stored locally for reliability

## Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Set up your accounts:**
   - Create an `accounts` directory in the project root
   - Add a `.env` file for each account (e.g., `account1.env`, `account2.env`, etc.)

3. **Configure each account .env file:**
```env
API_KEY=your_api_key_here
API_SECRET=your_api_secret_here
ACCESS_TOKEN=your_access_token_here
ACCESS_SECRET=your_access_token_secret_here
```

**Note:** The bot supports both naming conventions:
- `API_KEY` / `API_SECRET` / `ACCESS_TOKEN` / `ACCESS_SECRET` (recommended)
- `API_Key` / `API_Key_Secret` / `Access_Token` / `Access_Token_Secret` (legacy)

4. **Set up main configuration (.env):**
```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Admin IDs (comma-separated list of Telegram user IDs)
ADMIN_IDS=your_telegram_user_id_here

# OpenRouter AI Configuration (optional)
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

## Getting X API Credentials

1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Create a new app or use an existing one
3. Generate credentials:
   - API Key
   - API Secret
   - Access Token
   - Access Token Secret

See `plan.md` for detailed instructions.

## Quick Start

1. **Basic Setup:**
```bash
npm install
# Add Twitter accounts to accounts/ directory
# Configure .env with Telegram bot token and admin IDs
```

2. **Test CLI:**
```bash
node bot.js accounts  # Should list your accounts
```

3. **Start with PM2 (Production):**
```bash
# Install PM2 globally
npm install -g pm2

# Start the bot
npm run pm2:start

# Check status
npm run pm2:status

# View logs
npm run pm2:logs
```

4. **Chat with AI (optional):**
```bash
# Add OpenRouter API key to .env
npm run updatemodels  # Fetch AI models
# Use /ai command in Telegram
```

## Telegram Bot Setup

### 1. Create Telegram Bot
1. Message `@BotFather` on Telegram
2. Send `/newbot` and follow instructions
3. Copy the **API Token** you receive
4. Add it to `.env` as `TELEGRAM_BOT_TOKEN`

### 2. Configure Admin Access
1. Message `@userinfobot` on Telegram and send `/start`
2. Copy your **user ID** from the response
3. Add it to `.env` as `ADMIN_IDS=your_user_id_here`
4. For multiple admins: `ADMIN_IDS=id1,id2,id3`

### 3. Start Telegram Bot
```bash
npm run telegram
```

**Note:** Only users in `ADMIN_IDS` can use the bot.

## AI Integration Setup (Optional)

### 1. Get OpenRouter API Key
1. Visit: https://openrouter.ai/
2. Sign up for a free account
3. Create an API key
4. Add to `.env` as `OPENROUTER_API_KEY`

### 2. Update AI Models
```bash
npm run updatemodels
```

This fetches all free models and caches them locally.

## Usage

### List Accounts
```bash
node bot.js accounts
```

### Post Tweets

**Single post:**
```bash
node bot.js post --text "Hello from X-Raider!"
```

**Multiple posts from file:**
```bash
node bot.js post --file posts.txt
```

**With custom delay (default: 2000ms):**
```bash
node bot.js post --text "Hello!" --delay 3000
```

**Example posts.txt:**
```
First post content here
Second post content here
Third post content here
```

The bot will distribute posts across all accounts. For example:
- 10 accounts, 3 posts → Each account posts 1 unique post
- 3 accounts, 10 posts → Each account posts multiple posts

### Retweet

**Using tweet ID:**
```bash
node bot.js retweet --id 1234567890123456789
```

**Using Twitter URL:**
```bash
node bot.js retweet --id "https://twitter.com/username/status/1234567890123456789"
```

**With custom delay:**
```bash
node bot.js retweet --id 1234567890123456789 --delay 3000
```

### Reply to Tweet

**Single reply:**
```bash
node bot.js reply --id 1234567890123456789 --text "Great post! 👀"
```

**Multiple replies from file:**
```bash
node bot.js reply --id 1234567890123456789 --file replies.txt
```

**Using Twitter URL:**
```bash
node bot.js reply --id "https://twitter.com/username/status/1234567890123456789" --text "Nice!"
```

## Examples

### Example 1: Post 3 tweets across 10 accounts
```bash
# Create posts.txt with 3 posts
echo "Post 1" > posts.txt
echo "Post 2" >> posts.txt
echo "Post 3" >> posts.txt

# Post them
node bot.js post --file posts.txt
```

Result: Each of the 10 accounts will post 1 of the 3 posts (3 accounts post, 7 don't).

### Example 2: Retweet a viral tweet
```bash
node bot.js retweet --id "https://twitter.com/elonmusk/status/1234567890123456789"
```

Result: All accounts will retweet the specified tweet.

### Example 3: Reply to an influencer's tweet
```bash
# Create replies.txt
echo "Great insight!" > replies.txt
echo "Thanks for sharing!" >> replies.txt
echo "This is helpful 👀" >> replies.txt

# Reply
node bot.js reply --id 1234567890123456789 --file replies.txt
```

Result: Replies will be distributed across accounts.

## Telegram Bot Commands

**Available Commands:**
- `/start` - Welcome message and help
- `/accounts` - List all configured accounts
- `/post` - Create posts (uses all accounts)
- `/post5` - Create posts (uses 5 accounts)
- `/post3` - Create posts (uses 3 accounts)
- `/reply` - Reply to tweets (uses all accounts)
- `/reply2` - Reply to tweets (uses 2 accounts)
- `/retweet` - Retweet tweets (uses all accounts)
- `/retweet1` - Retweet tweets (uses 1 account)
- `/addaccount` - Add new accounts
- `/ai` - Chat with AI (if configured)
- `/models` - List available AI models
- `/updatemodels` - Force update AI models
- `/help` - Show detailed help

**Account Control:** Add **any number** after any command to limit accounts used:
- `/post` = all accounts, `/post5` = 5 accounts, `/post1` = 1 account, `/post11` = 11 accounts
- `/reply` = all accounts, `/reply3` = 3 accounts, `/reply7` = 7 accounts
- `/retweet` = all accounts, `/retweet2` = 2 accounts, `/retweet99` = 99 accounts

*If the number exceeds your available accounts, it uses all accounts automatically.*

### AI Chat Examples

**Direct chat:**
```
/ai What is the capital of France?
```

**Separate commands:**
```
/ai
[then send your message]
```

**Result:** Bot tries free AI models in sequence until one succeeds.

### Multi-Post Example (Telegram)
```
/post

Excited about our new product! 🚀

Check out these amazing features

What do you think?

[attach product image]
```

**Result:** Each account posts one unique tweet with the image.

## Rate Limits

X API Free Tier allows:
- **500 posts per month** per account
- Includes: tweets, retweets, replies

**Best Practices:**
- Use delays between actions (default: 2 seconds)
- Don't spam or mass-reply to the same tweet
- Vary your content
- Space out your posts

## Project Structure

```
X-raider/
├── accounts/              # X account .env files
│   ├── account1.env
│   ├── account2.env
│   └── ...
├── data/                  # AI model cache
│   └── free-models.json
├── temp/                  # Temporary image storage
├── logs/                  # PM2 log files
├── data/                  # AI model cache
├── bot.js                 # Main CLI entry point
├── accountManager.js      # Account loading and management
├── postDistributor.js     # Post distribution logic
├── telegramBot.js         # Telegram bot class
├── telegramBot-cli.js     # Telegram bot CLI runner
├── openRouterClient.js    # OpenRouter AI client
├── modelUpdater.js        # AI model update cron job
├── updateModels.js        # Manual model update script
├── ecosystem.config.js    # PM2 process configuration
├── utils.js               # Utility functions
├── .env                   # Main configuration
├── package.json
├── plan.md                # X API setup guide
├── README.md
├── AI_INTEGRATION_README.md    # AI features documentation
├── TELEGRAM_BOT_README.md      # Telegram bot documentation
├── PM2_SETUP_GUIDE.md          # PM2 deployment guide
├── LINUX_DEPLOYMENT.md         # Linux VPS deployment guide
├── x-raider.service            # Systemd service file (alternative)
└── deploy.sh                   # Automated deployment script
```

## Troubleshooting

### Twitter/X API Issues

#### "No accounts loaded"
- Make sure you created the `accounts` directory
- Ensure your `.env` files are in the `accounts` directory
- Check that your `.env` files have all required credentials

#### "Invalid credentials" / 401 Unauthorized
- Verify your API keys are correct
- Make sure you're using the right credentials for each account
- Check that your app has Read and Write permissions

#### 403 Forbidden Error
- Your Twitter app needs "Read and Write" permissions
- Regenerate Access Token and Secret after changing permissions
- See `FIX_403_ERROR.md` for detailed steps

#### Rate limit errors
- Increase the delay between actions: `--delay 5000`
- Reduce the number of actions per session
- Wait before trying again

### Telegram Bot Issues

#### "ADMIN_IDS not configured"
- Add your Telegram user ID to `.env` as `ADMIN_IDS=your_id`
- Get your ID by messaging `@userinfobot` on Telegram

#### "TELEGRAM_BOT_TOKEN not found"
- Create a bot with `@BotFather` on Telegram
- Add the token to `.env` as `TELEGRAM_BOT_TOKEN`

#### "409 Conflict" error
- Only one bot instance can run at a time
- Stop other instances before starting a new one

#### "Access denied" in Telegram
- Your Telegram user ID is not in `ADMIN_IDS`
- Add your ID to the admin list in `.env`

### AI Integration Issues

#### "AI features not configured"
- Add `OPENROUTER_API_KEY=your_key` to `.env`
- Get the key from https://openrouter.ai/

#### "No free models available"
- Run `npm run updatemodels` to fetch models
- Check your internet connection
- Verify OpenRouter API key is valid

#### AI responses failing
- Free models can be temporarily unavailable
- Bot automatically tries the next model
- Check OpenRouter status or try again later

#### Model update fails
- Verify your OpenRouter API key
- Check internet connection
- Models update automatically every 6 hours

## Linux VPS Deployment

### Automated Deployment
```bash
# On your Linux VPS
git clone <your-repo-url>
cd x-raider

# Configure environment
nano .env  # Add your tokens and admin IDs

# Run automated deployment
chmod +x deploy.sh
./deploy.sh
```

### Manual PM2 Deployment
```bash
# Install PM2 globally
npm install -g pm2

# Start all services
npm run pm2:start

# Set up auto-startup on boot
sudo pm2 startup systemd -u $USER --hp $HOME
pm2 save

# Check status
npm run pm2:status

# View logs
npm run pm2:logs
```

### PM2 Management
```bash
npm run pm2:stop     # Stop all processes
npm run pm2:restart  # Restart all processes
npm run pm2:delete   # Stop and remove all processes
pm2 monit            # Real-time monitoring
```

## Available Scripts

```bash
# Install dependencies
npm install

# CLI Commands
npm run start           # Interactive CLI menu
node bot.js accounts    # List accounts
node bot.js post        # Post tweets
node bot.js retweet     # Retweet
node bot.js reply       # Reply to tweets

# Telegram Bot
npm run telegram        # Start Telegram bot (development)

# AI Model Management
npm run updatemodels    # Update AI models manually

# PM2 Production Management
npm run pm2:start       # Start all PM2 processes
npm run pm2:stop        # Stop all PM2 processes
npm run pm2:restart     # Restart all PM2 processes
npm run pm2:delete      # Remove all PM2 processes
npm run pm2:status      # Show PM2 process status
npm run pm2:logs        # Show all PM2 logs
npm run pm2:monit       # Open PM2 monitoring interface
```

## Documentation

- `AI_INTEGRATION_README.md` - Detailed AI integration guide
- `TELEGRAM_BOT_README.md` - Telegram bot documentation
- `plan.md` - X API setup guide
- `TROUBLESHOOTING.md` - Additional troubleshooting
- `FIX_403_ERROR.md` - OAuth permission fixes

## License

MIT

## Disclaimer

This tool is for legitimate automation purposes only. Follow X's Terms of Service and API usage policies. Do not use for spam, harassment, or coordinated manipulation.

**AI Usage:** OpenRouter provides access to various AI models. Ensure your usage complies with each model's terms of service and OpenRouter's policies.

