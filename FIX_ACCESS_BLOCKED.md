# Fix "Access Blocked" Error (Error 403)

Your Google OAuth app is in "Testing" mode and you need to add yourself as an authorized test user.

## Solution: Add Your Email as Test User

1. **Go to Google Cloud Console:**
   - Open [https://console.cloud.google.com/](https://console.cloud.google.com/)
   - Make sure you're in the correct project: **telegram-calendar-bot-485507**

2. **Navigate to OAuth Consent Screen:**
   - In the left sidebar, click: **APIs & Services** → **OAuth consent screen**
   - Or go directly: [https://console.cloud.google.com/apis/credentials/consent](https://console.cloud.google.com/apis/credentials/consent)

3. **Add Test User:**
   - Scroll down to the **Test users** section
   - Click **+ ADD USERS**
   - Enter your email: **oksana.shpack@gmail.com**
   - Click **SAVE**

4. **Verify Settings:**
   - Publishing status should be: **Testing**
   - User type should be: **External**
   - Test users should show: **oksana.shpack@gmail.com**

5. **Try Again:**
   - Restart your bot: `npm start`
   - Click the authorization URL
   - You should now be able to authorize!

---

## Alternative: Use Internal User Type (If You Have Google Workspace)

If you have a Google Workspace account (not a free Gmail account), you can set the user type to "Internal" instead:

1. Go to OAuth consent screen
2. Click **EDIT APP**
3. Change **User Type** to **Internal**
4. Click **SAVE**
5. No need to add test users - all users in your workspace can access it

---

## Why This Happens

Google requires apps to go through a verification process before they can be used by anyone. For personal apps like this:
- Keep it in **Testing** mode
- Add yourself as a test user
- No need to publish or verify (it's just for you!)

## After You Fix It

The authorization flow will work and you'll see a warning screen saying "Google hasn't verified this app" - that's normal! Just click:
1. **Continue** (or **Advanced** → **Go to Telegram Calendar Bot (unsafe)**)
2. Grant the Calendar permissions
3. Copy the authorization code
4. Paste it in your terminal

The bot will save the token and you won't need to do this again!
