import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const results = body.results;
    if (!Array.isArray(results)) return NextResponse.json({ error: 'results array required' }, { status: 400 });

    const headers = ['ID', 'Message', 'Emotion', 'Confidence (%)', 'Priority', 'Suggested Offer', 'Action'];
    const rows = results.map((r: any) => [
      r.id + 1,
      typeof r.message === 'string' ? r.message.replace(/"/g, '""') : '',
      r.emotion ?? '',
      r.confidence ?? 0,
      r.priority ?? '',
      typeof r.offer === 'string' ? r.offer.replace(/"/g, '""') : '',
      typeof r.action === 'string' ? r.action.replace(/"/g, '""') : '',
    ]);
    const csv = [headers, ...rows].map(r => r.map((c:any) => (typeof c === 'string' && c.includes(',') ? `"${c}"` : c)).join(',')).join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="emotioniq_results.csv"',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
