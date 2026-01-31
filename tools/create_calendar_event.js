const { getCalendarClient } = require('./google_auth');
require('dotenv').config();

/**
 * Create an event in Google Calendar
 * @param {Object} eventDetails - Structured event data
 * @param {string} eventDetails.summary - Event title
 * @param {string} eventDetails.description - Event description
 * @param {string} eventDetails.date - Event date (YYYY-MM-DD)
 * @param {string} eventDetails.startTime - Start time (HH:MM)
 * @param {string} eventDetails.endTime - End time (HH:MM)
 * @param {string} timezone - Timezone for the event (default: from env or America/Los_Angeles)
 * @returns {Promise<Object>} Created event with id, htmlLink, and summary
 */
async function createCalendarEvent(eventDetails, timezone = null) {
  const { summary, description, date, startTime, endTime } = eventDetails;

  // Use timezone from params, env, or default
  const eventTimezone = timezone || process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Los_Angeles';
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  // Validate event data
  const errors = validateEventData(eventDetails);
  if (errors.length > 0) {
    throw new Error(`Invalid event data: ${errors.join(', ')}`);
  }

  try {
    // Get authenticated Calendar API client
    const calendar = await getCalendarClient();

    // Format the event for Google Calendar API
    const event = {
      summary: summary,
      description: description || summary,
      start: {
        dateTime: `${date}T${startTime}:00`,
        timeZone: eventTimezone,
      },
      end: {
        dateTime: `${date}T${endTime}:00`,
        timeZone: eventTimezone,
      },
      reminders: {
        useDefault: true, // Use calendar's default reminder settings
      },
    };

    // Create the event
    const response = await calendar.events.insert({
      calendarId: calendarId,
      resource: event,
    });

    const createdEvent = response.data;

    return {
      id: createdEvent.id,
      htmlLink: createdEvent.htmlLink,
      summary: createdEvent.summary,
      start: createdEvent.start.dateTime || createdEvent.start.date,
      end: createdEvent.end.dateTime || createdEvent.end.date,
      description: createdEvent.description,
    };

  } catch (error) {
    // Handle specific Google Calendar API errors
    if (error.code === 401 || error.code === 403) {
      throw new Error('Google Calendar authentication failed. Please check your credentials.');
    } else if (error.code === 404) {
      throw new Error('Calendar not found. Please check GOOGLE_CALENDAR_ID in .env');
    } else if (error.code === 429) {
      throw new Error('Google Calendar API rate limit exceeded. Please try again later.');
    }

    throw new Error(`Failed to create calendar event: ${error.message}`);
  }
}

/**
 * Validate event data before creating calendar entry
 * @param {Object} eventDetails - Event details to validate
 * @returns {Array<string>} Array of validation error messages (empty if valid)
 */
function validateEventData(eventDetails) {
  const errors = [];

  if (!eventDetails.summary || eventDetails.summary.trim().length === 0) {
    errors.push('Event must have a title');
  }

  if (!eventDetails.date) {
    errors.push('Event must have a date');
  }

  if (!eventDetails.startTime || !eventDetails.endTime) {
    errors.push('Event must have start and end times');
  }

  // Validate date format (YYYY-MM-DD)
  if (eventDetails.date && !/^\d{4}-\d{2}-\d{2}$/.test(eventDetails.date)) {
    errors.push('Date must be in YYYY-MM-DD format');
  }

  // Validate time format (HH:MM)
  if (eventDetails.startTime && !/^\d{2}:\d{2}$/.test(eventDetails.startTime)) {
    errors.push('Start time must be in HH:MM format');
  }

  if (eventDetails.endTime && !/^\d{2}:\d{2}$/.test(eventDetails.endTime)) {
    errors.push('End time must be in HH:MM format');
  }

  // Validate that end time is after start time
  if (eventDetails.startTime && eventDetails.endTime) {
    const start = new Date(`2000-01-01T${eventDetails.startTime}:00`);
    const end = new Date(`2000-01-01T${eventDetails.endTime}:00`);

    if (end <= start) {
      errors.push('Event end time must be after start time');
    }
  }

  // Check if date is not too far in the past
  if (eventDetails.date) {
    const eventDate = new Date(eventDetails.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysInPast = Math.floor((today - eventDate) / (1000 * 60 * 60 * 24));

    if (daysInPast > 1) {
      errors.push('Event date is more than 1 day in the past');
    }
  }

  return errors;
}

module.exports = createCalendarEvent;
module.exports.validateEventData = validateEventData;
