"use client";
import React, { useEffect, useState } from 'react';

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch('/api/metrics')
      .then(res => res.json())
      .then(data => {
        if (!mounted) return;
        if (data.error) setError(data.error);
        else setMetrics(data);
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)));
    return () => { mounted = false; };
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ marginBottom: 12 }}>Telemetry & Metrics</h1>
      {error && <div style={{ color: 'red' }}>Error: {error}</div>}
      {!metrics && !error && <div>Loading metrics…</div>}
      {metrics && (
        <div>
          <p>Redis enabled: <strong>{String(metrics.redis)}</strong></p>
          <p>HF cached calls: <strong>{metrics.hf_calls ?? 0}</strong></p>
          <p>Fallbacks: <strong>{metrics.fallbacks ?? 0}</strong></p>
          <p style={{ marginTop: 12, color: '#666' }}>Note: counters increment when Redis is configured.</p>
        </div>
      )}
    </div>
  );
}
