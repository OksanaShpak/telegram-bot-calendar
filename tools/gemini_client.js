const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Initialize the Gemini API client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use Gemini model - configurable via environment variable
// Default to gemini-2.0-flash-exp, but can be overridden in .env
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const model = genAI.getGenerativeModel({ model: modelName });

/**
 * Sleep function for retry delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate content using Gemini API with retry logic
 * @param {string} prompt - The prompt to send to Gemini
 * @param {Object} options - Optional configuration
 * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} options.temperature - Model temperature 0-1 (default: 0.3 for consistency)
 * @returns {Promise<string>} The generated text response
 */
async function generateContent(prompt, options = {}) {
  const { maxRetries = 3, temperature = 0.3 } = options;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: temperature,
          maxOutputTokens: 1024,
        },
      });

      const response = result.response;
      const text = response.text();

      if (!text) {
        throw new Error('Empty response from Gemini');
      }

      return text;

    } catch (error) {
      const isRateLimit = error.message?.includes('429') || error.message?.includes('rate limit');
      const isLastAttempt = attempt === maxRetries - 1;

      if (isRateLimit && !isLastAttempt) {
        // Exponential backoff for rate limits
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Rate limit hit, retrying in ${delay / 1000}s... (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(delay);
        continue;
      }

      // On last attempt or non-retryable error, throw
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }
}

/**
 * Generate JSON content using Gemini with structured output
 * @param {string} prompt - The prompt requesting JSON output
 * @param {Object} options - Optional configuration
 * @returns {Promise<Object>} Parsed JSON response
 */
async function generateJSON(prompt, options = {}) {
  const enhancedPrompt = `${prompt}\n\nIMPORTANT: Respond with ONLY valid JSON, no additional text or explanation.`;

  try {
    const text = await generateContent(enhancedPrompt, options);

    // Extract JSON from response (sometimes wrapped in ```json blocks)
    let jsonText = text.trim();

    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(jsonText);
    return parsed;

  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${error.message}`);
  }
}

/**
 * Check if Gemini API is properly configured
 * @returns {Promise<boolean>} True if API key is valid
 */
async function testConnection() {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not found in environment variables');
    }

    await generateContent('Respond with: OK');
    return true;
  } catch (error) {
    console.error('Gemini API connection test failed:', error.message);
    return false;
  }
}

module.exports = {
  generateContent,
  generateJSON,
  testConnection
};
