import { NextResponse } from 'next/server';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL ?? '';
let redis: any = null;
if (redisUrl) {
  try {
    redis = new IORedis(redisUrl);
  } catch (e) {
    console.warn('[api/metrics] failed to init redis', e);
    redis = null;
  }
}

export async function GET() {
  try {
    if (!redis) return NextResponse.json({ redis: false });

    const [hfCalls, fallbacks, cacheHits, recent] = await Promise.all([
      redis.get('metrics:hf_calls').catch(() => null),
      redis.get('metrics:fallbacks').catch(() => null),
      redis.get('metrics:cache_hits').catch(() => null),
      redis.lrange('metrics:recent', 0, 49).catch(() => []),
    ]);

    const recentParsed = Array.isArray(recent)
      ? recent.map((r: string) => {
          try { return JSON.parse(r); } catch { return r; }
        })
      : [];

    return NextResponse.json({
      redis: true,
      hf_calls: hfCalls ? Number(hfCalls) : 0,
      fallbacks: fallbacks ? Number(fallbacks) : 0,
      cache_hits: cacheHits ? Number(cacheHits) : 0,
      recent: recentParsed,
    });
  } catch (err) {
    console.error('[/api/metrics]', err);
    return NextResponse.json({ error: 'failed to read metrics' }, { status: 500 });
  }
}
