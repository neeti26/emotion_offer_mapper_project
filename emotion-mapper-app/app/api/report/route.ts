import { NextRequest, NextResponse } from 'next/server';

function csvEscape(s: string) {
  if (s == null) return '';
  return `"${String(s).replace(/"/g, '""')}"`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const results = Array.isArray(body.results) ? body.results : [];
    const topN = typeof body.topN === 'number' ? Math.max(1, Math.floor(body.topN)) : 25;

    // Summary
    const total = results.length;
    const avgConfidence = total ? Math.round(results.reduce((s:any,r:any)=>s+(r.confidence||0),0)/total) : 0;
    const emotionCounts: Record<string, number> = {};
    for (const r of results) emotionCounts[r.emotion] = (emotionCounts[r.emotion]||0) + 1;

    const summaryRows = [
      ['Metric','Value'],
      ['Total messages', String(total)],
      ['Avg confidence (%)', String(avgConfidence)],
    ];
    for (const [em, c] of Object.entries(emotionCounts)) summaryRows.push([`Count: ${em}`, String(c)]);

    // Low confidence rows
    const low = results.slice().sort((a:any,b:any)=> (a.confidence||0) - (b.confidence||0)).slice(0, topN);
    const detailHeader = ['ID','Message','Emotion','Confidence (%)','Priority','Offer','Action'];

    // Build CSV: summary, blank line, details
    const parts: string[] = [];
    parts.push(...summaryRows.map(r => r.map(csvEscape).join(',')));
    parts.push('');
    parts.push(detailHeader.join(','));
    for (const r of low) {
      parts.push([
        String((r.id ?? 0) + 1),
        csvEscape(r.message ?? ''),
        csvEscape(r.emotion ?? ''),
        String(r.confidence ?? 0),
        csvEscape(r.priority ?? ''),
        csvEscape(r.offer ?? ''),
        csvEscape(r.action ?? ''),
      ].join(','));
    }

    const csv = parts.join('\n');
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="emotioniq_report.csv"',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
