# Fix OAuth Error

You're getting an OAuth error because the redirect URI needs to be properly configured.

## Quick Fix Option 1: Update Google Cloud Console

1. Go to [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials)
2. Find your OAuth 2.0 Client ID (the one you created for this bot)
3. Click on it to edit
4. Under "Authorized redirect URIs", add BOTH:
   - `http://localhost`
   - `urn:ietf:wg:oauth:2.0:oob`
5. Click "Save"
6. Download the updated credentials JSON
7. Replace your `credentials.json` file with the new one

## Quick Fix Option 2: Manually Edit credentials.json

Update your `credentials.json` redirect_uris to include both options:

```json
{
  "installed": {
    "client_id": "YOUR_CLIENT_ID",
    "project_id": "telegram-calendar-bot-485507",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "YOUR_CLIENT_SECRET",
    "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"]
  }
}
```

## After Fixing

1. Delete `token.json` if it exists: `rm token.json`
2. Restart the bot: `npm start`
3. You should see a proper authorization URL
4. Follow the authorization flow

The authorization URL should now work correctly!
