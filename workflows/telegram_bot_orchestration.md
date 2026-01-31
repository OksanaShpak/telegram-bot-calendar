# Workflow: Telegram Bot Orchestration

## Objective
Coordinate all Telegram bot interactions and route messages to appropriate workflows.

## Bot Commands

### Core Commands
- `/start` - Welcome message and usage instructions
- `/help` - Show help and command list
- `/today` - Quick query for today's events
- `/tomorrow` - Quick query for tomorrow's events
- `/week` - Quick query for this week's events

### Natural Language Support
- Event creation: Any message describing an event
  - "Meeting tomorrow at 3pm"
  - "Dentist appointment next Monday at 9am"
- Event queries: Messages asking about schedule
  - "What's on my calendar tomorrow?"
  - "Do I have anything next week?"

## Inputs
- Telegram messages (text, commands)
- Telegram user ID (for authorization)
- Callback queries (button presses)

## Process Flow

### Step 1: Receive Message
- Bot receives message via polling
- Extract: user ID, chat ID, message text
- Log incoming message to `.tmp/bot_logs/YYYY-MM-DD.log`

### Step 2: Authorization Check
- Compare `msg.from.id` with `TELEGRAM_ALLOWED_USER_ID`
- If unauthorized:
  - Send: "Sorry, this bot is for private use only."
  - Log unauthorized attempt
  - Return (stop processing)

### Step 3: Intent Classification
Determine what the user wants:

**A. Command Message** (starts with `/`)
- `/start` → Send welcome message
- `/help` → Send help text
- `/today` → Route to query workflow with "today"
- `/tomorrow` → Route to query workflow with "tomorrow"
- `/week` → Route to query workflow with "this week"

**B. Query Intent** (asking about schedule)
Keywords: "what", "show", "plans", "schedule", "calendar", "do i have"
- Route to query workflow with full message text

**C. Add Event Intent** (describing an event)
Default for all other messages
- Route to add event workflow

### Step 4: Route to Appropriate Workflow

**For Event Creation:**
1. Call `add_calendar_event.md` workflow
2. Show parsed details with confirmation buttons
3. Handle callback query for confirmation
4. Create event if confirmed
5. Send success message

**For Event Queries:**
1. Call `query_upcoming_events.md` workflow
2. Parse time range
3. Fetch and format events
4. Send formatted message

### Step 5: Handle Callback Queries
Button presses from inline keyboards:

**`confirm_event`**:
- Retrieve stored event details
- Create calendar event
- Send success message with link

**`cancel_event`**:
- Discard stored event details
- Send acknowledgment: "❌ Event cancelled."

### Step 6: Error Handling
- Catch all errors at top level
- Log error details to `.tmp/bot_logs/`
- Send user-friendly error message
- Don't expose technical details to user

## Authorization

### Single User Setup
- Environment variable `TELEGRAM_ALLOWED_USER_ID` contains authorized user ID
- All other users are rejected immediately
- No user database needed

### Getting User ID
First time setup:
1. User messages the bot
2. Bot logs the message with user ID
3. User adds their ID to `.env`
4. Restart bot

## Conversation State Management

### Stateless Approach (Current)
- Each message is independent
- Event details stored temporarily in memory
- Keyed by user ID for callback lookups
- State cleared after event created or cancelled

### Future: Stateful Conversations
If needed later:
- Store conversation context per user
- Allow multi-turn clarifications
- Track conversation flow (waiting for date, waiting for time, etc.)

## Logging Strategy

### What to Log
- All incoming messages (timestamp, user ID, message text)
- Intent classification decisions
- Tool calls and results
- Errors with stack traces
- API response times

### Log Format
```
[2026-01-26T14:32:15.123Z] INFO: Received message from user 123456789: "Meeting tomorrow at 3pm"
[2026-01-26T14:32:15.456Z] DEBUG: Intent classified as: add_event
[2026-01-26T14:32:15.789Z] DEBUG: Calling parse_event_details
[2026-01-26T14:32:16.234Z] INFO: Event parsed successfully (confidence: high)
[2026-01-26T14:32:16.567Z] INFO: Showing confirmation to user
```

### Log Location
- Daily log files: `.tmp/bot_logs/YYYY-MM-DD.log`
- Rotate daily
- Keep last 30 days

## Error Handling

### Bot-Level Errors
**Polling fails**:
- Bot connection lost
- Automatic reconnection
- Log the error

**Message processing fails**:
- Catch all errors
- Log with stack trace
- Send user: "Sorry, something went wrong. Please try again."

### Workflow Errors
**Gemini API fails**:
- gemini_client.js handles retries
- If all retries fail, return error to user
- Message: "I'm having trouble processing that right now. Please try again in a moment."

**Google Calendar API fails**:
- google_auth.js handles auth refresh
- If still failing, return error
- Message: "Couldn't connect to Google Calendar. Please try again."

### User Input Errors
**Unparseable message**:
- Can't extract event details
- Response: "I couldn't understand that. Please describe your event with a date and time."
- Provide example

**Ambiguous input**:
- Low confidence from Gemini
- Show interpreted details
- Ask for confirmation or clarification

## Welcome and Help Messages

### `/start` Welcome Message
```
👋 Welcome to your Google Calendar assistant!

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

Let's get started! 📅
```

### `/help` Message
```
📋 *How to Use*

*Create an event:*
Just send a message describing your event with a date and time.

Examples:
• "Team meeting tomorrow at 2pm"
• "Lunch with Sarah on Friday at noon"
• "Doctor appointment next Monday at 9am for 1 hour"

I'll show you what I understood and ask for confirmation before creating the event.

*Check your schedule:*
Use commands or ask naturally:
• `/today` - Today's events
• `/tomorrow` - Tomorrow's events
• `/week` - This week's events
• "What are my plans for next Tuesday?"
• "Show me this weekend"

*Tips:*
✓ Include date and time for events
✓ I'll summarize long descriptions
✓ All events use your calendar's timezone
✓ You'll see a confirmation before I create events

Need help? Check the README or contact support.
```

## Success Criteria
- All authorized messages are processed
- Unauthorized users are blocked
- Intent classification is accurate (>95%)
- Errors are handled gracefully
- User receives helpful feedback
- All interactions are logged

## Performance Targets
- Command response time: < 500ms
- Event creation (end-to-end): < 3 seconds
- Event query (end-to-end): < 2 seconds
- Bot uptime: > 99%

## Monitoring

### Health Checks
Periodic checks (every 5 minutes):
- Telegram bot connection: OK/FAIL
- Google Calendar API: OK/FAIL
- Gemini API: OK/FAIL
- Log to `.tmp/bot_logs/health.log`

### Metrics to Track
- Messages per day
- Events created per day
- Queries per day
- Error rate by type
- Average response time

## Learned Behaviors
(Update this section as you learn from real usage)

### Common User Patterns
- TBD after initial use

### Classification Improvements
- TBD after testing

### New Features Added
- TBD as bot evolves
