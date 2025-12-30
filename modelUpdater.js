import cron from 'node-cron';
import { OpenRouterClient } from './openRouterClient.js';

/**
 * Model Updater - Fetches and caches free OpenRouter models
 */
export class ModelUpdater {
  constructor(openRouterClient) {
    this.client = openRouterClient;
    this.isRunning = false;
  }

  /**
   * Start the cron job to update models every 6 hours (no immediate update)
   */
  startCronJob() {
    // Update models every 6 hours at specific minutes past the hour
    // Use minutes 15 to avoid running immediately on startup
    cron.schedule('15 */6 * * *', async () => {
      console.log('🕐 Scheduled model update starting...');
      await this.updateModels();
    });

    console.log('⏰ Model updater cron job started (updates every 6 hours at :15 past the hour)');
    console.log('📅 Next update will run at the next HH:15 time');
  }

  /**
   * Manually update models
   */
  async updateModels() {
    if (this.isRunning) {
      console.log('⚠️  Model update already in progress, skipping...');
      return;
    }

    this.isRunning = true;

    try {
      const models = await this.client.updateFreeModels();
      console.log(`✅ Successfully updated ${models.length} free models`);
      return models;
    } catch (error) {
      console.error('❌ Model update failed:', error.message);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Force immediate update
   */
  async forceUpdate() {
    console.log('🔄 Forcing immediate model update...');
    return await this.updateModels();
  }

  /**
   * Get update status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      nextUpdate: 'Every 6 hours at HH:00',
      modelCount: this.client.getFreeModels().length
    };
  }
}
