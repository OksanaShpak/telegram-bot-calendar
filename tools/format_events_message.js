const { format, parseISO, isToday, isTomorrow, isThisWeek } = require('date-fns');

/**
 * Format calendar events into a Telegram message
 * @param {Array} events - Array of event objects from queryCalendarEvents
 * @param {string} timeDescription - Human-readable time range (e.g., "tomorrow", "next week")
 * @returns {string} Formatted Markdown message for Telegram
 */
function formatEventsMessage(events, timeDescription = 'the requested period') {
  if (!events || events.length === 0) {
    return `📅 No events scheduled for *${timeDescription}*.`;
  }

  // Group events by date
  const eventsByDate = groupEventsByDate(events);

  let message = `📅 *Events for ${timeDescription}*\n\n`;

  for (const [dateKey, dateEvents] of Object.entries(eventsByDate)) {
    const date = parseISO(dateKey);
    const dateHeader = formatDateHeader(date);

    message += `*${dateHeader}*\n`;

    dateEvents.forEach(event => {
      message += formatSingleEvent(event);
    });

    message += '\n';
  }

  if (events.length >= 10) {
    message += `_Showing first ${events.length} events. Use a more specific time range for complete results._\n`;
  }

  return message.trim();
}

/**
 * Group events by date
 * @param {Array} events - Array of events
 * @returns {Object} Events grouped by date string (YYYY-MM-DD)
 */
function groupEventsByDate(events) {
  const grouped = {};

  events.forEach(event => {
    const dateTime = event.start;
    let dateKey;

    if (event.isAllDay) {
      // For all-day events, use the date directly
      dateKey = dateTime.split('T')[0];
    } else {
      // For timed events, extract date part
      const date = parseISO(dateTime);
      dateKey = format(date, 'yyyy-MM-dd');
    }

    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }

    grouped[dateKey].push(event);
  });

  // Sort events within each date by start time
  Object.keys(grouped).forEach(dateKey => {
    grouped[dateKey].sort((a, b) => {
      return new Date(a.start) - new Date(b.start);
    });
  });

  return grouped;
}

/**
 * Format a date header with day of week
 * @param {Date} date - The date to format
 * @returns {string} Formatted date header
 */
function formatDateHeader(date) {
  if (isToday(date)) {
    return `📆 Today, ${format(date, 'EEEE, MMMM d')}`;
  } else if (isTomorrow(date)) {
    return `📆 Tomorrow, ${format(date, 'EEEE, MMMM d')}`;
  } else if (isThisWeek(date)) {
    return `📆 ${format(date, 'EEEE, MMMM d')}`;
  } else {
    return `📆 ${format(date, 'EEEE, MMMM d, yyyy')}`;
  }
}

/**
 * Format a single event
 * @param {Object} event - Event object
 * @returns {string} Formatted event line
 */
function formatSingleEvent(event) {
  let eventLine = '';

  if (event.isAllDay) {
    // All-day event
    eventLine = `  🗓  *${escapeMarkdown(event.summary)}*`;
    if (event.description) {
      eventLine += `\n     _${escapeMarkdown(truncate(event.description, 60))}_`;
    }
  } else {
    // Timed event
    const startTime = format(parseISO(event.start), 'h:mm a');
    const endTime = format(parseISO(event.end), 'h:mm a');

    eventLine = `  ⏰ ${startTime} - ${endTime}`;
    eventLine += `\n     *${escapeMarkdown(event.summary)}*`;

    if (event.description) {
      eventLine += `\n     _${escapeMarkdown(truncate(event.description, 60))}_`;
    }

    if (event.location) {
      eventLine += `\n     📍 ${escapeMarkdown(event.location)}`;
    }
  }

  // Add link to event (optional - can be clicked in Telegram)
  if (event.htmlLink) {
    eventLine += `\n     [View in Calendar](${event.htmlLink})`;
  }

  eventLine += '\n';

  return eventLine;
}

/**
 * Escape special characters for Telegram MarkdownV2
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeMarkdown(text) {
  if (!text) return '';

  // For Telegram MarkdownV2, we need to escape: _*[]()~`>#+-=|{}.!
  // But we're using basic Markdown mode, so we mainly need to escape * and _
  return text.replace(/([*_`\[])/g, '\\$1');
}

/**
 * Truncate text to a maximum length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncate(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Format a success message after creating an event
 * @param {Object} event - Created event object
 * @returns {string} Formatted success message
 */
function formatEventCreatedMessage(event) {
  const startDate = parseISO(event.start);
  const formattedDate = format(startDate, 'EEEE, MMMM d, yyyy');
  const formattedTime = format(startDate, 'h:mm a');

  let message = `✅ *Event Created!*\n\n`;
  message += `📅 *${escapeMarkdown(event.summary)}*\n`;
  message += `📆 ${formattedDate}\n`;
  message += `⏰ ${formattedTime}\n`;

  if (event.description && event.description !== event.summary) {
    message += `📋 ${escapeMarkdown(truncate(event.description, 100))}\n`;
  }

  message += `\n[View in Google Calendar](${event.htmlLink})`;

  return message;
}

module.exports = formatEventsMessage;
module.exports.formatEventCreatedMessage = formatEventCreatedMessage;
module.exports.groupEventsByDate = groupEventsByDate;
module.exports.formatDateHeader = formatDateHeader;
