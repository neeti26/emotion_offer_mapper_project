import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Redis disabled per configuration — report false
    return NextResponse.json({ redis: false });
  } catch (err) {
    console.error('[/api/metrics]', err);
    return NextResponse.json({ error: 'failed to read metrics' }, { status: 500 });
  }
}
