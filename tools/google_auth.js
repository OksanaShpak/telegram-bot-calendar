const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');
const readline = require('readline');
require('dotenv').config();

// OAuth2 scopes for Google Calendar
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = path.join(__dirname, '..', 'token.json');
const IS_PRODUCTION = !!process.env.WEBHOOK_URL;

/**
 * Get OAuth2 credentials from environment variables
 * @returns {Object} OAuth2 credentials { client_id, client_secret, redirect_uri }
 */
function getCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob';

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

  return { clientId, clientSecret, redirectUri };
}

/**
 * Create an OAuth2 client from environment variables
 * @returns {google.auth.OAuth2} The OAuth2 client
 */
function createOAuth2Client() {
  const { clientId, clientSecret, redirectUri } = getCredentials();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Load saved token from file or env var
 * Priority: token.json file first (has freshest token after re-auth),
 * then GOOGLE_TOKEN_JSON env var (for Render where no file exists)
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
 * Get and store new token after prompting for user authorization
 * Only works locally (interactive terminal required)
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for
 * @returns {Promise<google.auth.OAuth2>} The authorized OAuth2 client
 */
async function getNewToken(oAuth2Client) {
  // On Render/production, we can't do interactive auth
  if (IS_PRODUCTION) {
    throw new Error(
      'GOOGLE TOKEN EXPIRED - Cannot re-authorize on Render (no interactive terminal).\n\n' +
      'To fix this:\n' +
      '1. Run the bot LOCALLY: npm start\n' +
      '2. Complete the Google OAuth authorization\n' +
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
  console.log('Please authorize this app by visiting this URL:\n');
  console.log(authUrl);
  console.log('\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question('Enter the code from that page here: ', async (code) => {
      rl.close();
      try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        // Save token to file and log for env var
        await saveToken(tokens);

        resolve(oAuth2Client);
      } catch (error) {
        reject(new Error(`Error retrieving access token: ${error.message}`));
      }
    });
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

    // Try using the token directly - let Google's library handle refresh automatically
    // Only manually refresh if we detect it's expiring
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
