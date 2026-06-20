import { NextRequest, NextResponse } from 'next/server';
import IORedis from 'ioredis';
// Simple in-memory progress store for short-lived progress polling
const progressMap: Map<string, { total: number; processed: number; updatedAt: number }> = new Map();

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
  // For quick local development or debugging, set SKIP_HF=1 to force keyword fallback immediately.
  if (process.env.SKIP_HF === '1') {
    return fallbackClassify(text);
  }
  // Robust fetch with timeout + retries + smarter fallback
  const url = process.env.HF_API_URL ?? 'https://api-inference.huggingface.co/models/bhadresh-savani/distilbert-base-uncased-emotion';
  const MAX_RETRIES = 5;
  const BASE_DELAY = 500; // ms

  // small in-memory cache (shared across invocations in this server instance) to avoid duplicate calls
  const cacheObj = (classifyEmotion as any)._cache ||= { map: new Map<string, { label: string; score: number; allScores: { label: string; score: number }[] }>(), order: [] as string[] };
  const localCache = cacheObj.map;
  // cap cache size to avoid unbounded memory growth
  const CACHE_MAX = 500;
  if (localCache.has(text)) return localCache.get(text)!;

  // Try shared Redis cache first (if enabled)
  const cacheKey = `hf_cache:${Buffer.from(text).toString('base64')}`;
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        localCache.set(text, parsed);
        // telemetry: cache hit + record recent sample
        try {
          await redis.incr('metrics:cache_hits');
          const sample = JSON.stringify({ id: cacheKey, label: parsed.label ?? null, ts: Date.now() });
          await redis.lpush('metrics:recent', sample);
          await redis.ltrim('metrics:recent', 0, 49);
        } catch (e) {
          console.warn('[api/analyze] redis telemetry write failed', e);
        }
        return parsed;
      }
    } catch (e) {
      console.warn('[api/analyze] redis get failed', e);
    }
  }

  const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    // progressively increase timeout length on each attempt
    const timeoutMs = 8000 + (attempt - 1) * 4000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ inputs: text, parameters: { return_all_scores: true } }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        const status = res.status;
        // respect Retry-After header if present
        const ra = res.headers.get?.('retry-after');
        const retryAfter = ra ? Math.max(0, parseInt(ra, 10) * 1000) : null;
        // retry on transient errors
        if (([429, 502, 503, 504].includes(status) || status === 0) && attempt < MAX_RETRIES) {
          const base = BASE_DELAY * Math.pow(2, attempt - 1);
          const jitter = Math.floor(Math.random() * 300);
          const delay = retryAfter ?? (base + jitter);
          console.warn(`[api/analyze] HF transient ${status} (attempt ${attempt}), retrying in ${delay}ms`);
          await sleep(delay);
          continue;
        }
        console.error('[api/analyze] HF non-retryable response', { status, body: errBody });
        throw new Error(`HF status ${status}: ${errBody}`);
      }

      const data = await res.json();
      const scores: { label: string; score: number }[] = Array.isArray(data[0]) ? data[0] : data;
      if (!Array.isArray(scores) || scores.length === 0) throw new Error('Invalid HF response');
      scores.sort((a, b) => b.score - a.score);
      const out = { label: scores[0].label, score: scores[0].score, allScores: scores };
      // write to in-memory cache (cap size)
      try {
        localCache.set(text, out);
        cacheObj.order.push(text);
        if (cacheObj.order.length > CACHE_MAX) {
          const oldest = cacheObj.order.shift();
          if (oldest) localCache.delete(oldest);
        }
      } catch (e) {
        // ignore cache set errors
      }
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
    } catch (err: unknown) {
      clearTimeout(timeout);
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      console.error(`[api/analyze] HF attempt ${attempt} failed:`, msg);
      // transient network errors: Retry (TypeError often indicates fetch/network failure)
      const isTransient = typeof msg === 'string' && (
        msg.includes('AbortError') ||
        msg.toLowerCase().includes('fetch failed') ||
        msg.toLowerCase().includes('network') ||
        msg.toLowerCase().includes('ecconnreset') ||
        msg.toLowerCase().includes('ecconnrefused') ||
        msg.toLowerCase().includes('timeout')
      );
      if (attempt < MAX_RETRIES && isTransient) {
        const delay = BASE_DELAY * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500);
        await sleep(delay);
        continue;
      }
      // after retries, rethrow to let caller produce fallback
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
    const { messages, clientId }: { messages: string[]; clientId?: string } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array is required and must not be empty.' }, { status: 400 });
    }
    if (messages.length > 1000) {
      return NextResponse.json({ error: 'Maximum 1000 messages per request.' }, { status: 400 });
    }

    const hfToken = process.env.HF_TOKEN ?? '';
    const BATCH = parseInt(process.env.ANALYZE_BATCH_SIZE || '16', 10);
    const CONCURRENCY = parseInt(process.env.ANALYZE_CONCURRENCY || '3', 10);
    const results: any[] = [];

    // initialize progress tracking if clientId provided
    if (clientId) {
      progressMap.set(clientId, { total: messages.length, processed: 0, updatedAt: Date.now() });
    }

    // create chunks
    const chunks: string[][] = [];
    for (let i = 0; i < messages.length; i += BATCH) chunks.push(messages.slice(i, i + BATCH));

    // simple concurrency pool for chunk processing
    async function runWorker(poolIndex: number) {
      for (let i = poolIndex; i < chunks.length; i += CONCURRENCY) {
        const chunk = chunks[i];
        const baseIdx = i * BATCH;
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
              id: baseIdx + idx,
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
            // If fallback returns a reasonably confident label, surface it but don't mark analysisError to avoid alarming UI.
            const FB_CONF_THRESHOLD = 0.35; // 35% confidence
            const isGoodFallback = fb.label !== 'unknown' && (fb.score ?? 0) >= FB_CONF_THRESHOLD;
            return {
              id: i + idx,
              message: msg,
              emotion: fb.label.toLowerCase(),
              confidence: Math.round(fb.score * 100),
              allScores: fb.allScores.map(s => ({ label: s.label, score: Math.round(s.score * 100) })),
              ...cfg,
              ...(isGoodFallback ? { fallback: true } : { analysisError: errMsg, fallback: true }),
            };
          }
        })
        );
        results.push(...chunkResults.map((r:any, j:number)=> ({ ...r, id: baseIdx + j })));
        // update progress map after finishing this chunk
        if (clientId) {
          const e = progressMap.get(clientId);
          if (e) {
            e.processed = Math.min(e.total, e.processed + chunk.length);
            e.updatedAt = Date.now();
            progressMap.set(clientId, e);
          }
        }
      }
    }

    // launch workers
    const workers: Promise<void>[] = [];
    for (let w = 0; w < Math.min(CONCURRENCY, chunks.length); w++) workers.push(runWorker(w));
    await Promise.all(workers);

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

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get('clientId');
    if (!clientId) return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    const entry = progressMap.get(clientId);
    if (!entry) return NextResponse.json({ found: false, total: 0, processed: 0, percent: 0 });
    const percent = entry.total > 0 ? Math.round((entry.processed / entry.total) * 100) : 0;
    return NextResponse.json({ found: true, total: entry.total, processed: entry.processed, percent });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
