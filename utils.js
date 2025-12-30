/**
 * Utility functions
 */

/**
 * Delays execution for specified milliseconds
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise}
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extracts tweet ID from Twitter URL
 * @param {string} url - Twitter URL
 * @returns {string|null} Tweet ID or null if invalid
 */
export function extractTweetId(url) {
  const match = url.match(/status[\/](\d+)/);
  return match ? match[1] : null;
}

/**
 * Validates tweet ID format
 * @param {string} tweetId - Tweet ID to validate
 * @returns {boolean}
 */
export function isValidTweetId(tweetId) {
  return /^\d+$/.test(tweetId);
}

