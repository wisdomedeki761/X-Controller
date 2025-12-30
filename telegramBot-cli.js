#!/usr/bin/env node

import { XRaiderTelegramBot } from './telegramBot.js';
import dotenv from 'dotenv';

// Load configuration
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in .env file');
  console.log('📝 Please:');
  console.log('1. Go to Telegram and search for @BotFather');
  console.log('2. Send /newbot and follow instructions');
  console.log('3. Add your token to .env file');
  process.exit(1);
}

// Check if accounts exist
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const accountsDir = path.join(__dirname, 'accounts');
if (!fs.existsSync(accountsDir) || fs.readdirSync(accountsDir).filter(f => f.endsWith('.env')).length === 0) {
  console.log('⚠️  No accounts found in accounts/ directory');
  console.log('📝 Use the Telegram bot to add accounts with /addaccount command');
}

// Check admin IDs
const adminIds = process.env.ADMIN_IDS;
if (!adminIds || adminIds.trim() === '') {
  console.error('❌ ADMIN_IDS not configured in .env file');
  console.log('📝 Please add your Telegram user ID(s) to ADMIN_IDS in .env');
  console.log('   Example: ADMIN_IDS=123456789,987654321');
  process.exit(1);
}

// Start the bot
const bot = new XRaiderTelegramBot(token);
bot.start();
