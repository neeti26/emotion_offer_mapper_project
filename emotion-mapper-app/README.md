# EmotionIQ 🧠

**AI-powered customer emotion detection & offer intelligence platform.**

Analyzes customer messages in real time using DistilBERT, detects 6 emotions (joy, anger, sadness, fear, love, surprise), and recommends personalized offers, priorities, and CX actions.

---

## Features

- **Single message** analysis with confidence scores and all emotion breakdowns
- **Batch CSV upload** — drag & drop up to 500 rows, export results as CSV or JSON
- **Critical alerts** — automatically surfaces angry/high-risk messages
- **Live charts** — bar + donut breakdown of emotion distribution
- **REST API** — `POST /api/analyze` for integration with any backend
- **Zero model hosting** — uses HuggingFace Inference API (serverless-friendly)

---

## Live Demo

Deploy to Vercel in 3 minutes — see below.

---

## Tech Stack

| Layer    | Technology |
|----------|-----------|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| Charts   | Recharts |
| CSV      | PapaParse |
| AI Model | `bhadresh-savani/distilbert-base-uncased-emotion` via HuggingFace Inference API |
| Deploy   | Vercel (serverless) |

---

## Deploy to Vercel

### 1. Get a HuggingFace token (free)

1. Go to [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Create a **Read** token (free tier is sufficient)

### 2. Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

**Or via CLI:**

```bash
npm i -g vercel
vercel
```

When prompted, add the environment variable:

```
HF_TOKEN = your_huggingface_token_here
```

Or set it in the Vercel dashboard under **Settings → Environment Variables**.

### Optional: Shared Redis + Telemetry

This project can optionally use a Redis instance for shared caching and simple telemetry counters (`metrics:hf_calls`, `metrics:fallbacks`). Set `REDIS_URL` in your production environment (see `.env.example`).

Recommended: use a managed provider such as Upstash and add `REDIS_URL` to Vercel **Settings → Environment Variables**.

When Redis is configured, the server will:
- Cache HF responses for 24 hours to reduce inference cost and latency
- Increment `metrics:hf_calls` each time a HF call result is cached
- Increment `metrics:fallbacks` each time the local keyword fallback is used

Additional telemetry recorded when Redis is enabled:
- `metrics:cache_hits` — times a cached result was returned (reduces HF calls)
- `metrics:recent` — list of recent cached sample entries (up to 50 entries)

You can view metrics via the included dashboard at `/metrics` or call `GET /api/metrics`.

### Enabling automated deploys (CI → Vercel)

The included GitHub Actions workflow builds the app on push/PR. To enable automatic deploys from CI, add the following repository secrets in GitHub and uncomment the deploy step in `.github/workflows/ci.yml`:

- `VERCEL_TOKEN` — Vercel personal token (keep secret)
- `VERCEL_ORG_ID` — Vercel organization id
- `VERCEL_PROJECT_ID` — Vercel project id

After adding these, uncomment the `deploy` job in the workflow. The CI deploys will then run `vercel --prod` using the provided token.
---

## Local Development

```bash
# 1. Clone
git clone <your-repo>
cd emotion-mapper-app

# 2. Install
npm install

# 3. Set env
echo "HF_TOKEN=your_token_here" > .env.local

# 4. Run
npm run dev
# → http://localhost:3000
```

---

## API Reference

### `POST /api/analyze`

**Request:**
```json
{
  "messages": ["I'm really frustrated!", "This product is amazing!"]
}
echo "HF_TOKEN=your_token_here" > .env.local
# (optional) add Redis for local testing
# echo "REDIS_URL=redis://localhost:6379" >> .env.local

**Response:**
```json
{
  "total": 2,
  "avgConfidence": 91,
  "emotionCounts": { "anger": 1, "joy": 1 },
  "results": [
    {
      "id": 0,
      "message": "I'm really frustrated!",
      "emotion": "anger",
      "confidence": 94,
      "emoji": "😡",
      "offer": "Free priority consultation to resolve your concerns",
      "priority": "critical",
      "action": "Immediate escalation",
      "color": "#ef4444",
      "allScores": [
        { "label": "anger", "score": 94 },
        { "label": "sadness", "score": 3 }
      ]
    }
  ]
}
```

**Limits:** Max 500 messages per request.

### `GET /api/metrics`

Returns lightweight telemetry when Redis is enabled. Response example:

```json
{
  "hf_calls": 123,
  "fallbacks": 4,
  "redis": true
}
```

If Redis is not configured, the endpoint returns `{ redis: false }`.
---

## Emotion → Offer Map

| Emotion  | Offer | Priority |
|----------|-------|----------|
| joy      | 30% off premium plans | low |
| anger    | Free priority consultation | critical |
| sadness  | Personalized coupon + apology | high |
| fear     | Extended 60-day return guarantee | high |
| love     | Loyalty rewards + early access | low |
| surprise | Flash sale + freebie | medium |

---

## License

MIT
