require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

// Import tools
const parseEventDetails = require('./tools/parse_event_details');
const { formatEventConfirmation } = require('./tools/parse_event_details');
const createCalendarEvent = require('./tools/create_calendar_event');
const parseTimeRange = require('./tools/parse_time_range');
const queryCalendarEvents = require('./tools/query_calendar_events');
const { getTodayEvents, getTomorrowEvents, getWeekEvents } = require('./tools/query_calendar_events');
const formatEventsMessage = require('./tools/format_events_message');
const { formatEventCreatedMessage } = require('./tools/format_events_message');

// Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_USER_ID = parseInt(process.env.TELEGRAM_ALLOWED_USER_ID);
const TIMEZONE = process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Los_Angeles';
const WEBHOOK_URL = process.env.WEBHOOK_URL; // e.g., https://your-app.onrender.com
const PORT = process.env.PORT || 3000;
const USE_WEBHOOK = !!WEBHOOK_URL; // Use webhook if WEBHOOK_URL is set, otherwise polling

// Validate configuration
if (!TELEGRAM_BOT_TOKEN) {
  console.error('Error: TELEGRAM_BOT_TOKEN not found in .env file');
  process.exit(1);
}

// Initialize bot based on mode
const bot = USE_WEBHOOK
  ? new TelegramBot(TELEGRAM_BOT_TOKEN) // No polling for webhook mode
  : new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true }); // Polling for local dev

// In-memory storage for pending event confirmations
const pendingEvents = new Map();

// Logging
const LOG_DIR = path.join(__dirname, '.tmp', 'bot_logs');

async function ensureLogDir() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create log directory:', error);
  }
}

