import { NextRequest, NextResponse } from 'next/server';

// Emotion → color, emoji, offer mapping
export const EMOTION_CONFIG: Record<string, {
  color: string;
  emoji: string;
  offer: string;
  priority: string;
  action: string;
}> = {
  joy: {
    color: '#22c55e',
    emoji: '😊',
    offer: '30% off on premium plans — celebrate with us!',
    priority: 'low',
    action: 'Upsell opportunity',
  },
  anger: {
    color: '#ef4444',
    emoji: '😡',
    offer: 'Free priority consultation to resolve your concerns',
    priority: 'critical',
    action: 'Immediate escalation',
  },
  sadness: {
    color: '#3b82f6',
    emoji: '😢',
    offer: 'Personalized 20% coupon + handwritten apology note',
    priority: 'high',
    action: 'Retention outreach',
  },
  fear: {
    color: '#a855f7',
    emoji: '😨',
    offer: 'Extended 60-day return guarantee — zero risk promise',
    priority: 'high',
    action: 'Trust rebuilding',
  },
  love: {
    color: '#ec4899',
    emoji: '❤️',
    offer: 'Exclusive loyalty rewards + early access to new features',
    priority: 'low',
    action: 'Brand ambassador program',
  },
  surprise: {
    color: '#f59e0b',
    emoji: '😮',
    offer: 'Flash sale access + exclusive freebie just for you',
    priority: 'medium',
    action: 'Engagement campaign',
  },
};

const DEFAULT_CONFIG = {
  color: '#6b7280',
  emoji: '💬',
  offer: 'Universal 10% off on any plan — our thanks to you',
  priority: 'low',
  action: 'General outreach',
};

// Call HuggingFace Inference API
async function classifyEmotion(text: string, hfToken: string): Promise<{
  label: string;
  score: number;
  allScores: { label: string; score: number }[];
}> {
  const response = await fetch(
    'https://api-inference.huggingface.co/models/bhadresh-savani/distilbert-base-uncased-emotion',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: text,
        parameters: { return_all_scores: true },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`HuggingFace API error ${response.status}: ${err}`);
  }

  const data = await response.json();

  // HF returns [[{label, score}, ...]] for batch; [{ label, score}...] for single
  const scores: { label: string; score: number }[] = Array.isArray(data[0])
    ? data[0]
    : data;

  scores.sort((a, b) => b.score - a.score);
  return { label: scores[0].label, score: scores[0].score, allScores: scores };
}

/* ── POST /api/analyze ── */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages }: { messages: string[] } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array is required and must not be empty.' }, { status: 400 });
    }
    if (messages.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 messages per request.' }, { status: 400 });
    }

    const hfToken = process.env.HF_TOKEN ?? '';
    if (!hfToken) {
      return NextResponse.json(
        { error: 'HuggingFace API token not configured. Set HF_TOKEN in environment variables.' },
        { status: 500 }
      );
    }

    // Process in parallel batches of 10 to respect rate limits
    const BATCH = 10;
    const results = [];

    for (let i = 0; i < messages.length; i += BATCH) {
      const chunk = messages.slice(i, i + BATCH);
      const chunkResults = await Promise.all(
        chunk.map(async (msg, idx) => {
          const trimmed = String(msg ?? '').trim();
          if (!trimmed) {
            return {
              id: i + idx,
              message: msg,
              emotion: 'unknown',
              confidence: 0,
              allScores: [],
              ...DEFAULT_CONFIG,
            };
          }
          try {
            const { label, score, allScores } = await classifyEmotion(trimmed.slice(0, 512), hfToken);
            const cfg = EMOTION_CONFIG[label.toLowerCase()] ?? DEFAULT_CONFIG;
            return {
              id: i + idx,
              message: msg,
              emotion: label.toLowerCase(),
              confidence: Math.round(score * 100),
              allScores: allScores.map(s => ({ label: s.label, score: Math.round(s.score * 100) })),
              ...cfg,
            };
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error('[api/analyze] classify error', { message: trimmed, err: errMsg });
            return {
              id: i + idx,
              message: msg,
              emotion: 'error',
              confidence: 0,
              allScores: [],
              ...DEFAULT_CONFIG,
              offer: 'Unable to analyze — please retry',
              analysisError: errMsg,
            };
          }
        })
      );
      results.push(...chunkResults);
    }

    // Aggregated stats
    const emotionCounts: Record<string, number> = {};
    for (const r of results) {
      emotionCounts[r.emotion] = (emotionCounts[r.emotion] ?? 0) + 1;
    }
    const avgConfidence = results.length
      ? Math.round(results.reduce((s, r) => s + r.confidence, 0) / results.length)
      : 0;

    return NextResponse.json({ results, emotionCounts, avgConfidence, total: results.length });
  } catch (err: unknown) {
    console.error('[/api/analyze]', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
