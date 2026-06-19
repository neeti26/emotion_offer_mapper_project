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
```

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
