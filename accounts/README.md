# Accounts Directory

Place your account `.env` files here.

## Setup Instructions

1. Copy `.env.example` to create your account files:
   ```bash
   cp .env.example account1.env
   cp .env.example account2.env
   # ... and so on
   ```

2. Edit each `.env` file with your X API credentials:
   ```env
   API_KEY=your_api_key_here
   API_SECRET=your_api_secret_here
   ACCESS_TOKEN=your_access_token_here
   ACCESS_SECRET=your_access_token_secret_here
   ```

3. The bot supports both naming conventions:
   - `API_KEY` / `API_SECRET` / `ACCESS_TOKEN` / `ACCESS_SECRET` (recommended)
   - `API_Key` / `API_Key_Secret` / `Access_Token` / `Access_Token_Secret` (legacy)

## Example File Structure

```
accounts/
├── account1.env
├── account2.env
├── account3.env
└── ...
```

Each `.env` file represents one X account.

