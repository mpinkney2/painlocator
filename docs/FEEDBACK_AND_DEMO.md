# Feedback & environment setup

## Client environment variables

Set these at build/runtime via `window` injection or a small config script if needed:

| Variable | Purpose | Default |
|----------|---------|---------|
| `PAINLOCATOR_FEEDBACK_ENDPOINT` | Absolute URL for feedback POST (optional; defaults to `/api/feedback`) | `/api/feedback` |
| `PAINLOCATOR_ANALYTICS_ENDPOINT` | Optional analytics beacon URL | unset (analytics off) |
| `PAINLOCATOR_ANALYTICS_FORCE_OFF` | Force-disable analytics | unset |

Enable client analytics locally: `localStorage.setItem('painlocator_analytics_enabled', '1')`.

Analytics never includes pain values, symptoms, notes, regions, or identifiers.

## Server (Vercel) environment variables

Configure in the Vercel project settings:

| Variable | Required | Purpose |
|----------|----------|---------|
| `FEEDBACK_WEBHOOK_URL` | No | Destination webhook (Slack/Discord/custom) for feedback payloads |
| `FEEDBACK_MAX_BODY` | No | Max request body bytes (default `12000`) |
| `FEEDBACK_ALLOWED_ORIGIN` | No | CORS `Access-Control-Allow-Origin` (default request origin / `*`) |

Secrets must never be embedded in client JavaScript.

## Feedback request payload

`POST /api/feedback` with `Content-Type: application/json`:

```json
{
  "type": "general|bug|feature|clinical|accessibility|demo",
  "rating": 1,
  "tryingToDo": "string",
  "workedWell": "string",
  "confusing": "string",
  "improve": "string",
  "email": "optional@example.com",
  "role": "patient",
  "canContact": false,
  "interviewOptIn": false,
  "diagnostics": {
    "route": "/",
    "appVersion": "5.4.0",
    "userAgent": "...",
    "platform": "...",
    "language": "en",
    "viewport": { "w": 1280, "h": 800 },
    "demoMode": false,
    "lastAction": { "name": "save_entry", "at": "ISO-8601" },
    "errorId": null
  }
}
```

Diagnostics are included for bug reports only and never contain clinical notes or anatomy data.

## Local fallback

If the endpoint is unreachable, the client downloads a JSON feedback file and attempts to copy it to the clipboard. Users can email that file manually.

## Demo Mode

1. Click **Demo** in the header or **Try the demo** on the welcome screen.
2. Explore Capture → Review → Clinical Report with fictional data.
3. Use **Demo scenario** to switch among Post-procedure, Lower-back, and Sports injury.
4. **Reset Demo** reseeds the active scenario; **Exit Demo** restores real local data.

Demo storage key: `painlocator_demo_entries` (never merges with `painlocator_pain_entries`).
