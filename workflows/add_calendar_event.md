# Workflow: Add Calendar Event

## Objective
Parse natural language input from user and create a Google Calendar event.

## Inputs
- User message describing event (text from Telegram)
- User's timezone (from Google Calendar settings or default)

## Tools Required
1. `tools/parse_event_details.js` - Parse natural language into structured data
2. `tools/create_calendar_event.js` - Create event in Google Calendar

## Process Flow

### Step 1: Parse Event Details
- Call `parseEventDetails()` with user's message and timezone
- Gemini AI extracts:
  - Event title (summary)
  - Event description (AI-generated summary)
  - Date (YYYY-MM-DD)
  - Start time (HH:MM)
  - End time (HH:MM)
  - Confidence level (high/medium/low)
  - Any ambiguities or assumptions made

### Step 2: Validate Parsed Data
- Check if confidence level is acceptable (≥ 0.7 or "medium"/"high")
- Verify date is not in the past (warn if it is)
- Ensure end time is after start time
- If validation fails or confidence is low → Ask user for clarification

### Step 3: Show Confirmation
- Display parsed details to user in readable format
- Include date, time, title, description
- Highlight any ambiguities or assumptions
- Show inline buttons: ✅ Confirm | ❌ Cancel

### Step 4: Create Event (on confirmation)
- Call `createCalendarEvent()` with validated data
- Handle any API errors gracefully
- Return event details including Google Calendar link

### Step 5: Send Success Message
- Confirm event creation to user
- Include clickable link to view in Google Calendar
- Show event summary with date/time

## Expected Outputs
- Calendar event created in Google Calendar
- Confirmation message sent to user with event link
- Event logged to `.tmp/bot_logs/`

## Edge Cases

### Ambiguous Dates
**Scenario**: "Next Thursday" when today is Thursday
**Handling**:
- Gemini marks confidence as "low"
- Bot shows interpreted date and asks for confirmation
- User can confirm or provide clarification

### Missing Time
**Scenario**: "Meeting with John tomorrow"
**Handling**:
- Gemini estimates reasonable time (e.g., 9am-10am for "morning", 2pm-3pm default)
- Shows assumption in confirmation message
- User can edit before confirming

### Past Dates
**Scenario**: "Meeting last Tuesday"
**Handling**:
- parseEventDetails flags this in ambiguities
- Show warning message: "⚠️ This date appears to be in the past"
- Require explicit confirmation before creating

### Invalid Dates
**Scenario**: "February 30th", unparseable text
**Handling**:
- Gemini or validation catches this
- Return error to user: "I couldn't understand that date. Please try again."
- Provide example format

### API Rate Limits
**Scenario**: Gemini free tier limit hit (15/min or 1500/day)
**Handling**:
- gemini_client.js automatically retries with exponential backoff
- If all retries fail, show user-friendly error
- Log error and suggest trying again later

### Google Calendar API Errors
**Scenario**: OAuth token expired, network error
**Handling**:
- google_auth.js automatically refreshes expired tokens
- For network errors, retry once
- If still failing, show error: "Couldn't connect to Google Calendar. Please try again."

## Success Criteria
- Event appears in Google Calendar with correct:
  - Date and time in user's timezone
  - Title matches user's intent
  - Description summarizes user's message
- User receives confirmation with working calendar link
- No duplicate events created

## Failure Recovery
- If Gemini fails → Retry once, then show error message
- If Calendar API fails → Check auth, retry, then notify user
- If user cancels → Acknowledge and discard event data
- Log all failures for debugging

## Learned Behaviors
(Update this section as you learn from real usage)

### Common Patterns Discovered
- TBD after initial use

### Tricky Inputs Successfully Handled
- TBD after testing

### Improvements Made
- TBD as workflow evolves
