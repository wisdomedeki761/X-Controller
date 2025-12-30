# How to Post with Images in X-Raider

## Posting with Images via Telegram Bot

### Method 1: Single Post with Image

1. Send `/post` to the bot
2. Send your tweet text
3. Send an image (photo)
4. The bot will post your tweet with the image

**Example:**
```
/post
This is my awesome post! #XRaider

[Send your image here]
```

### Method 2: Multiple Posts with One Image

**Important:** When you send multiple posts (separated by empty lines) and one image, **the same image will be used for ALL posts**.

1. Send `/post` to the bot
2. Send multiple tweet texts separated by empty lines
3. Send one image
4. Each account will post one tweet, all using the same image

**Example:**
```
/post

Tweet 1: Amazing product launch! 🚀

Tweet 2: Check out these features

Tweet 3: What do you think?

[Send ONE image - it will be used for all 3 tweets]
```

**Result:**
- Account 1 posts: "Tweet 1: Amazing product launch! 🚀" + image
- Account 2 posts: "Tweet 2: Check out these features" + image
- Account 3 posts: "Tweet 3: What do you think?" + image

## Image Requirements

- **Format:** JPG, PNG, GIF, WebP
- **Size:** Under 10MB (Telegram limit)
- **Resolution:** Twitter will optimize automatically
- **Quantity:** Send only ONE image for multiple posts

## How It Works

1. **Image Upload:** The bot downloads your image to a temporary folder
2. **Twitter Upload:** The image is uploaded to Twitter once using the first account
3. **Reuse:** The same image media ID is used for all tweets
4. **Cleanup:** The temporary image is deleted after posting

## Replying with Images

You can also reply to tweets with images:

1. Send `/reply`
2. Send tweet URL/ID
3. Send your reply text
4. Send an image (optional)
5. The bot will reply from all accounts with the same image

**Example:**
```
/reply
https://twitter.com/elonmusk/status/123456789

Great insights! Here's what I think:

[Send image]
```

## Important Notes

### One Image = All Posts
- If you send 10 posts and 1 image, all 10 posts will use that same image
- This is perfect for campaigns where you want the same visual across multiple accounts

### Image Limits
- Twitter allows up to 4 images per tweet
- Current implementation uses 1 image per tweet
- Images count toward your 500 posts/month limit

### Temporary Storage
- Images are stored temporarily in the `temp/` folder
- They are automatically deleted after posting
- No images are kept on your server

### Rate Limits
- Image uploads count toward API limits
- The bot uploads the image only once, then reuses the media ID

## Troubleshooting

### "Image upload failed"
- Check image size (under 10MB)
- Verify image format (JPG, PNG, GIF, WebP)
- Ensure your Twitter app has media upload permissions

### Image not appearing
- Twitter may take a few seconds to process images
- Check the tweet URL directly
- Verify the image was sent before the bot processed the text

### Wrong image on posts
- Make sure to send only ONE image for multiple posts
- Send the image after the text but before the bot processes

## Examples in Action

### Campaign Example:
```
/post

🚀 Our new app is live!

Download now and get 50% off

#AppLaunch #TechNews

[Send app screenshot - used for all 3 posts]
```

### Meme Sharing Example:
```
/post

When the code finally works 😂

Dev life in a nutshell

#Programming #DevLife

[Send meme image - used for all 3 posts]
```

### Product Promotion Example:
```
/post

Introducing our premium collection ✨

Elevate your style with our new designs

Limited time offer: 30% off

[Send product catalog image - used for all 3 posts]
```

---

**Tip:** Always send the image after the text but before clicking any other commands. The bot will process in sequence: text → image → post.
