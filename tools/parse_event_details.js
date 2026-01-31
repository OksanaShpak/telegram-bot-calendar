const { generateJSON } = require('./gemini_client');
const { format, addHours } = require('date-fns');
const { formatInTimeZone } = require('date-fns-tz');

/**
 * Parse natural language event description into structured data
 * @param {string} userInput - The user's message describing the event
 * @param {string} timezone - User's timezone (e.g., 'America/Los_Angeles')
 * @returns {Promise<Object>} Structured event data
 */
async function parseEventDetails(userInput, timezone = 'America/Los_Angeles') {
  // Get current date/time in user's timezone for context
  const now = new Date();
  const currentDateTime = formatInTimeZone(now, timezone, 'yyyy-MM-dd HH:mm zzz');

  const prompt = `You are a calendar assistant. Parse the following message into a structured calendar event.

User's timezone: ${timezone}
Current date/time: ${currentDateTime}

User's message: "${userInput}"

Extract the event details and return a JSON object with these fields:
{
  "summary": "Brief event title (max 10 words)",
  "description": "Longer summary of the purpose (1-2 sentences, summarize the user's intent)",
  "date": "YYYY-MM-DD (the event date)",
  "startTime": "HH:MM (24-hour format)",
  "endTime": "HH:MM (24-hour format, estimate 1 hour if not specified)",
  "confidence": "high|medium|low (how confident you are in the parsing)",
  "ambiguities": ["list any unclear aspects or assumptions made"]
}

Rules:
- If no specific time is mentioned, use a reasonable default (e.g., 9am for morning, 2pm for afternoon, 7pm for evening)
- If duration is not specified, default to 1 hour
- For relative dates (tomorrow, next Monday, etc.), calculate the actual date
- Summarize long descriptions into concise text
- Be conservative with confidence: mark as "low" if anything is unclear
- Include any assumptions in the ambiguities array`;

  try {
    const result = await generateJSON(prompt);

    // Validate the response
    if (!result.summary || !result.date || !result.startTime || !result.endTime) {
      throw new Error('Missing required fields in parsed event');
    }

    // Validate date is not in the past
    const eventDate = new Date(result.date + 'T' + result.startTime);
    if (eventDate < now) {
      result.ambiguities = result.ambiguities || [];
      result.ambiguities.push('Event date appears to be in the past');
      result.confidence = 'low';
    }

    // Validate end time is after start time
    const startTime = new Date('2000-01-01T' + result.startTime);
    const endTime = new Date('2000-01-01T' + result.endTime);
    if (endTime <= startTime) {
      throw new Error('End time must be after start time');
    }

    return result;

  } catch (error) {
    throw new Error(`Failed to parse event details: ${error.message}`);
  }
}

/**
 * Format parsed event details for user confirmation
 * @param {Object} eventDetails - Parsed event details
 * @returns {string} Formatted message for Telegram
 */
function formatEventConfirmation(eventDetails) {
  const { summary, description, date, startTime, endTime, confidence, ambiguities } = eventDetails;

  // Format the date nicely
  const eventDate = new Date(date);
  const formattedDate = format(eventDate, 'EEEE, MMMM d, yyyy');

  let message = `📅 *Event Details*\n\n`;
  message += `📆 *Date:* ${formattedDate}\n`;
  message += `⏰ *Time:* ${startTime} - ${endTime}\n`;
  message += `📝 *Title:* ${summary}\n`;

  if (description && description !== summary) {
    message += `📋 *Description:* ${description}\n`;
  }

  if (confidence === 'low' || (ambiguities && ambiguities.length > 0)) {
    message += `\n⚠️ *Please verify:*\n`;
    if (ambiguities && ambiguities.length > 0) {
      ambiguities.forEach(ambiguity => {
        message += `• ${ambiguity}\n`;
      });
    }
  }

  message += `\nShall I create this event?`;

  return message;
}

module.exports = parseEventDetails;
module.exports.formatEventConfirmation = formatEventConfirmation;
