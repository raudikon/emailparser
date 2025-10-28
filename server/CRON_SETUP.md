# Cron Job Setup Guide

This document explains how to set up the daily Instagram caption generation cron job.

## Overview

The application generates Instagram captions from emails with images once per day. This can be triggered in two ways:

1. **External Cron (Recommended for Production)** - Platform cron jobs trigger an HTTP endpoint
2. **Internal node-cron (Development/Fallback)** - Built-in scheduler that runs while server is active

## Option 1: External Cron (Recommended)

### Required Environment Variables

Add to your `.env` file:

```bash
# Secret token for authenticating cron requests
CRON_SECRET=your-random-secret-here-generate-a-strong-token

# Claude API key (required for caption generation)
CLAUDE_API_KEY=sk-ant-your-key-here

# Mailgun configuration (for sending notification emails)
MAILGUN_API_KEY=your-mailgun-api-key-here
MAILGUN_DOMAIN=mg.yourdomain.com
NOTIFICATION_FROM_EMAIL=noreply@mg.yourdomain.com
NOTIFICATION_EMAIL=your-email@gmail.com

# Frontend URL (for links in notification emails)
FRONTEND_URL=https://your-app.com
```

**To get your Mailgun API key:**
1. Go to Mailgun Dashboard → Settings → API Keys
2. Copy your Private API key
3. Make sure your domain is verified

**Generate a strong CRON_SECRET:**
```bash
# On Mac/Linux:
openssl rand -hex 32

# Or use:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Endpoint Details

**URL:** `POST https://your-app.com/api/cron/generate-daily-posts`

**Headers:**
```
Authorization: Bearer <your-CRON_SECRET>
Content-Type: application/json
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Daily post generation completed",
  "organizations": [
    {
      "organization": "NYC Schools",
      "success": true,
      "captionsGenerated": 3,
      "emailsProcessed": 25,
      "imagesReviewed": 40
    }
  ],
  "totalCaptions": 3,
  "duration": 15234
}
```

### Setting Up on Render

1. **Go to your Render Dashboard**
2. **Navigate to your service** → **Cron Jobs** tab
3. **Click "Add Cron Job"**
4. **Configure:**
   - **Name:** Daily Instagram Caption Generation
   - **Command:**
     ```bash
     curl -X POST https://your-app-name.onrender.com/api/cron/generate-daily-posts \
       -H "Authorization: Bearer $CRON_SECRET" \
       -H "Content-Type: application/json"
     ```
   - **Schedule:** `0 17 * * *` (5pm UTC) or `0 21 * * *` (5pm EST)
   - **Region:** Same as your app

5. **Add CRON_SECRET to Render environment variables:**
   - Go to Environment → Add Environment Variable
   - Key: `CRON_SECRET`
   - Value: Your generated secret

### Testing the Endpoint Locally

```bash
# Set environment variable
export CRON_SECRET=your-secret-here

# Start your server
npm run dev

# In another terminal, trigger the cron:
curl -X POST http://localhost:3001/api/cron/generate-daily-posts \
  -H "Authorization: Bearer your-secret-here" \
  -H "Content-Type: application/json"
```

### Health Check Endpoint

Test if cron is properly configured:

```bash
curl -X GET https://your-app.com/api/cron/health \
  -H "Authorization: Bearer your-secret-here"
```

Response:
```json
{
  "status": "ok",
  "claudeConfigured": true,
  "timestamp": "2025-01-28T17:00:00.000Z"
}
```

## Option 2: Internal node-cron (Development/Fallback)

If you prefer to use the built-in scheduler (server must be running 24/7):

### Environment Variables

Add to your `.env`:

```bash
# Enable node-cron
ENABLE_NODE_CRON=true

# Schedule (cron expression)
DAILY_CRON=0 17 * * *

# Timezone for the schedule
CRON_TIMEZONE=America/New_York

# Claude API key
CLAUDE_API_KEY=sk-ant-your-key-here
```

### Cron Expression Format

```
 ┌────────────── minute (0-59)
 │ ┌──────────── hour (0-23)
 │ │ ┌────────── day of month (1-31)
 │ │ │ ┌──────── month (1-12)
 │ │ │ │ ┌────── day of week (0-7, Sunday = 0 or 7)
 │ │ │ │ │
 * * * * *
```

