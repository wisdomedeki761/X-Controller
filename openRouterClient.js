import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * OpenRouter API Client for AI chat functionality
 */
export class OpenRouterClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://openrouter.ai/api/v1';
    this.modelsFile = path.join(__dirname, 'data', 'free-models.json');
    this.models = [];

    // Blacklist for problematic models that return empty responses
    this.blacklistedModels = [
      'allenai/olmo-3.1-32b-think:free', // AllenAI: Olmo 3.1 32B Think (free)
    ];

    // Ensure data directory exists
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Load cached models and blacklist
    this.loadModels();
    this.loadBlacklist();
  }

  /**
   * Load models from cache file
   */
  loadModels() {
    try {
      if (fs.existsSync(this.modelsFile)) {
        const data = fs.readFileSync(this.modelsFile, 'utf8');
        let cachedModels = JSON.parse(data);

        // Filter out blacklisted models
        cachedModels = cachedModels.filter(model => !this.blacklistedModels.includes(model.id));

        this.models = cachedModels;
        console.log(`✅ Loaded ${this.models.length} cached free models (filtered ${cachedModels.length - this.models.length} blacklisted)`);
      } else {
        console.log('⚠️  No cached models found, will fetch on first request');
      }
    } catch (error) {
      console.error('❌ Error loading cached models:', error.message);
      this.models = [];
    }
  }

  /**
   * Save models to cache file
   */
  saveModels() {
    try {
      fs.writeFileSync(this.modelsFile, JSON.stringify(this.models, null, 2));
      console.log(`💾 Saved ${this.models.length} models to cache`);
    } catch (error) {
      console.error('❌ Error saving models to cache:', error.message);
    }
  }

  /**
   * Fetch all available models from OpenRouter
   */
  async fetchAllModels() {
    try {
      const response = await axios.get(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.data || [];
    } catch (error) {
      console.error('❌ Error fetching models:', error.message);
      throw error;
    }
  }

  /**
   * Update free models cache
   */
  async updateFreeModels() {
    try {
      console.log('🔄 Fetching free models from OpenRouter...');
      const allModels = await this.fetchAllModels();

      // Filter for free models (models with ":free" in the name) and exclude blacklisted models
      const freeModels = allModels.filter(model =>
        model.id &&
        model.id.includes(':free') &&
        !this.blacklistedModels.includes(model.id)
      ).map(model => ({
        id: model.id,
        name: model.name || model.id,
        description: model.description || '',
        context_length: model.context_length || 4096,
        pricing: model.pricing || {}
      }));

      this.models = freeModels;
      this.saveModels();

      console.log(`✅ Updated ${freeModels.length} free models`);
      return freeModels;
    } catch (error) {
      console.error('❌ Error updating free models:', error.message);
      throw error;
    }
  }

  /**
   * Get all free models
   */
  getFreeModels() {
    return this.models;
  }

  /**
   * Add a model to the blacklist
   */
  blacklistModel(modelId) {
    if (!this.blacklistedModels.includes(modelId)) {
      this.blacklistedModels.push(modelId);
      console.log(`🚫 Blacklisted problematic model: ${modelId}`);

      // Remove from current models list if present
      this.models = this.models.filter(model => model.id !== modelId);

      // Save updated blacklist to models file (we'll store it as metadata)
      this.saveBlacklist();
    }
  }

  /**
   * Save blacklist to a separate file
   */
  saveBlacklist() {
    try {
      const blacklistFile = path.join(__dirname, 'data', 'blacklisted-models.json');
      fs.writeFileSync(blacklistFile, JSON.stringify(this.blacklistedModels, null, 2));
      console.log(`💾 Saved blacklist with ${this.blacklistedModels.length} models`);
    } catch (error) {
      console.error('❌ Error saving blacklist:', error.message);
    }
  }

  /**
   * Load blacklist from file
   */
  loadBlacklist() {
    try {
      const blacklistFile = path.join(__dirname, 'data', 'blacklisted-models.json');
      if (fs.existsSync(blacklistFile)) {
        const data = fs.readFileSync(blacklistFile, 'utf8');
        const savedBlacklist = JSON.parse(data);
        // Merge with default blacklist
        this.blacklistedModels = [...new Set([...this.blacklistedModels, ...savedBlacklist])];
        console.log(`✅ Loaded ${savedBlacklist.length} additional blacklisted models`);
      }
    } catch (error) {
      console.error('❌ Error loading blacklist:', error.message);
    }
  }

  /**
   * Chat with AI using fallback logic
   */
  async chat(message, maxRetries = 3) {
    if (this.models.length === 0) {
      throw new Error('No free models available. Please update models first.');
    }

    let lastError = null;

    // Try each model in sequence until one succeeds
    for (let i = 0; i < Math.min(maxRetries, this.models.length); i++) {
      const model = this.models[i];

      try {
        console.log(`🤖 Trying model: ${model.name} (${model.id})`);

        const response = await axios.post(`${this.baseURL}/chat/completions`, {
          model: model.id,
          messages: [
            {
              role: 'user',
              content: message
            }
          ],
          max_tokens: 1000,
          temperature: 0.7
        }, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        });

        if (response.data && response.data.choices && response.data.choices[0]) {
          const reply = response.data.choices[0].message.content;

          // Check if response is empty or just whitespace
          if (!reply || reply.trim().length === 0) {
            console.log(`🚫 Model ${model.name} returned empty response, blacklisting...`);
            this.blacklistModel(model.id);
            continue; // Try next model
          }

          console.log(`✅ Success with model: ${model.name}`);
          return {
            success: true,
            model: model.name,
            modelId: model.id,
            reply: reply,
            usage: response.data.usage || {}
          };
        }

      } catch (error) {
        lastError = error;
        console.log(`❌ Failed with model ${model.name}: ${error.message}`);

        // Continue to next model if this one failed
        continue;
      }
    }

    // All models failed
    throw new Error(`All ${Math.min(maxRetries, this.models.length)} models failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Get model statistics
   */
  getModelStats() {
    return {
      total: this.models.length,
      blacklisted: this.blacklistedModels.length,
      models: this.models.map(m => ({
        id: m.id,
        name: m.name,
        context_length: m.context_length
      })),
      blacklistedModels: this.blacklistedModels
    };
  }
}
