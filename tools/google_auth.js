const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const url = require('url');
const { google } = require('googleapis');
require('dotenv').config();

// OAuth2 scopes for Google Calendar
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = path.join(__dirname, '..', 'token.json');
const IS_PRODUCTION = !!process.env.WEBHOOK_URL;
const AUTH_PORT = 3456; // Local port for OAuth callback

/**
 * Get OAuth2 credentials from environment variables
 * @returns {Object} OAuth2 credentials
 */
function getCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Google OAuth credentials not found in environment variables.\n' +
      'Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.\n\n' +
      'To get these credentials:\n' +
      '1. Go to https://console.cloud.google.com/\n' +
      '2. Enable Google Calendar API\n' +
      '3. Create OAuth 2.0 credentials (Desktop app)\n' +
      '4. Copy the Client ID and Client Secret into your .env file'
    );
  }

  return { clientId, clientSecret };
}

/**
 * Create an OAuth2 client with localhost redirect for auth flow
 * @returns {google.auth.OAuth2} The OAuth2 client
 */
function createOAuth2Client() {
  const { clientId, clientSecret } = getCredentials();
  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    `http://localhost:${AUTH_PORT}/callback`
  );
}

/**
 * Load saved token from file or env var
 * @returns {Object|null} The saved token or null
 */
async function loadToken() {
  // First try local token.json file (always has the freshest token after re-auth)
  try {
    const tokenContent = await fs.readFile(TOKEN_PATH);
    return JSON.parse(tokenContent);
  } catch (error) {
    // File doesn't exist, that's fine
  }

  // Fall back to environment variable (for Render / production)
  if (process.env.GOOGLE_TOKEN_JSON) {
    try {
      return JSON.parse(process.env.GOOGLE_TOKEN_JSON);
    } catch (error) {
      console.error('Failed to parse GOOGLE_TOKEN_JSON env var:', error.message);
    }
  }

  return null;
}

/**
 * Save token to both file and log it for env var use
 * @param {Object} token - The OAuth token to save
 */
async function saveToken(token) {
  // Save to local file
  try {
    await fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token saved to', TOKEN_PATH);
  } catch (error) {
    console.error('Failed to save token file:', error.message);
  }

  // Log the token JSON so user can copy it to env var / Render
  console.log('\n========================================');
  console.log('UPDATE GOOGLE_TOKEN_JSON in .env and Render:');
  console.log('========================================');
  console.log(JSON.stringify(token));
  console.log('========================================\n');
}

/**
 * Get new token using localhost redirect (opens browser, catches callback)
 * @param {google.auth.OAuth2} oAuth2Client
 * @returns {Promise<google.auth.OAuth2>} Authorized client
 */
async function getNewToken(oAuth2Client) {
  // On Render/production, we can't do interactive auth
  if (IS_PRODUCTION) {
    throw new Error(
      'GOOGLE TOKEN EXPIRED - Cannot re-authorize on Render.\n\n' +
      'To fix this:\n' +
      '1. Run the bot LOCALLY: npm start\n' +
      '2. Browser will open for Google OAuth authorization\n' +
      '3. Copy the new GOOGLE_TOKEN_JSON from the console output\n' +
      '4. Update GOOGLE_TOKEN_JSON in Render Environment variables\n' +
      '5. Redeploy on Render\n\n' +
      'NOTE: Google OAuth "Testing" mode tokens expire every 7 days.\n' +
      'To avoid this, publish your OAuth app in Google Cloud Console.'
    );
  }

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    response_type: 'code',
    prompt: 'consent',
  });

  console.log('\n========================================');
  console.log('GOOGLE CALENDAR AUTHORIZATION REQUIRED');
  console.log('========================================\n');
  console.log('Opening browser for authorization...');
  console.log('If browser does not open, visit this URL manually:\n');
  console.log(authUrl);
  console.log('\n');

  // Try to open browser automatically
  const open = process.platform === 'darwin' ? 'open' :
               process.platform === 'win32' ? 'start' : 'xdg-open';
  require('child_process').exec(`${open} "${authUrl}"`);

  // Start temporary local server to catch the OAuth callback
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const parsedUrl = url.parse(req.url, true);

        if (parsedUrl.pathname !== '/callback') {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const code = parsedUrl.query.code;

        if (!code) {
          res.writeHead(400);
          res.end('Authorization failed - no code received');
          server.close();
          reject(new Error('No authorization code received'));
          return;
        }

        // Exchange code for tokens
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        // Save token
        await saveToken(tokens);

        // Send success page to browser
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html><body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
            <h1>Authorization Successful!</h1>
            <p>You can close this tab and return to the terminal.</p>
            <p>Your Telegram Calendar Bot is now connected to Google Calendar.</p>
          </body></html>
        `);

        // Close the temp server
        server.close();
        console.log('Authorization successful!');
        resolve(oAuth2Client);

      } catch (error) {
        res.writeHead(500);
        res.end('Authorization failed: ' + error.message);
        server.close();
        reject(new Error(`Error retrieving access token: ${error.message}`));
      }
    });

    server.listen(AUTH_PORT, () => {
      console.log(`Waiting for authorization on http://localhost:${AUTH_PORT}/callback ...`);
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authorization timed out after 2 minutes. Please try again.'));
    }, 120000);
  });
}

/**
 * Load or request authorization to call Google Calendar API
 * @returns {Promise<google.auth.OAuth2>} The authorized OAuth2 client
 */
async function authorize() {
  const oAuth2Client = createOAuth2Client();

  // Try to load existing token
  const token = await loadToken();

  if (token) {
    oAuth2Client.setCredentials(token);

    // Try refreshing if token is expiring
    try {
      if (oAuth2Client.isTokenExpiring()) {
        console.log('Token is expiring, refreshing...');
        const { credentials } = await oAuth2Client.refreshAccessToken();
        oAuth2Client.setCredentials(credentials);
        await saveToken(credentials);
        console.log('Token refreshed and saved');
      }
    } catch (error) {
      console.error('Token refresh failed:', error.message);
      return await getNewToken(oAuth2Client);
    }

    return oAuth2Client;
  }

  // No token found, need to get new one
  return await getNewToken(oAuth2Client);
}

/**
 * Get an authenticated Google Calendar API client
 * @returns {Promise<Object>} The Google Calendar API client
 */
async function getCalendarClient() {
  const auth = await authorize();
  return google.calendar({ version: 'v3', auth });
}

module.exports = {
  authorize,
  getCalendarClient
};
