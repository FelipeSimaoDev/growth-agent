# Growth Agent

Personal Reddit growth agent. Generates 1 Reddit post per day, sends Telegram notification for review, publishes on approval, collects metrics 24h later.

## Stack

- **Backend**: Node.js + Express + Supabase + OpenAI + Reddit API + Telegram Bot
- **Frontend**: Next.js + Tailwind CSS
- **Deploy**: Railway or Render

---

## Setup

### 1. Database

Run `backend/schema.sql` in your Supabase SQL editor.

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in all values in .env
npm install
npm run dev
```

### 3. Frontend

```bash
cd frontend
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_API_URL and NEXT_PUBLIC_API_KEY
npm install
npm run dev
```

---

## Reddit App Setup

1. Go to https://www.reddit.com/prefs/apps
2. Click **Create App**
3. Choose type: **script**
4. Set redirect URI to `http://localhost:8080` (unused but required)
5. Copy `client_id` (under the app name) and `client_secret`

---

## Telegram Bot Setup

1. Message [@BotFather](https://t.me/BotFather) → `/newbot`
2. Copy the token → `TELEGRAM_BOT_TOKEN`
3. Start a conversation with your bot
4. Visit `https://api.telegram.org/bot<TOKEN>/getUpdates` to find your `chat.id`
5. Set `TELEGRAM_CHAT_ID`

---

## How It Works

### Daily Flow
```
9 AM UTC → generate post → save as PENDING → Telegram notification
→ open dashboard → Approve or Regenerate
→ Approve → post published to Reddit
→ 24h later → metrics collected (upvotes + comments)
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/config` | Get app config |
| PUT | `/api/config` | Update app config |
| GET | `/api/daily-input/today` | Get today's input |
| POST | `/api/daily-input` | Save today's input |
| GET | `/api/posts` | List recent posts |
| GET | `/api/posts/pending` | Get pending post |
| POST | `/api/posts/generate` | Trigger manual generation |
| POST | `/api/posts/:id/approve` | Approve → publish |
| POST | `/api/posts/:id/regenerate` | Regenerate post |
| GET | `/api/metrics` | All posts + metrics |

All routes require header: `x-api-key: <your API_KEY>`

---

## Project Structure

```
growth-agent/
├── backend/
│   ├── schema.sql                  ← Run this in Supabase
│   ├── .env.example
│   └── src/
│       ├── index.js                ← Express app entry
│       ├── db/supabase.js          ← Supabase client
│       ├── middleware/auth.js      ← API key check
│       ├── services/
│       │   ├── openai.js           ← Post generation prompt
│       │   ├── reddit.js           ← Submit + fetch metrics
│       │   ├── telegram.js         ← Notifications
│       │   └── generator.js        ← Orchestration
│       ├── routes/
│       │   ├── config.js
│       │   ├── dailyInput.js
│       │   ├── posts.js
│       │   └── metrics.js
│       └── cron/
│           ├── generatePost.js     ← Daily 9 AM
│           └── collectMetrics.js   ← Hourly
└── frontend/
    ├── .env.local.example
    ├── lib/api.js                  ← API client
    └── app/
        ├── layout.jsx
        ├── page.jsx                ← Dashboard
        ├── config/page.jsx         ← App config editor
        └── metrics/page.jsx        ← Metrics view
```
