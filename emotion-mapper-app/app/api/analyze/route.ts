import { NextRequest, NextResponse } from 'next/server';
import IORedis from 'ioredis';

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
  // Robust fetch with timeout + retries + simple fallback
  const url = 'https://api-inference.huggingface.co/models/bhadresh-savani/distilbert-base-uncased-emotion';
  const MAX_RETRIES = 3;
  const BASE_DELAY = 400; // ms

  // small in-invocation cache to avoid duplicate calls within same request
  const localCache = (classifyEmotion as any)._cache ||= new Map<string, { label: string; score: number; allScores: { label: string; score: number }[] }>();
  if (localCache.has(text)) return localCache.get(text)!;

  // Try shared Redis cache first (if enabled)
  const cacheKey = `hf_cache:${Buffer.from(text).toString('base64')}`;
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        localCache.set(text, parsed);
        return parsed;
      }
    } catch (e) {
      console.warn('[api/analyze] redis get failed', e);
    }
  }

  const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000 + attempt * 2000); // increase timeout on retries
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: text, parameters: { return_all_scores: true } }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        const status = res.status;
        // retry on transient errors
        if ([429, 502, 503, 504].includes(status) && attempt < MAX_RETRIES) {
          const delay = BASE_DELAY * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
          console.warn(`[api/analyze] HF transient ${status} (attempt ${attempt}), retrying in ${delay}ms`);
          await sleep(delay);
          continue;
        }
        throw new Error(`HF status ${status}: ${errBody}`);
      }

      const data = await res.json();
      const scores: { label: string; score: number }[] = Array.isArray(data[0]) ? data[0] : data;
      if (!Array.isArray(scores) || scores.length === 0) throw new Error('Invalid HF response');
      scores.sort((a, b) => b.score - a.score);
      const out = { label: scores[0].label, score: scores[0].score, allScores: scores };
      localCache.set(text, out);
      // store in Redis for shared caching (ttl 1 day) and increment hf call metric
      if (redis) {
        try {
          await redis.set(cacheKey, JSON.stringify(out), 'EX', 60 * 60 * 24);
          await redis.incr('metrics:hf_calls');
        } catch (e) {
          console.warn('[api/analyze] redis set/incr failed', e);
        }
      }
      return out;
    } catch (err) {
      clearTimeout(timeout);
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[api/analyze] HF attempt ${attempt} failed:`, msg);
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
        await sleep(delay);
        continue;
      }
      // after retries, throw to let caller handle fallback
      throw new Error(msg || 'fetch failed');
    }
  }
  // unreachable
  throw new Error('unreachable');
}

// Simple fallback classifier (keyword-based) used if HF is unavailable.
function fallbackClassify(text: string) {
  const t = text.toLowerCase();
  const buckets: [string[], string][] = [
    [['angry','furious','outrage','ridiculous','frustrat','hate','broken','ignored','refund'], 'anger'],
    [['love','in love','ador','amazing','recommend','delighted','gorgeous','fantastic'], 'love'],
    [['sad','sadness','unhappy','disappointed','let down','sorry','apolog'], 'sadness'],
    [['scared','fear','afraid','concern','worry','secure','security'], 'fear'],
    [['surpris','surprised','unexpected','wow','shock','surprise'], 'surprise'],
    [['happy','great','good','pleased','satisfied','enjoy'], 'joy'],
  ];
  for (const [words, label] of buckets) {
    for (const w of words) if (t.includes(w)) return { label, score: 0.6, allScores: [{ label, score: 0.6 }] };
  }
  return { label: 'unknown', score: 0.25, allScores: [] };
}

// Optional Redis client for shared caching and telemetry. Set `REDIS_URL` in env to enable.
const redisUrl = process.env.REDIS_URL ?? '';
let redis: any = null;
if (redisUrl) {
  try {
    redis = new IORedis(redisUrl);
  } catch (e) {
    console.warn('[api/analyze] failed to initialize Redis', e);
    redis = null;
  }
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
    const BATCH = 10;
    const results: any[] = [];

    for (let i = 0; i < messages.length; i += BATCH) {
      const chunk = messages.slice(i, i + BATCH);
      const chunkResults = await Promise.all(
        chunk.map(async (msg, idx) => {
          const trimmed = (msg ?? '').toString().trim();
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
            // increment fallback telemetry
            if (redis) {
              try {
                await redis.incr('metrics:fallbacks');
              } catch (e) {
                console.warn('[api/analyze] redis incr fallback failed', e);
              }
            }
            const fb = fallbackClassify(trimmed.slice(0, 512));
            const cfg = EMOTION_CONFIG[fb.label.toLowerCase()] ?? DEFAULT_CONFIG;
            return {
              id: i + idx,
              message: msg,
              emotion: fb.label.toLowerCase(),
              confidence: Math.round(fb.score * 100),
              allScores: fb.allScores.map(s => ({ label: s.label, score: Math.round(s.score * 100) })),
              ...cfg,
              analysisError: errMsg,
              fallback: true,
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
