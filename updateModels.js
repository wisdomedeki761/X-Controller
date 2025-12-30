#!/usr/bin/env node

import dotenv from 'dotenv';
import { OpenRouterClient } from './openRouterClient.js';
import { ModelUpdater } from './modelUpdater.js';

// Load configuration
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

// Update models
console.log('🚀 Starting manual model update...');

modelUpdater.updateModels()
  .then((models) => {
    console.log(`✅ Successfully updated ${models.length} free models!`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Model update failed:', error.message);
    process.exit(1);
  });
