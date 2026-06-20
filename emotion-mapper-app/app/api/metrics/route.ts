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

    const [hfCalls, fallbacks] = await Promise.all([
      redis.get('metrics:hf_calls').catch(() => null),
      redis.get('metrics:fallbacks').catch(() => null),
    ]);

    return NextResponse.json({
      redis: true,
      hf_calls: hfCalls ? Number(hfCalls) : 0,
      fallbacks: fallbacks ? Number(fallbacks) : 0,
    });
  } catch (err) {
    console.error('[/api/metrics]', err);
    return NextResponse.json({ error: 'failed to read metrics' }, { status: 500 });
  }
}