async function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = data
    ? `[${timestamp}] ${level}: ${message} ${JSON.stringify(data)}`
    : `[${timestamp}] ${level}: ${message}`;

  console.log(logMessage);

  // Write to daily log file
  try {
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(LOG_DIR, `${date}.log`);
    await fs.appendFile(logFile, logMessage + '\n');
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

// Authorization middleware
function isAuthorized(userId) {
  if (!ALLOWED_USER_ID) {
    log('WARN', 'TELEGRAM_ALLOWED_USER_ID not set in .env - allowing all users (not recommended)');
    return true;
  }
  return userId === ALLOWED_USER_ID;
}

// Intent classification
function isQueryIntent(text) {
  if (!text) return false;
  const queryKeywords = ['what', 'show', 'plans', 'schedule', 'calendar', 'do i have', 'any events'];
  const lowerText = text.toLowerCase();
  return queryKeywords.some(keyword => lowerText.includes(keyword));
}

// Welcome message
const WELCOME_MESSAGE = `👋 *Welcome to your Google Calendar assistant!*

I can help you:
• Create calendar events from natural language
• Check your upcoming schedule

*Commands:*
/today - Show today's events
/tomorrow - Show tomorrow's events
/week - Show this week's events
/help - Show this help message

*Creating Events:*
Just tell me about your event, like:
"Meeting with John tomorrow at 3pm to discuss budget"
"Dentist appointment next Monday at 9am"

*Checking Schedule:*
Ask me about your plans:
"What's on my calendar tomorrow?"
"Do I have anything next week?"

Let's get started! 📅`;

const HELP_MESSAGE = `📋 *How to Use*

*Create an event:*
Just send a message describing your event with a date and time.

Examples:
• "Team meeting tomorrow at 2pm"
• "Lunch with Sarah on Friday at noon"
• "Doctor appointment next Monday at 9am for 1 hour"

I'll show you what I understood and ask for confirmation before creating the event.

*Check your schedule:*
Use commands or ask naturally:
• /today - Today's events
• /tomorrow - Tomorrow's events
• /week - This week's events
• "What are my plans for next Tuesday?"
• "Show me this weekend"

*Tips:*
✓ Include date and time for events
✓ I'll summarize long descriptions
✓ All events use your calendar's timezone
✓ You'll see a confirmation before I create events

Need help? Check the project README.`;

// Command handlers
bot.onText(/\/start/, async (msg) => {
  if (!isAuthorized(msg.from.id)) {
    await log('WARN', 'Unauthorized /start attempt', { userId: msg.from.id });
    return;
  }

  await log('INFO', 'User started bot', { userId: msg.from.id });
  await bot.sendMessage(msg.chat.id, WELCOME_MESSAGE, { parse_mode: 'Markdown' });
});

bot.onText(/\/help/, async (msg) => {
  if (!isAuthorized(msg.from.id)) return;

  await log('INFO', 'User requested help', { userId: msg.from.id });
  await bot.sendMessage(msg.chat.id, HELP_MESSAGE, { parse_mode: 'Markdown' });
});

bot.onText(/\/today/, async (msg) => {
  if (!isAuthorized(msg.from.id)) return;

  await log('INFO', 'User queried today\'s events', { userId: msg.from.id });
  await handleEventQuery(msg, 'today', getTodayEvents);
});

bot.onText(/\/tomorrow/, async (msg) => {
  if (!isAuthorized(msg.from.id)) return;

  await log('INFO', 'User queried tomorrow\'s events', { userId: msg.from.id });
  await handleEventQuery(msg, 'tomorrow', getTomorrowEvents);
});

bot.onText(/\/week/, async (msg) => {
  if (!isAuthorized(msg.from.id)) return;

  await log('INFO', 'User queried week\'s events', { userId: msg.from.id });
  await handleEventQuery(msg, 'this week', getWeekEvents);
});

// Main message handler
bot.on('message', async (msg) => {
  // Check authorization first
  if (!isAuthorized(msg.from.id)) {
    await bot.sendMessage(msg.chat.id, 'Sorry, this bot is for private use only.');
    await log('WARN', 'Unauthorized message attempt', { userId: msg.from.id, username: msg.from.username });
    return;
  }

  // Skip if command was already handled
  if (msg.text?.startsWith('/')) return;

  // Skip non-text messages
  if (!msg.text) return;

  await log('INFO', 'Received message', { userId: msg.from.id, text: msg.text });

  try {
    // Classify intent: query vs add event
    if (isQueryIntent(msg.text)) {
      await log('DEBUG', 'Intent: query events');
      await handleEventQueryNatural(msg, msg.text);
    } else {
      await log('DEBUG', 'Intent: add event');
      await handleAddEvent(msg);
    }
  } catch (error) {
    await log('ERROR', 'Message processing failed', { error: error.message, stack: error.stack });
    await bot.sendMessage(msg.chat.id, 'Sorry, something went wrong. Please try again.');
  }
});

// Handle adding an event
async function handleAddEvent(msg) {
  try {
    await bot.sendChatAction(msg.chat.id, 'typing');

    // Parse event details with Gemini
    await log('DEBUG', 'Calling parse_event_details');
    const eventDetails = await parseEventDetails(msg.text, TIMEZONE);
    await log('INFO', 'Event parsed', { confidence: eventDetails.confidence });

    // Show confirmation
    const confirmMsg = formatEventConfirmation(eventDetails);

    const sentMessage = await bot.sendMessage(msg.chat.id, confirmMsg, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Confirm', callback_data: `confirm_${msg.from.id}` },
          { text: '❌ Cancel', callback_data: `cancel_${msg.from.id}` }
        ]]
      }
    });

    // Store event details for confirmation callback
    pendingEvents.set(msg.from.id, {
      eventDetails: eventDetails,
      messageId: sentMessage.message_id,
      chatId: msg.chat.id
    });

    await log('DEBUG', 'Awaiting user confirmation');

  } catch (error) {
    await log('ERROR', 'Failed to parse event', { error: error.message });
    await bot.sendMessage(msg.chat.id,
      'Sorry, I had trouble understanding that. Please try again with a date and time.\n\n' +
      'Example: "Meeting tomorrow at 3pm to discuss project"'
    );
  }
}

// Handle event query with convenience function
async function handleEventQuery(msg, timeDescription, queryFunction) {
  try {
    await bot.sendChatAction(msg.chat.id, 'typing');

    // Query events
    await log('DEBUG', 'Querying calendar events', { timeDescription });
    const events = await queryFunction();

    // Format and send
    const message = formatEventsMessage(events, timeDescription);
    await bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });

    await log('INFO', 'Events displayed', { count: events.length, timeDescription });

  } catch (error) {
    await log('ERROR', 'Failed to query events', { error: error.message });
    await bot.sendMessage(msg.chat.id, 'Sorry, I couldn\'t retrieve your events right now. Please try again.');
  }
}

// Handle natural language event query
async function handleEventQueryNatural(msg, timeExpression) {
  try {
    await bot.sendChatAction(msg.chat.id, 'typing');

    // Parse time range
    await log('DEBUG', 'Parsing time range', { expression: timeExpression });
    const { startDate, endDate, description } = await parseTimeRange(timeExpression, TIMEZONE);

    // Query events
    const events = await queryCalendarEvents(startDate, endDate);

    // Format and send
    const message = formatEventsMessage(events, description);
    await bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });

    await log('INFO', 'Events displayed', { count: events.length, description });

  } catch (error) {
    await log('ERROR', 'Failed to handle query', { error: error.message });
    await bot.sendMessage(msg.chat.id, 'Sorry, I couldn\'t retrieve your events. Please try again.');
  }
}

