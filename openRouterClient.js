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

    // Ensure data directory exists
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Load cached models
    this.loadModels();
  }

  /**
   * Load models from cache file
   */
  loadModels() {
    try {
      if (fs.existsSync(this.modelsFile)) {
        const data = fs.readFileSync(this.modelsFile, 'utf8');
        this.models = JSON.parse(data);
        console.log(`✅ Loaded ${this.models.length} cached free models`);
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

      // Filter for free models (models with ":free" in the name)
      const freeModels = allModels.filter(model =>
        model.id && model.id.includes(':free')
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
      models: this.models.map(m => ({
        id: m.id,
        name: m.name,
        context_length: m.context_length
      }))
    };
  }
}
