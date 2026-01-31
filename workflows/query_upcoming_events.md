# Workflow: Query Upcoming Events

## Objective
Retrieve and display upcoming events from Google Calendar based on user's time range query.

## Inputs
- Time range expression (text from Telegram)
  - Commands: `/today`, `/tomorrow`, `/week`
  - Natural language: "What's tomorrow?", "Show next week", "My plans for this weekend"
- User's timezone (from Google Calendar or default)

## Tools Required
1. `tools/parse_time_range.js` - Convert time expression to date range
2. `tools/query_calendar_events.js` - Fetch events from Google Calendar
3. `tools/format_events_message.js` - Format events for Telegram display

## Process Flow

### Step 1: Parse Time Range
- Call `parseTimeRange()` with user's query
- First check common shortcuts (today, tomorrow, week) - fast path
- For complex expressions, use Gemini to parse
- Output: start date, end date (ISO 8601 format)

### Step 2: Query Calendar Events
- Call `queryCalendarEvents()` with date range
- Fetch up to 10-50 events (depending on range)
- Sort by start time (ascending)
- Handle all-day and timed events

### Step 3: Format Events for Display
- Group events by date
- Format each event with:
  - Date header (📆 Today/Tomorrow/Day of week)
  - Time (⏰ for timed events, 🗓 for all-day)
  - Title (bold)
  - Description (truncated, italic)
  - Location if available (📍)
  - Link to Google Calendar

### Step 4: Send Formatted Message
- Send Markdown-formatted message to Telegram
- If no events found, send friendly message
- If too many events, indicate truncation

## Expected Outputs
- Formatted list of events with dates and times
- Clickable links to view in Google Calendar
- User-friendly "no events" message if calendar is empty

## Edge Cases

### No Events Found
**Scenario**: User queries a time range with no scheduled events
**Handling**:
- Return: "📅 No events scheduled for [time range]."
- Keep message friendly and concise

### Too Many Events
**Scenario**: Week query returns 50+ events
**Handling**:
- Limit to first 10-50 events
- Add note: "_Showing first N events. Use a more specific time range for complete results._"
- User can refine query

### All-Day Events
**Scenario**: Event has no specific time (birthday, vacation day)
**Handling**:
- Format differently: 🗓 instead of ⏰
- Display without time
- Group with same-day timed events

### Multi-Day Events
**Scenario**: Vacation from Mon-Fri
**Handling**:
- Google Calendar API returns as single event with date range
- Display with start and end dates
- Example: "🗓 Vacation (Jan 27 - Jan 31)"

### Recurring Events
**Scenario**: Weekly team meeting
**Handling**:
- `singleEvents: true` in API query expands recurring events
- Each occurrence appears as separate event in results
- Works transparently for user

### Ambiguous Time Expressions
**Scenario**: "Show me the weekend" (which weekend?)
**Handling**:
- parseTimeRange interprets as "this weekend" (upcoming Sat-Sun)
- Gemini provides confidence score
- If low confidence, include parsed interpretation in response

### Past Date Queries
**Scenario**: "What did I have yesterday?"
**Handling**:
- Allow past date queries (useful for reference)
- Query works same as future dates
- No special handling needed

## Query Shortcuts

### Fast Path (No AI needed)
- `/today` → Today's events
- `/tomorrow` → Tomorrow's events
- `/week` → This week's events (Mon-Sun)

These use parseTimeRange's quick shortcuts for instant response.

### AI Path (Gemini parsing)
- "What are my plans for next Monday?"
- "Show me this weekend's schedule"
- "Do I have anything on the 15th?"

## Success Criteria
- Correct date range interpretation
- All events in range are displayed
- Events are sorted chronologically
- Formatting is readable in Telegram
- Links to Google Calendar work
- Timezone is handled correctly

## Failure Recovery
- If parseTimeRange fails → Show error: "I couldn't understand that time range. Try 'today', 'tomorrow', or 'next week'."
- If Google Calendar API fails → Check auth, retry, then notify user
- If no network → Show error: "Couldn't connect to Google Calendar. Please check your connection."
- Log all failures for debugging

## Performance Optimization
- Common queries (today, tomorrow, week) bypass AI (< 100ms response)
- Cache Google Calendar auth token (avoid re-auth on every query)
- Limit event fetching to reasonable numbers (10-50)

## Learned Behaviors
(Update this section as you learn from real usage)

### Common Time Expressions Users Ask
- TBD after initial use

### Parsing Edge Cases Discovered
- TBD after testing

### Improvements Made
- TBD as workflow evolves
