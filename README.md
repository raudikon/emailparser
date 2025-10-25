## Email Parser & Instagram Caption Generator

This project implements the app described in `spec.md`: a small platform for schools to ingest forwarded emails, transform them into AI-generated Instagram captions, and review the results in a dashboard.

The repository is split into two packages:

- `server/`: Node.js + Express API that receives Mailgun webhooks, persists parsed emails to Supabase, and schedules daily Claude-powered caption generation.
- `client/`: React dashboard (Vite) that lets authenticated users review ingested emails and ready-to-post captions.

---

### 1. Prerequisites

- Node.js 20+
- Supabase project (PostgreSQL) with the SQL schema below applied.
- Mailgun domain configured to forward emails to the webhook endpoint.
- Claude API key (Anthropic) for caption generation.

---

### 2. Environment Variables

Copy the sample environment files and fill in your credentials:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

> The backend loader looks for `.env` files in `server/.env` first and then the project root `.env`, so you can keep a single shared file if you prefer.

Populate at minimum:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `DATABASE_URL` (Postgres connection string, used by the migration runner)
- `CLAUDE_API_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL`

> The server expects a Supabase service role key so it can verify sessions and perform CRUD. The client uses the anon key to handle Supabase Auth flows in the browser and forwards the user session token to the API automatically.

---

### 3. Database Migrations

The migration runner uses your `DATABASE_URL`. From the repository root:

```sql
# ensure pgcrypto is enabled once in your database
create extension if not exists pgcrypto;
```

Then execute:

```bash
cd server
npm install         # first time only
npm run migrate
```

The initial migration (`db/migrations/001_initial.sql`) creates:

- `emails`
- `parsed_email_content`
- `ai_generated_posts`
- `schema_migrations` (tracks applied migrations)

---

### 4. Install Dependencies

```bash
cd server && npm install
cd ../client && npm install
```

You can keep both dev servers running simultaneously:

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev
```

The Vite dev server proxies `/api/*` to the backend using `VITE_API_BASE_URL`.

---

### 5. Mailgun Webhook

Configure Mailgun to POST incoming/forwarded messages to:

```
POST https://<your-domain>/api/webhooks/mailgun
```

The route parses MIME payloads, stores the email row, and generates inline data URLs for image attachments. Replace the inline storage with Supabase Storage (or another CDN) when you are ready for production.

---

### 6. Daily Caption Job

The server schedules a daily cron job (default `0 22 * * *`, 10pm UTC). It:

1. Fetches all emails received today.
2. Sends the content to Claude (`generateInstagramCaptions`).
3. Stores three new rows in `ai_generated_posts`.

Adjust the cadence with the `DAILY_CRON` and `CRON_TIMEZONE` env vars.

---

### 7. Frontend Dashboard

The React app includes:

- Forwarded email table (subject, sender, recipient, received timestamp, parsed status).
- AI post cards (caption text + suggested imagery).
- Built-in Supabase email/password authentication (sign up / sign in). Sessions automatically hydrate API requests and persist across refreshes.

Just ensure the anon key and REST URL are exposed via `client/.env`. The UI will prompt users to sign in or create an account; once authenticated, it fetches live data from your running API.

---

### 8. Next Steps

- Wire up production-ready Supabase Auth (custom domains, branding, password reset flows).
- Swap inline data URLs for real image hosting.
- Add background job monitoring and retry handling.
- Extend notifications (email/slack) when daily posts are ready.
