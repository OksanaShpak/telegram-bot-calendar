# Setup Instructions

Follow these steps to get your Telegram Calendar Bot up and running.

## Prerequisites

- Node.js installed (v14 or higher)
- A Google account with Google Calendar
- A Telegram account

## Step 1: Install Dependencies

Dependencies are already installed from the project setup.

```bash
npm install
```

## Step 2: Set Up Gemini API (Free Tier)

1. Go to [Google AI Studio](https://ai.google.dev/)
2. Click "Get API key"
3. Create a new API key or use an existing one
4. Copy the API key

## Step 3: Set Up Google Calendar API

### 3.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name your project (e.g., "Telegram Calendar Bot")
4. Click "Create"

### 3.2 Enable Google Calendar API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Google Calendar API"
3. Click on it and press "Enable"

### 3.3 Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - User Type: External (or Internal if you have Google Workspace)
   - App name: "Telegram Calendar Bot"
   - User support email: Your email
   - Developer contact: Your email
   - Click "Save and Continue" through the rest (no need to add scopes or test users for personal use)
4. Back to "Create OAuth client ID":
   - Application type: "Desktop app"
   - Name: "Telegram Calendar Bot"
   - Click "Create"
5. Download the credentials JSON file
6. Save it as `credentials.json` in your project root: `/Users/oksana/Desktop/form/credentials.json`

## Step 4: Set Up Telegram Bot

### 4.1 Create Bot with BotFather

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Follow prompts to set:
   - Bot name (e.g., "My Calendar Assistant")
   - Bot username (must end in "bot", e.g., "my_calendar_bot")
4. Copy the bot token (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 4.2 Get Your Telegram User ID

You'll need this to restrict the bot to only you.

**Option A: Quick Method**
1. Open Telegram and search for [@userinfobot](https://t.me/userinfobot)
2. Start the bot - it will send you your user ID

**Option B: Via Your Bot**
1. Skip this for now (you'll get it after first run)

## Step 5: Configure Environment Variables

1. Copy the template to create your `.env` file:

```bash
cp .env.template .env
```

2. Edit `.env` and fill in your credentials:

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_FROM_BOTFATHER
TELEGRAM_ALLOWED_USER_ID=YOUR_TELEGRAM_USER_ID

# Gemini AI API Key
GEMINI_API_KEY=YOUR_GEMINI_API_KEY

# Google Calendar Settings (Optional)
GOOGLE_CALENDAR_ID=primary
LOG_LEVEL=info
NODE_ENV=development
```

**Note:** If you don't have your user ID yet, you can temporarily comment out `TELEGRAM_ALLOWED_USER_ID` and get it from the logs on first run.

## Step 6: First Run - Google OAuth Authorization

1. Start the bot:

```bash
npm start
```

2. On first run, you'll see an authorization URL in the console:

```
========================================
GOOGLE CALENDAR AUTHORIZATION REQUIRED
========================================

Please authorize this app by visiting this URL:

https://accounts.google.com/o/oauth2/v2/auth?...

Enter the code from that page here:
```

3. Open the URL in your browser
4. **IMPORTANT:** If you see "Access blocked: Telegram Calendar Bot has not completed the Google verification process":
   - Go to [Google Cloud Console OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
   - Scroll to **Test users** section
   - Click **+ ADD USERS**
   - Add your email address (e.g., your.email@gmail.com)
   - Click **SAVE**
   - Try the authorization URL again
5. Sign in with your Google account
6. You may see "Google hasn't verified this app" - this is normal for personal apps
   - Click **Continue** or **Advanced → Go to Telegram Calendar Bot (unsafe)**
7. Grant permissions to access your Google Calendar
8. Copy the authorization code from the page
9. Paste it back in the terminal
10. The bot will save a `token.json` file for future use

## Step 7: Get Your Telegram User ID (If Not Done)

If you skipped Step 4.2:

1. The bot should now be running
2. Open Telegram and find your bot (search for the username you created)
3. Send any message to the bot
4. Check the terminal logs - you'll see:

```
[YYYY-MM-DDTHH:mm:ss.sssZ] WARN: Unauthorized message attempt {"userId":123456789,"username":"your_username"}
```

5. Copy the `userId` number
6. Stop the bot (Ctrl+C)
7. Add the user ID to `.env`:

```bash
TELEGRAM_ALLOWED_USER_ID=123456789
```

8. Restart the bot: `npm start`

## Step 8: Test the Bot

1. Send `/start` to your bot in Telegram
2. You should see the welcome message
3. Try creating an event:
   - Send: "Team meeting tomorrow at 2pm"
   - Bot should show parsed details and ask for confirmation
   - Click "✅ Confirm"
   - Check your Google Calendar - the event should be there!
4. Try querying events:
   - Send: `/tomorrow`
   - Bot should show tomorrow's events

## Troubleshooting

### Bot doesn't respond
- Check that `TELEGRAM_BOT_TOKEN` is correct in `.env`
- Verify the bot is running (`npm start`)
- Check terminal for error messages

### "Unauthorized" message
- Make sure `TELEGRAM_ALLOWED_USER_ID` matches your Telegram user ID
- Restart the bot after changing `.env`

### Google Calendar connection fails
- Verify `credentials.json` is in the project root
- Delete `token.json` and re-run the OAuth flow
- Make sure Google Calendar API is enabled in Cloud Console

### "Access blocked: App has not completed verification" (Error 403)
- Go to [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
- Scroll to **Test users** section
- Click **+ ADD USERS** and add your email address
- Click **SAVE** and try authorization again
- When authorizing, you'll see a warning - click **Continue** or **Advanced → Go to app (unsafe)**

### Gemini API errors
- Check that `GEMINI_API_KEY` is correct in `.env`
- Verify you're not hitting rate limits (15 req/min, 1500 req/day on free tier)
- Check [Google AI Studio](https://ai.google.dev/) for API status

### Events created in wrong timezone
- Check your Google Calendar timezone settings
- Set `GOOGLE_CALENDAR_TIMEZONE` in `.env` (e.g., `America/Los_Angeles`)

## Deploying to Render (Free Tier)

The bot supports two modes:
- **Polling mode** (local dev) - used when `WEBHOOK_URL` is not set
- **Webhook mode** (production) - used when `WEBHOOK_URL` is set

### Step 1: Push Code to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
```

Push to a GitHub repository (public or private).

### Step 2: Create Render Web Service

1. Go to [https://render.com](https://render.com) and sign up/log in
2. Click **New** → **Web Service**
3. Connect your GitHub repository
4. Configure the service:
   - **Name:** `telegram-calendar-bot` (or your choice)
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node bot.js`
   - **Instance Type:** Free

### Step 3: Set Environment Variables on Render

In your Render service dashboard, go to **Environment** and add:

| Key | Value |
|-----|-------|
| `TELEGRAM_BOT_TOKEN` | Your bot token from BotFather |
| `TELEGRAM_ALLOWED_USER_ID` | Your Telegram user ID |
| `GEMINI_API_KEY` | Your Gemini API key |
| `GEMINI_MODEL` | `gemini-2.5-flash` |
| `GOOGLE_CALENDAR_TIMEZONE` | `Australia/Sydney` |
| `GOOGLE_CALENDAR_ID` | `primary` |
| `WEBHOOK_URL` | `https://your-app-name.onrender.com` (use your actual Render URL) |
| `NODE_ENV` | `production` |

### Step 4: Handle Google OAuth on Render

Since Render doesn't have an interactive terminal for the initial OAuth flow, you need to generate `token.json` locally first:

1. Run the bot locally: `npm start`
2. Complete the Google OAuth authorization
3. Copy the generated `token.json` content
4. On Render, add an environment variable:
   - Key: `GOOGLE_TOKEN_JSON`
   - Value: (paste the entire content of your token.json)

Then update `tools/google_auth.js` to check for the env variable, OR commit `token.json` to a private repo (less secure but simpler for personal use).

**Alternative:** Store `credentials.json` and `token.json` content as Render environment variables and write them to disk on startup.

### Step 5: Deploy

1. Render will auto-deploy when you push to GitHub
2. Check the Render logs to verify the bot started:
   ```
   ✅ Telegram Calendar Bot is running (WEBHOOK mode)
   🌐 Webhook URL: https://your-app-name.onrender.com
   ```
3. Test by messaging your bot on Telegram

### Render Free Tier Notes

- Free tier services **spin down after 15 minutes of inactivity**
- When you send a message on Telegram, the webhook wakes up the service
- **First message after sleep may take 30-60 seconds** while Render cold-starts
- Subsequent messages respond instantly while the service is awake
- If cold-start delay is unacceptable, consider Render's paid tier ($7/month) or use an external ping service like UptimeRobot to keep it alive

## Running Locally (Development)

For local development, just use polling mode (no `WEBHOOK_URL` needed):

```bash
npm start
# Or with auto-reload:
npm run dev
```

## Running in Production (VPS Alternative)

For always-on operation on a VPS, use a process manager:

```bash
npm install -g pm2
pm2 start bot.js --name telegram-calendar-bot
pm2 save
pm2 startup  # Follow the instructions to enable auto-start
```

## Security Notes

- Never commit `.env`, `credentials.json`, or `token.json` to git (already in `.gitignore`)
- Keep your bot token and API keys secret
- The `TELEGRAM_ALLOWED_USER_ID` restricts access to only you
- Consider using environment-specific `.env` files for development vs production

## Next Steps

- Customize the welcome message in [bot.js](bot.js)
- Adjust workflows in [workflows/](workflows/) as you learn what works best
- Add more commands or features as needed
- Check logs in [.tmp/bot_logs/](.tmp/bot_logs/) to monitor usage

Enjoy your new calendar assistant! 📅
