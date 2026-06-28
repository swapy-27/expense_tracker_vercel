# Setup Guide — Vercel + Google Sheets

## Step 1 — Google Service Account (to write to Sheets)

1. Go to https://console.cloud.google.com
2. Create a new project (or use existing)
3. Enable **Google Sheets API**:
   - Search "Google Sheets API" → Enable
4. Create a Service Account:
   - IAM & Admin → Service Accounts → Create
   - Name: "expense-bot" → Create
   - Skip optional steps → Done
5. Click the service account → Keys tab → Add Key → JSON
   - Download the JSON file
6. From the JSON file you need:
   - `client_email` → this is GOOGLE_EMAIL
   - `private_key` → this is GOOGLE_PRIVATE_KEY

## Step 2 — Google Sheet

1. Create a new Google Sheet at sheets.google.com
2. Name it "Expense Tracker"
3. Share it with your service account email (from step above)
   - Share → paste the client_email → Editor → Send
4. Copy the Sheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/SHEET_ID/edit`

## Step 3 — Deploy to Vercel

1. Push this folder to a GitHub repo
2. Go to vercel.com → New Project → import the repo
3. Add these Environment Variables in Vercel dashboard:
   - `BOT_TOKEN` = your Telegram bot token
   - `SHEET_ID` = your Google Sheet ID
   - `GOOGLE_EMAIL` = client_email from JSON
   - `GOOGLE_PRIVATE_KEY` = private_key from JSON (include the full key with -----BEGIN...)
4. Deploy

## Step 4 — Set Webhook

Run this in terminal (replace values):
```bash
curl -X POST "https://api.telegram.org/botYOUR_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://YOUR_VERCEL_URL/api/webhook"}'
```

## Step 5 — Test

Send `Zomato 300` to your bot. You should get ✅ Saved back and see a row in your Sheet.

## Files

```
expense-bot/
├── api/
│   └── webhook.js     ← Vercel serverless function
├── package.json
└── vercel.json
```
