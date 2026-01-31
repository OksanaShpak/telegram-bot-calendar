const { getCalendarClient } = require('./google_auth');
require('dotenv').config();

/**
 * Query events from Google Calendar within a date range
 * @param {string} startDate - Start of range (ISO 8601 datetime)
 * @param {string} endDate - End of range (ISO 8601 datetime)
 * @param {number} maxResults - Maximum number of events to return (default: 10)
 * @returns {Promise<Array>} Array of event objects
 */
async function queryCalendarEvents(startDate, endDate, maxResults = 10) {
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  try {
    // Get authenticated Calendar API client
    const calendar = await getCalendarClient();

    // Query events from Google Calendar
    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: startDate,
      timeMax: endDate,
      maxResults: maxResults,
      singleEvents: true, // Expand recurring events
      orderBy: 'startTime', // Sort by start time
    });

    const events = response.data.items || [];

    // Transform events into a simpler format
    return events.map(event => {
      const start = event.start.dateTime || event.start.date;
      const end = event.end.dateTime || event.end.date;

      return {
        id: event.id,
        summary: event.summary || '(No title)',
        description: event.description || '',
        start: start,
        end: end,
        isAllDay: !event.start.dateTime, // All-day if no time component
        htmlLink: event.htmlLink,
        location: event.location || null,
        created: event.created,
        updated: event.updated
      };
    });

  } catch (error) {
    // Handle specific Google Calendar API errors
    if (error.code === 401 || error.code === 403) {
      throw new Error('Google Calendar authentication failed. Please check your credentials.');
    } else if (error.code === 404) {
      throw new Error('Calendar not found. Please check GOOGLE_CALENDAR_ID in .env');
    } else if (error.code === 429) {
      throw new Error('Google Calendar API rate limit exceeded. Please try again later.');
    }

    throw new Error(`Failed to query calendar events: ${error.message}`);
  }
}

/**
 * Get today's events (convenience function)
 * @returns {Promise<Array>} Array of today's events
 */
async function getTodayEvents() {
  const now = new Date();
  const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
  const endOfDay = new Date(now.setHours(23, 59, 59, 999)).toISOString();

  return await queryCalendarEvents(startOfDay, endOfDay);
}

/**
 * Get tomorrow's events (convenience function)
 * @returns {Promise<Array>} Array of tomorrow's events
 */
async function getTomorrowEvents() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const startOfDay = new Date(tomorrow.setHours(0, 0, 0, 0)).toISOString();
  const endOfDay = new Date(tomorrow.setHours(23, 59, 59, 999)).toISOString();

  return await queryCalendarEvents(startOfDay, endOfDay);
}

/**
 * Get this week's events (convenience function)
 * @returns {Promise<Array>} Array of this week's events
 */
async function getWeekEvents() {
  const now = new Date();

  // Get start of week (Monday)
  const dayOfWeek = now.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() + daysToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  // Get end of week (Sunday)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return await queryCalendarEvents(startOfWeek.toISOString(), endOfWeek.toISOString(), 50);
}

module.exports = queryCalendarEvents;
module.exports.getTodayEvents = getTodayEvents;
module.exports.getTomorrowEvents = getTomorrowEvents;
module.exports.getWeekEvents = getWeekEvents;
