import { delay } from "./utils.js";

/**
 * Distributes posts across multiple accounts intelligently
 */
export class PostDistributor {
  constructor(accountManager) {
    this.accountManager = accountManager;
  }

  /**
   * Distributes posts across accounts
   * Each account posts one unique post from the list
   * 
   * @param {string[]} posts - Array of post texts
   * @param {Object} options - Options for posting
   * @returns {Promise<Array>} Results of all posts
   */
  async distributePosts(posts, options = {}) {
    const accounts = this.accountManager.getAccounts();
    const delayBetweenPosts = options.delay || 2000; // 2 seconds default
    const results = [];

    if (accounts.length === 0) {
      throw new Error("No accounts loaded. Please add account .env files to the 'accounts' directory.");
    }

    if (posts.length === 0) {
      throw new Error("No posts provided.");
    }

    console.log(`\n📊 Distributing ${posts.length} post(s) across ${accounts.length} account(s)...\n`);

    // Distribute posts: each account gets one post
    // If more posts than accounts, some accounts will post multiple times
    // If more accounts than posts, some accounts won't post
    const postsPerAccount = Math.ceil(posts.length / accounts.length);
    
    let postIndex = 0;
    
    for (let i = 0; i < accounts.length && postIndex < posts.length; i++) {
      const account = accounts[i];
      const postsForThisAccount = Math.min(
        postsPerAccount,
        posts.length - postIndex
      );

      for (let j = 0; j < postsForThisAccount && postIndex < posts.length; j++) {
        const postText = posts[postIndex];
        
        try {
          console.log(`📝 [${account.name}] Posting: "${postText.substring(0, 50)}${postText.length > 50 ? '...' : ''}"`);
          
          const result = await account.client.v2.tweet({
            text: postText,
          });

          results.push({
            success: true,
            account: account.name,
            post: postText,
            tweetId: result.data.id,
            tweetUrl: `https://twitter.com/${result.data.username}/status/${result.data.id}`
          });

          console.log(`✅ [${account.name}] Posted successfully: ${result.data.id}\n`);

          // Delay between posts to avoid rate limiting
          if (postIndex < posts.length - 1) {
            await delay(delayBetweenPosts);
          }
        } catch (error) {
          let errorMessage = error.message;
          
          // Provide more helpful error messages
          if (error.code === 403 || error.message.includes("403")) {
            errorMessage = "403 Forbidden - Check: 1) App has Read & Write permissions, 2) Credentials are correct, 3) Account is not suspended";
          } else if (error.code === 401 || error.message.includes("401")) {
            errorMessage = "401 Unauthorized - Invalid credentials. Check your API keys and tokens.";
          } else if (error.code === 429 || error.message.includes("429")) {
            errorMessage = "429 Rate Limit - Too many requests. Wait before trying again.";
          }
          
          console.error(`❌ [${account.name}] Failed to post:`, errorMessage);
          if (error.data) {
            console.error(`   Details:`, JSON.stringify(error.data, null, 2));
          }
          
          results.push({
            success: false,
            account: account.name,
            post: postText,
            error: errorMessage,
            errorCode: error.code
          });
        }

        postIndex++;
      }
    }

    return results;
  }

  /**
   * Distributes retweets across accounts
   * 
   * @param {string} tweetId - Tweet ID to retweet
   * @param {Object} options - Options for retweeting
   * @returns {Promise<Array>} Results of all retweets
   */
  async distributeRetweets(tweetId, options = {}) {
    const accounts = this.accountManager.getAccounts();
    const delayBetweenRetweets = options.delay || 2000;
    const results = [];

    if (accounts.length === 0) {
      throw new Error("No accounts loaded.");
    }

    console.log(`\n🔄 Retweeting ${tweetId} across ${accounts.length} account(s)...\n`);

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];

