#!/usr/bin/env node

import { OpenRouterClient } from './openRouterClient.js';
import { ModelUpdater } from './modelUpdater.js';

// Load configuration
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error('❌ OPENROUTER_API_KEY not found in .env file');
  console.log('📝 Please add your OpenRouter API key to .env file');
  process.exit(1);
}

// Initialize clients
const openRouterClient = new OpenRouterClient(apiKey);
const modelUpdater = new ModelUpdater(openRouterClient);

// Start the cron job (only scheduled updates, no immediate update)
modelUpdater.startCronJob();

// Keep the process running
console.log('🤖 AI Model Updater process started');
console.log('📅 Models will be updated every 6 hours');

// Keep the process alive
process.on('SIGINT', () => {
  console.log('🛑 AI Model Updater shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 AI Model Updater shutting down...');
  process.exit(0);
});

// Prevent the process from exiting
setInterval(() => {
  // Keep alive - check every 5 minutes
  console.log(`🤖 AI Updater still running... (${new Date().toISOString()})`);
}, 300000); // 5 minutes
