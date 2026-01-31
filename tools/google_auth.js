const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');
const readline = require('readline');

// OAuth2 scopes for Google Calendar
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = path.join(__dirname, '..', 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials.json');

/**
 * Create an OAuth2 client with the given credentials
 * @param {Object} credentials The authorization client credentials
 * @returns {google.auth.OAuth2} The OAuth2 client
 */
function createOAuth2Client(credentials) {
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
}

/**
 * Get and store new token after prompting for user authorization
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for
 * @returns {Promise<google.auth.OAuth2>} The authorized OAuth2 client
 */
async function getNewToken(oAuth2Client) {
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

        // Store the token for future use
        await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens));
        console.log('Token stored to', TOKEN_PATH);

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
  try {
    // Load client secrets from credentials.json
    const credentialsContent = await fs.readFile(CREDENTIALS_PATH);
    const credentials = JSON.parse(credentialsContent);
    const oAuth2Client = createOAuth2Client(credentials);

    // Check if we have previously stored a token
    try {
      const tokenContent = await fs.readFile(TOKEN_PATH);
      const token = JSON.parse(tokenContent);
      oAuth2Client.setCredentials(token);

      // Check if token is expired and refresh if needed
      if (oAuth2Client.isTokenExpiring()) {
        console.log('Token is expiring, refreshing...');
        const { credentials } = await oAuth2Client.refreshAccessToken();
        oAuth2Client.setCredentials(credentials);
        await fs.writeFile(TOKEN_PATH, JSON.stringify(credentials));
        console.log('Token refreshed and saved');
      }

      return oAuth2Client;
    } catch (error) {
      // No token found, need to get new one
      return await getNewToken(oAuth2Client);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(
        `Credentials file not found at ${CREDENTIALS_PATH}.\n` +
        'Please download your OAuth2 credentials from Google Cloud Console:\n' +
        '1. Go to https://console.cloud.google.com/\n' +
        '2. Enable Google Calendar API\n' +
        '3. Create OAuth 2.0 credentials (Desktop app)\n' +
        '4. Download and save as credentials.json in the project root'
      );
    }
    throw error;
  }
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
