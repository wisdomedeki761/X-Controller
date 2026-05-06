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
   * @param {string} options.imagePath - Optional path to image file to attach to all posts
   * @param {number} options.maxAccounts - Maximum number of accounts to use (default: all)
   * @param {string} options.specificAccount - Optional specific account name to use (overrides maxAccounts)
   * @returns {Promise<Array>} Results of all posts
   */
  async distributePosts(posts, options = {}) {
    const allAccounts = this.accountManager.getAccounts();
    const delayBetweenPosts = options.delay || 2000; // 2 seconds default
    const imagePath = options.imagePath;
    const specificAccountName = options.specificAccount;

    let accounts;
    if (specificAccountName) {
      // Use only the specific account
      const specificAccount = allAccounts.find(acc => acc.name.toLowerCase() === specificAccountName.toLowerCase());
      if (!specificAccount) {
        throw new Error(`Account "${specificAccountName}" not found.`);
      }
      accounts = [specificAccount];
    } else {
      const maxAccounts = options.maxAccounts || allAccounts.length;
      accounts = allAccounts.slice(0, maxAccounts);
    }

    const results = [];

    if (accounts.length === 0) {
      throw new Error("No accounts loaded. Please add account .env files to the 'accounts' directory.");
    }

    if (posts.length === 0) {
      throw new Error("No posts provided.");
    }

    console.log(`\n📊 Distributing ${posts.length} post(s) across ${accounts.length} account(s)...${imagePath ? ' with image' : ''}\n`);

    // If image provided, upload it once and get media ID
    let mediaId = null;
    if (imagePath) {
      try {
        console.log('🖼️  Uploading image...');
        // Use the first account to upload the image (they all have the same upload permissions)
        mediaId = await accounts[0].client.v1.uploadMedia(imagePath, { mimeType: this.getMimeType(imagePath) });
        console.log(`✅ Image uploaded successfully: ${mediaId}`);
      } catch (error) {
        console.error('❌ Failed to upload image:', error.message);
        throw new Error(`Image upload failed: ${error.message}`);
      }
    }

    // Handle posting logic
    if (posts.length === 1) {
      // Broadcast mode: all accounts post the same content
      const postText = posts[0];

      for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];

        try {
          console.log(`📝 [${account.name}] Posting: "${postText.substring(0, 50)}${postText.length > 50 ? '...' : ''}"${mediaId ? ' with image' : ''}`);

          // Prepare tweet data
          const tweetData = {
            text: postText,
          };

          // Add media if available
          if (mediaId) {
            tweetData.media = { media_ids: [mediaId] };
          }

          const result = await account.client.v2.tweet(tweetData);

          results.push({
            success: true,
            account: account.name,
            post: postText,
            tweetId: result.data.id,
            tweetUrl: `https://twitter.com/${result.data.username}/status/${result.data.id}`
          });

          console.log(`✅ [${account.name}] Posted successfully: ${result.data.id}\n`);

          // Delay between posts to avoid rate limiting
          if (i < accounts.length - 1) {
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
      }
    } else {
      // Distribute mode
      if (posts.length < accounts.length) {
        // Cycle through posts when more accounts than tweets
        for (let i = 0; i < accounts.length; i++) {
          const account = accounts[i];
          const postText = posts[i % posts.length]; // Cycle through available posts

          try {
            console.log(`📝 [${account.name}] Posting: "${postText.substring(0, 50)}${postText.length > 50 ? '...' : ''}"${mediaId ? ' with image' : ''}`);

            // Prepare tweet data
            const tweetData = {
              text: postText,
            };

            // Add media if available
            if (mediaId) {
              tweetData.media = { media_ids: [mediaId] };
            }

            const result = await account.client.v2.tweet(tweetData);

            results.push({
              success: true,
              account: account.name,
              post: postText,
              tweetId: result.data.id,
              tweetUrl: `https://twitter.com/${result.data.username}/status/${result.data.id}`
            });

            console.log(`✅ [${account.name}] Posted successfully: ${result.data.id}\n`);

            // Delay between posts to avoid rate limiting
            if (i < accounts.length - 1) {
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
        }
      } else {
        // Standard distribution: some accounts may post multiple times
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
              console.log(`📝 [${account.name}] Posting: "${postText.substring(0, 50)}${postText.length > 50 ? '...' : ''}"${mediaId ? ' with image' : ''}`);

              // Prepare tweet data
              const tweetData = {
                text: postText,
              };

              // Add media if available
              if (mediaId) {
                tweetData.media = { media_ids: [mediaId] };
              }

              const result = await account.client.v2.tweet(tweetData);

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
      }
    }

    return results;
  }

  /**
   * Distributes retweets across accounts
   *
   * @param {string} tweetId - Tweet ID to retweet
   * @param {Object} options - Options for retweeting
   * @param {number} options.maxAccounts - Maximum number of accounts to use (default: all)
   * @param {string} options.specificAccount - Optional specific account name to use (overrides maxAccounts)
   * @returns {Promise<Array>} Results of all retweets
   */
  async distributeRetweets(tweetId, options = {}) {
    const allAccounts = this.accountManager.getAccounts();
    const delayBetweenRetweets = options.delay || 2000;
    const specificAccountName = options.specificAccount;

    let accounts;
    if (specificAccountName) {
      const specificAccount = allAccounts.find(acc => acc.name.toLowerCase() === specificAccountName.toLowerCase());
      if (!specificAccount) {
        throw new Error(`Account "${specificAccountName}" not found.`);
      }
      accounts = [specificAccount];
    } else {
      const maxAccounts = options.maxAccounts || allAccounts.length;
      accounts = allAccounts.slice(0, maxAccounts);
    }

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
   * Distributes likes across accounts
   *
   * @param {string} tweetId - Tweet ID to like
   * @param {Object} options - Options for liking
   * @param {number} options.maxAccounts - Maximum number of accounts to use (default: all)
   * @param {string} options.specificAccount - Optional specific account name to use (overrides maxAccounts)
   * @returns {Promise<Array>} Results of all likes
   */
  async distributeLikes(tweetId, options = {}) {
    const allAccounts = this.accountManager.getAccounts();
    const delayBetweenLikes = options.delay || 2000;
    const specificAccountName = options.specificAccount;

    let accounts;
    if (specificAccountName) {
      const specificAccount = allAccounts.find(acc => acc.name.toLowerCase() === specificAccountName.toLowerCase());
      if (!specificAccount) {
        throw new Error(`Account "${specificAccountName}" not found.`);
      }
      accounts = [specificAccount];
    } else {
      const maxAccounts = options.maxAccounts || allAccounts.length;
      accounts = allAccounts.slice(0, maxAccounts);
    }

    const results = [];

    if (accounts.length === 0) {
      throw new Error("No accounts loaded.");
    }

    console.log(`\n❤️ Liking ${tweetId} across ${accounts.length} account(s)...\n`);

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];

      try {
        console.log(`❤️ [${account.name}] Liking...`);

        // Get user ID first
        const me = await account.client.v2.me();
        await account.client.v2.like(me.data.id, tweetId);

        results.push({
          success: true,
          account: account.name,
          tweetId: tweetId
        });

        console.log(`✅ [${account.name}] Liked successfully\n`);

        // Delay between likes
        if (i < accounts.length - 1) {
          await delay(delayBetweenLikes);
        }
      } catch (error) {
        let errorMessage = error.message;

        if (error.code === 403 || error.message.includes("403")) {
          errorMessage = "403 Forbidden - Check app permissions and credentials";
        } else if (error.code === 401 || error.message.includes("401")) {
          errorMessage = "401 Unauthorized - Invalid credentials";
        } else if (error.code === 429 || error.message.includes("429")) {
          errorMessage = "429 Rate Limit - Wait before trying again";
        } else if (error.message.includes("already liked")) {
          errorMessage = "Already liked this tweet";
        }

        console.error(`❌ [${account.name}] Failed to like:`, errorMessage);
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
   * @param {string} options.imagePath - Optional path to image file to attach to all replies
   * @param {number} options.maxAccounts - Maximum number of accounts to use (default: all)
   * @param {string} options.specificAccount - Optional specific account name to use (overrides maxAccounts)
   * @returns {Promise<Array>} Results of all replies
   */
  async distributeReplies(tweetId, replies, options = {}) {
    const allAccounts = this.accountManager.getAccounts();
    const delayBetweenReplies = options.delay || 2000;
    const imagePath = options.imagePath;
    const specificAccountName = options.specificAccount;

    let accounts;
    if (specificAccountName) {
      const specificAccount = allAccounts.find(acc => acc.name.toLowerCase() === specificAccountName.toLowerCase());
      if (!specificAccount) {
        throw new Error(`Account "${specificAccountName}" not found.`);
      }
      accounts = [specificAccount];
    } else {
      const maxAccounts = options.maxAccounts || allAccounts.length;
      accounts = allAccounts.slice(0, maxAccounts);
    }

    const results = [];

    if (accounts.length === 0) {
      throw new Error("No accounts loaded.");
    }

    if (replies.length === 0) {
      throw new Error("No replies provided.");
    }

    console.log(`\n💬 Replying to ${tweetId} with ${replies.length} reply(ies) across ${accounts.length} account(s)...${imagePath ? ' with image' : ''}\n`);

    // If image provided, upload it once and get media ID
    let mediaId = null;
    if (imagePath) {
      try {
        console.log('🖼️  Uploading image for replies...');
        // Use the first account to upload the image
        mediaId = await accounts[0].client.v1.uploadMedia(imagePath, { mimeType: this.getMimeType(imagePath) });
        console.log(`✅ Image uploaded successfully: ${mediaId}`);
      } catch (error) {
        console.error('❌ Failed to upload image:', error.message);
        throw new Error(`Image upload failed: ${error.message}`);
      }
    }

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
          console.log(`💬 [${account.name}] Replying: "${replyText.substring(0, 50)}${replyText.length > 50 ? '...' : ''}"${mediaId ? ' with image' : ''}`);

          // Prepare reply data
          const replyData = {
            text: replyText,
            reply: { in_reply_to_tweet_id: tweetId },
          };

          // Add media if available
          if (mediaId) {
            replyData.media = { media_ids: [mediaId] };
          }

          const result = await account.client.v2.tweet(replyData);

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

  /**
   * Get MIME type from file extension
   * @param {string} filePath - Path to the file
   * @returns {string} MIME type
   */
  getMimeType(filePath) {
    const ext = filePath.toLowerCase().split('.').pop();
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp'
    };
    return mimeTypes[ext] || 'image/jpeg';
  }
}

