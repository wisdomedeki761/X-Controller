# Account Control in X-Raider

Control exactly how many accounts are used for each action instead of always using all accounts.

## How Account Control Works

By default, X-Raider uses ALL your configured accounts for posts, replies, and retweets. But you can now specify exactly how many accounts to use by adding a number to your commands.

## Commands with Account Control

You can use **any number** you want! The bot will automatically use that many accounts (or all available if you specify more than you have).

### Posting with Limited Accounts

**Use all accounts:**
```
/post
[your tweet text]
```

**Use only 5 accounts:**
```
/post5
[your tweet text]
```

**Use only 1 account:**
```
/post1
[your tweet text]
```

**Use 11 accounts (or all if you have fewer):**
```
/post11
[your tweet text]
```

### Replying with Limited Accounts

**Reply with all accounts:**
```
/reply
[tweet URL/ID]
[reply text]
```

**Reply with only 2 accounts:**
```
/reply2
[tweet URL/ID]
[reply text]
```

**Reply with only 1 account:**
```
/reply1
[tweet URL/ID]
[reply text]
```

### Retweeting with Limited Accounts

**Retweet with all accounts:**
```
/retweet
[tweet URL/ID]
```

**Retweet with only 4 accounts:**
```
/retweet4
[tweet URL/ID]
```

**Retweet with only 1 account:**
```
/retweet1
[tweet URL/ID]
```

## How Account Selection Works

When you specify a number (like `/post5`), the bot:

1. Takes the **first N accounts** from your account list
2. Uses only those accounts for the action
3. Distributes the content across those selected accounts

**Example:** If you have 10 accounts configured:
- `/post` or `/post10` → Uses accounts 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
- `/post5` → Uses accounts 1, 2, 3, 4, 5
- `/post3` → Uses accounts 1, 2, 3

## Practical Examples

### Campaign Management

**Big launch - use all accounts:**
```
/post
🚀 Our new app is live! Download now!

Check out these amazing features

What do you think about our launch?

[product image]
```
*Result:* All 10 accounts post one tweet each with the image

**Small promotion - use 3 accounts:**
```
/post3
✨ Special discount this weekend!

Limited time offer: 30% off

Use code SAVE30

[promo image]
```
*Result:* Only accounts 1, 2, 3 post the promotion tweets

### Community Engagement

**Major discussion - engage with all accounts:**
```
/reply
https://twitter.com/elonmusk/status/123456789
This is a game-changer for the industry!

Absolutely agree with this perspective

Great insights as always Elon

[relevant image]
```
*Result:* All accounts reply to the tweet

**Minor comment - engage with 2 accounts:**
```
/reply2
https://twitter.com/someone/status/987654321
Interesting take on this topic!

Thanks for sharing this perspective

[small image]
```
*Result:* Only 2 accounts reply

### Content Sharing

**Important announcement - share widely:**
```
/retweet
https://twitter.com/company/status/555666777
```
*Result:* All accounts retweet the announcement

**Nice article - share selectively:**
```
/retweet2
https://twitter.com/author/status/111222333
```
*Result:* Only 2 accounts retweet the article

## Benefits of Account Control

### Strategic Posting
- **Save API limits** - Don't waste posts on less important content
- **Targeted engagement** - Use specific accounts for specific purposes
- **Gradual rollout** - Test content with fewer accounts first

### Resource Management
- **Rate limit protection** - Spread your monthly 500 posts across campaigns
- **Account variety** - Rotate which accounts get used for different content types
- **Campaign scaling** - Start small, scale up successful campaigns

### Content Strategy
- **A/B testing** - Test content variations with different account groups
- **Brand consistency** - Use specific accounts for specific brand messaging
- **Audience targeting** - Different accounts can target different audience segments

## Best Practices

### When to Use All Accounts
- **Major announcements** - Product launches, big news
- **Trending topics** - When you want maximum visibility
- **Important engagement** - Responding to influencers or major accounts
- **Time-sensitive content** - Breaking news, limited-time offers

### When to Limit Accounts
- **Testing content** - Try new approaches with fewer accounts
- **Niche topics** - Content that only appeals to specific audiences
- **Resource conservation** - Save API calls for important campaigns
- **Account warming** - Gradually increase activity on new accounts

### Account Organization Tips
- **Account 1-3**: Main brand accounts (use for important content)
- **Account 4-6**: Secondary accounts (use for general content)
- **Account 7-10**: Experimental accounts (use for testing)

## Command Reference

| Command | Description | Examples |
|---------|-------------|----------|
| `/post` | Post with all accounts | `/post` |
| `/post{N}` | Post with N accounts | `/post1`, `/post3`, `/post5`, `/post11`, `/post99` |
| `/reply` | Reply with all accounts | `/reply` |
| `/reply{N}` | Reply with N accounts | `/reply1`, `/reply2`, `/reply7`, `/reply15` |
| `/retweet` | Retweet with all accounts | `/retweet` |
| `/retweet{N}` | Retweet with N accounts | `/retweet1`, `/retweet4`, `/retweet10` |

**Flexible Numbers:** Replace {N} with **any number** you want. The bot automatically handles:
- Numbers larger than your account count → uses all accounts
- Numbers smaller than your account count → uses first N accounts
- No number → uses all accounts

## Error Handling

- **Invalid number:** `/post999` will use all available accounts
- **No accounts:** Commands will fail if no accounts are configured
- **Rate limits:** Still apply per account, not per command

---

**Pro Tip:** Use `/accounts` first to see how many accounts you have, then choose appropriate numbers for your campaigns!