// Handle callback queries (button presses)
bot.on('callback_query', async (query) => {
  const userId = query.from.id;
  const data = query.data;

  await log('DEBUG', 'Callback query received', { userId, data });

  if (data.startsWith('confirm_')) {
    await handleEventConfirm(query);
  } else if (data.startsWith('cancel_')) {
    await handleEventCancel(query);
  }

  // Answer callback to remove loading state
  await bot.answerCallbackQuery(query.id);
});

// Handle event confirmation
async function handleEventConfirm(query) {
  const userId = query.from.id;
  const pending = pendingEvents.get(userId);

  if (!pending) {
    await bot.sendMessage(query.message.chat.id, 'Sorry, this confirmation has expired. Please try again.');
    return;
  }

  try {
    await bot.sendChatAction(query.message.chat.id, 'typing');

    // Create calendar event
    await log('DEBUG', 'Creating calendar event');
    const event = await createCalendarEvent(pending.eventDetails, TIMEZONE);
    await log('INFO', 'Event created', { eventId: event.id, summary: event.summary });

    // Send confirmation
    const message = formatEventCreatedMessage(event);
    await bot.sendMessage(query.message.chat.id, message, { parse_mode: 'Markdown' });

    // Edit original message to show it was confirmed
    await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
      chat_id: pending.chatId,
      message_id: pending.messageId
    });

    // Clean up
    pendingEvents.delete(userId);

  } catch (error) {
    await log('ERROR', 'Failed to create event', { error: error.message });
    await bot.sendMessage(query.message.chat.id,
      '❌ Sorry, I couldn\'t create the event. Please check your Google Calendar connection and try again.'
    );
  }
}

// Handle event cancellation
async function handleEventCancel(query) {
  const userId = query.from.id;
  const pending = pendingEvents.get(userId);

  if (pending) {
    // Edit original message to show it was cancelled
    await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
      chat_id: pending.chatId,
      message_id: pending.messageId
    });

    pendingEvents.delete(userId);
  }

  await bot.sendMessage(query.message.chat.id, '❌ Event cancelled.');
  await log('INFO', 'Event cancelled by user', { userId });
}

// Error handling for polling mode
if (!USE_WEBHOOK) {
  bot.on('polling_error', (error) => {
    log('ERROR', 'Polling error', { error: error.message, code: error.code });
  });
}

// Startup
(async () => {
  await ensureLogDir();

  if (USE_WEBHOOK) {
    // === WEBHOOK MODE (Production / Render) ===
    const app = express();
    app.use(express.json());

    // Telegram webhook endpoint
    app.post(`/webhook/${TELEGRAM_BOT_TOKEN}`, (req, res) => {
      bot.processUpdate(req.body);
      res.sendStatus(200);
    });

    // Health check endpoint (Render uses this to know the service is alive)
    app.get('/', (req, res) => {
      res.json({ status: 'ok', mode: 'webhook', timezone: TIMEZONE });
    });

    // Set webhook with Telegram
    const webhookPath = `${WEBHOOK_URL}/webhook/${TELEGRAM_BOT_TOKEN}`;
    await bot.setWebHook(webhookPath);

    app.listen(PORT, () => {
      console.log('✅ Telegram Calendar Bot is running (WEBHOOK mode)');
      console.log(`🌐 Webhook URL: ${WEBHOOK_URL}`);
      console.log(`🔗 Listening on port: ${PORT}`);
      console.log(`📍 Timezone: ${TIMEZONE}`);
      console.log(`👤 Authorized user ID: ${ALLOWED_USER_ID || 'NOT SET (WARNING)'}`);
    });

    await log('INFO', 'Bot started (webhook mode)', {
      timezone: TIMEZONE,
      webhookUrl: WEBHOOK_URL,
      port: PORT,
      authorizedUser: ALLOWED_USER_ID || 'ANY (WARNING!)'
    });

  } else {
    // === POLLING MODE (Local development) ===
    await log('INFO', 'Bot started (polling mode)', {
      timezone: TIMEZONE,
      authorizedUser: ALLOWED_USER_ID || 'ANY (WARNING!)'
    });
    console.log('✅ Telegram Calendar Bot is running (POLLING mode)');
    console.log(`📍 Timezone: ${TIMEZONE}`);
    console.log(`👤 Authorized user ID: ${ALLOWED_USER_ID || 'NOT SET (WARNING)'}`);
  }
})();