**Examples:**
- `0 17 * * *` - Every day at 5:00 PM
- `0 9 * * 1-5` - Weekdays at 9:00 AM
- `0 */6 * * *` - Every 6 hours

**Note:** The timezone setting affects when the cron runs. Use `America/New_York` for Eastern time.

## How It Works

1. **Cron triggers** at the scheduled time (5pm daily)
2. **Fetches all organizations** from the database
3. **For each organization:**
   - Fetches emails with images from the past 24 hours
   - Sends images and text to Claude vision model
   - Claude reviews all images and selects the 3-5 best ones
   - Generates Instagram captions for selected images
   - Stores caption + image + email associations in database
4. **Returns summary** of captions generated per organization

## Monitoring

### Check Logs

**Render Dashboard:**
- Go to your service → Logs tab
- Look for `[Cron]` prefixed messages

**Look for:**
```
[Cron] Starting daily post generation for 2025-01-28T17:00:00.000Z
[Cron] Processing 3 organizations...
[Cron][NYC Schools] Reviewing 25 emails with 40 images...
[Cron][NYC Schools] Stored 3 new caption+image combinations.
[Cron] Completed in 15234ms. Generated 3 captions.
```

## Email Notifications

When the cron job completes, it automatically sends an email notification with all the generated captions.

### Email Content

The notification email includes:
- **Subject:** Number of captions generated and organization name
- **Body:** All caption text in both plain text and formatted HTML
- **Link:** Direct link to dashboard to view posts with images
- **Summary:** Number of emails processed and images reviewed

### Example Email

```
Subject: 📱 3 New Instagram Captions Ready - NYC Schools

Hi there,

Your daily Instagram captions are ready for Monday, January 28, 2025!

We've generated 3 captions from today's emails:

1. Our preschoolers had a blast at the pumpkin patch! 🎃

2. Science Fair winners announced! Congratulations to all our young scientists! 🔬

3. Field day was a huge success! Thank you to all the volunteers! 🏃

View Posts & Images →
```

### Configuration

**Required Environment Variables:**
- `NOTIFICATION_EMAIL` - Where to send the notification (e.g., `you@gmail.com`)
- `MAILGUN_API_KEY` - Your Mailgun API key for sending
- `MAILGUN_DOMAIN` - Your Mailgun domain
- `NOTIFICATION_FROM_EMAIL` - From address (optional, defaults to `noreply@your-domain`)
- `FRONTEND_URL` - Your frontend URL for the "View Posts" link (optional)

### Disabling Notifications

If you don't set `NOTIFICATION_EMAIL`, the cron job will run but skip sending emails.

### Troubleshooting

**No captions generated:**
- Check if any emails with images were received that day
- Verify CLAUDE_API_KEY is set correctly
- Check Claude's selection - it may not find suitable images

**Authentication errors:**
- Verify CRON_SECRET matches between environment and cron command
- Check Authorization header format: `Bearer <secret>`

**Timeout errors:**
- Increase timeout if processing many images (Render default: 30s)
- Claude vision calls can take 5-10 seconds per batch

**Email not received:**
- Check NOTIFICATION_EMAIL is set correctly
- Verify MAILGUN_API_KEY and MAILGUN_DOMAIN are correct
- Check spam folder
- Look for error logs: "Failed to send notification email"
- Test Mailgun credentials in dashboard

## Cost Considerations

**Claude API Costs (claude-3-5-sonnet):**
- ~$0.003 per image reviewed
- With 30 emails × 1.5 images each = 45 images
- Daily cost: ~$0.14
- Monthly cost: ~$4.20

**Mailgun Sending (Notification Emails):**
- First 5,000 emails/month: Free
- After that: $0.80 per 1,000 emails
- 1 email/day = ~30 emails/month (well within free tier)

**Render Cron Jobs:**
- Free tier includes cron jobs
- Only charged for actual execution time

## Security

**CRON_SECRET:**
- Use a strong, random token (32+ characters)
- Never commit to git
- Rotate periodically
- Different secret per environment (dev/staging/prod)

**Endpoint Protection:**
- Only accepts requests with valid CRON_SECRET
- Returns 401 for invalid/missing tokens
- Logs failed authentication attempts
