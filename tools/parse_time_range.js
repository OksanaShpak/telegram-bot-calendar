const { generateJSON } = require('./gemini_client');
const { formatInTimeZone } = require('date-fns-tz');
const { startOfDay, endOfDay, startOfWeek, endOfWeek, addDays, addWeeks } = require('date-fns');

/**
 * Parse natural language time expression into a date range
 * @param {string} timeExpression - Natural language time (e.g., "tomorrow", "next week")
 * @param {string} timezone - User's timezone (default: America/Los_Angeles)
 * @returns {Promise<Object>} Object with startDate, endDate (ISO strings), and description
 */
async function parseTimeRange(timeExpression, timezone = 'America/Los_Angeles') {
  const now = new Date();
  const currentDateTime = formatInTimeZone(now, timezone, 'yyyy-MM-dd HH:mm zzz');

  // Handle common shortcuts first (faster than AI)
  const quickParse = parseQuickShortcuts(timeExpression, timezone);
  if (quickParse) {
    return quickParse;
  }

  // Use Gemini for more complex expressions
  const prompt = `You are a date range parser. Convert the time expression into a date range.

User's timezone: ${timezone}
Current date/time: ${currentDateTime}

Time expression: "${timeExpression}"

Return a JSON object with:
{
  "startDate": "YYYY-MM-DD (start of the range)",
  "endDate": "YYYY-MM-DD (end of the range, inclusive)",
  "startTime": "00:00 (start of day unless specific time mentioned)",
  "endTime": "23:59 (end of day unless specific time mentioned)",
  "confidence": "high|medium|low",
  "description": "human-readable description of the range (e.g., 'tomorrow', 'next week')"
}

Examples:
- "tomorrow" -> next day from 00:00 to 23:59
- "next week" -> upcoming Monday through Sunday
- "this weekend" -> upcoming Saturday and Sunday
- "next Monday" -> the next occurrence of Monday`;

  try {
    const result = await generateJSON(prompt);

    if (!result.startDate || !result.endDate) {
      throw new Error('Missing required date fields');
    }

    // Convert to ISO datetime strings with timezone
    const startDateTime = `${result.startDate}T${result.startTime || '00:00'}:00`;
    const endDateTime = `${result.endDate}T${result.endTime || '23:59'}:59`;

    return {
      startDate: startDateTime,
      endDate: endDateTime,
      description: result.description || timeExpression,
      confidence: result.confidence || 'medium'
    };

  } catch (error) {
    throw new Error(`Failed to parse time range: ${error.message}`);
  }
}

/**
 * Parse common time shortcuts without using AI (faster)
 * @param {string} expression - Time expression
 * @param {string} timezone - User's timezone
 * @returns {Object|null} Parsed range or null if not a shortcut
 */
function parseQuickShortcuts(expression, timezone) {
  const normalized = expression.toLowerCase().trim();
  const now = new Date();

  let start, end, description;

  switch (normalized) {
    case 'today':
      start = startOfDay(now);
      end = endOfDay(now);
      description = 'today';
      break;

    case 'tomorrow':
      const tomorrow = addDays(now, 1);
      start = startOfDay(tomorrow);
      end = endOfDay(tomorrow);
      description = 'tomorrow';
      break;

    case 'yesterday':
      const yesterday = addDays(now, -1);
      start = startOfDay(yesterday);
      end = endOfDay(yesterday);
      description = 'yesterday';
      break;

    case 'this week':
    case 'week':
      start = startOfWeek(now, { weekStartsOn: 1 }); // Monday
      end = endOfWeek(now, { weekStartsOn: 1 }); // Sunday
      description = 'this week';
      break;

    case 'next week':
      const nextWeekStart = addWeeks(startOfWeek(now, { weekStartsOn: 1 }), 1);
      start = nextWeekStart;
      end = endOfWeek(nextWeekStart, { weekStartsOn: 1 });
      description = 'next week';
      break;

    case 'this weekend':
      // Find next Saturday
      const dayOfWeek = now.getDay();
      const daysUntilSaturday = dayOfWeek <= 6 ? 6 - dayOfWeek : 0;
      const saturday = addDays(now, daysUntilSaturday);
      start = startOfDay(saturday);
      end = endOfDay(addDays(saturday, 1)); // Sunday
      description = 'this weekend';
      break;

    default:
      return null; // Not a recognized shortcut
  }

  return {
    startDate: formatInTimeZone(start, timezone, "yyyy-MM-dd'T'HH:mm:ss"),
    endDate: formatInTimeZone(end, timezone, "yyyy-MM-dd'T'HH:mm:ss"),
    description: description,
    confidence: 'high'
  };
}

module.exports = parseTimeRange;