      try {
        console.log(`🔄 [${account.name}] Retweeting...`);
        
        // Get user ID first (consumes 1 read)
        const me = await account.client.v2.me();
        const result = await account.client.v2.retweet(me.data.id, tweetId);

        results.push({
          success: true,
          account: account.name,
          tweetId: tweetId,
          retweetId: result.data.retweeted
        });

        console.log(`✅ [${account.name}] Retweeted successfully\n`);

        // Delay between retweets
        if (i < accounts.length - 1) {
          await delay(delayBetweenRetweets);
        }
      } catch (error) {
        let errorMessage = error.message;
        
        if (error.code === 403 || error.message.includes("403")) {
          errorMessage = "403 Forbidden - Check app permissions and credentials";
        } else if (error.code === 401 || error.message.includes("401")) {
          errorMessage = "401 Unauthorized - Invalid credentials";
        } else if (error.code === 429 || error.message.includes("429")) {
          errorMessage = "429 Rate Limit - Wait before trying again";
        }
        
        console.error(`❌ [${account.name}] Failed to retweet:`, errorMessage);
        results.push({
          success: false,
          account: account.name,
          tweetId: tweetId,
          error: errorMessage,
          errorCode: error.code
        });
      }
    }

    return results;
  }

  /**
   * Distributes replies across accounts
   * 
   * @param {string} tweetId - Tweet ID to reply to
   * @param {string[]} replies - Array of reply texts
   * @param {Object} options - Options for replying
   * @returns {Promise<Array>} Results of all replies
   */
  async distributeReplies(tweetId, replies, options = {}) {
    const accounts = this.accountManager.getAccounts();
    const delayBetweenReplies = options.delay || 2000;
    const results = [];

    if (accounts.length === 0) {
      throw new Error("No accounts loaded.");
    }

    if (replies.length === 0) {
      throw new Error("No replies provided.");
    }

    console.log(`\n💬 Replying to ${tweetId} with ${replies.length} reply(ies) across ${accounts.length} account(s)...\n`);

    // Distribute replies similar to posts
    const repliesPerAccount = Math.ceil(replies.length / accounts.length);
    let replyIndex = 0;

    for (let i = 0; i < accounts.length && replyIndex < replies.length; i++) {
      const account = accounts[i];
      const repliesForThisAccount = Math.min(
        repliesPerAccount,
        replies.length - replyIndex
      );

      for (let j = 0; j < repliesForThisAccount && replyIndex < replies.length; j++) {
        const replyText = replies[replyIndex];

        try {
          console.log(`💬 [${account.name}] Replying: "${replyText.substring(0, 50)}${replyText.length > 50 ? '...' : ''}"`);
          
          const result = await account.client.v2.tweet({
            text: replyText,
            reply: { in_reply_to_tweet_id: tweetId },
          });

          results.push({
            success: true,
            account: account.name,
            reply: replyText,
            tweetId: result.data.id,
            replyTo: tweetId,
            tweetUrl: `https://twitter.com/${result.data.username}/status/${result.data.id}`
          });

          console.log(`✅ [${account.name}] Replied successfully: ${result.data.id}\n`);

          // Delay between replies
          if (replyIndex < replies.length - 1) {
            await delay(delayBetweenReplies);
          }
        } catch (error) {
          let errorMessage = error.message;
          
          if (error.code === 403 || error.message.includes("403")) {
            errorMessage = "403 Forbidden - Check app permissions and credentials";
          } else if (error.code === 401 || error.message.includes("401")) {
            errorMessage = "401 Unauthorized - Invalid credentials";
          } else if (error.code === 429 || error.message.includes("429")) {
            errorMessage = "429 Rate Limit - Wait before trying again";
          }
          
          console.error(`❌ [${account.name}] Failed to reply:`, errorMessage);
          results.push({
            success: false,
            account: account.name,
            reply: replyText,
            replyTo: tweetId,
            error: errorMessage,
            errorCode: error.code
          });
        }

        replyIndex++;
      }
    }

    return results;
  }
}

