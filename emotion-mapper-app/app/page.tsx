'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, RadialBarChart, RadialBar,
} from 'recharts';
import {
  Upload, Zap, Download, AlertCircle, Brain,
  Target, TrendingUp, Users, ChevronDown, ChevronUp,
  Copy, RefreshCw, FileText, Search, Filter,
  CheckCircle2, LayoutDashboard, Inbox, BarChart2,
  Settings, ChevronRight, AlertTriangle, Activity,
  ArrowUpRight, Minus, X,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AnalysisResult {
  id: number;
  message: string;
  emotion: string;
  confidence: number;
  allScores: { label: string; score: number }[];
  color: string;
  emoji: string;
  offer: string;
  priority: string;
  action: string;
}

interface ApiResponse {
  results: AnalysisResult[];
  emotionCounts: Record<string, number>;
  avgConfidence: number;
  total: number;
  error?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const EMOTION_COLOR: Record<string, string> = {
  joy: '#22c55e', anger: '#ef4444', sadness: '#3b82f6',
  fear: '#a855f7', love: '#ec4899', surprise: '#f59e0b',
};

const PRI_CLASS: Record<string, string> = {
  critical: 'pri-critical', high: 'pri-high', medium: 'pri-medium', low: 'pri-low',
};

const SAMPLES = [
  "I'm absolutely furious — my order arrived broken and customer service ignored me for 3 days!",
  "Just received my package and I'm genuinely in love with this product. 10/10, will recommend!",
  "Honestly a bit scared to renew — not sure if my data is secure after last month's incident.",
  "This is the third time this week the app has crashed. I'm at my limit.",
  "Wow, you surprised me with that birthday discount! Really unexpected and lovely touch.",
  "Feeling let down. I expected premium quality but this feels like a budget product.",
];

// ── Sidebar ────────────────────────────────────────────────────────────────────

function Sidebar({ view, setView, total, critical }: {
  view: string; setView: (v: string) => void;
  total: number; critical: number;
}) {
  const nav = [
    { id: 'analyze',   icon: <Inbox size={15} />,        label: 'Analyze',    badge: undefined },
    { id: 'results',   icon: <LayoutDashboard size={15} />, label: 'Results',  badge: total > 0 ? String(total) : undefined },
    { id: 'insights',  icon: <BarChart2 size={15} />,     label: 'Insights',   badge: undefined },
  ];
  const alerts = critical > 0 ? [{ id: 'alerts', icon: <AlertTriangle size={15} />, label: 'Critical Alerts', badge: String(critical) }] : [];

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7, background: '#4f46e5',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Brain size={14} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', letterSpacing: '-0.01em' }}>EmotionIQ</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>CX Intelligence Platform</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '8px 8px', flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', color: 'var(--dim)', padding: '6px 8px 4px', textTransform: 'uppercase' }}>
          Workspace
        </div>
        {[...nav, ...alerts].map(item => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
              background: view === item.id ? 'rgba(99,102,241,0.12)' : 'transparent',
              border: 'none',
              color: view === item.id ? '#a5b4fc' : 'var(--muted)',
              fontWeight: view === item.id ? 600 : 400,
              fontSize: 13, marginBottom: 1, transition: 'all 0.12s',
            }}
            onMouseEnter={e => { if (view !== item.id) (e.currentTarget as HTMLButtonElement).style.background = 'var(--panel)'; }}
            onMouseLeave={e => { if (view !== item.id) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            <span style={{ color: view === item.id ? '#818cf8' : 'var(--dim)' }}>{item.icon}</span>
            <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
            {item.badge && (
              <span className={`badge ${item.id === 'alerts' ? 'pri-critical' : ''}`}
                style={item.id !== 'alerts' ? { background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontSize: 10 } : { fontSize: 10 }}>
                {item.badge}
              </span>
            )}
          </button>
        ))}

        <div style={{ height: 16 }} />
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', color: 'var(--dim)', padding: '6px 8px 4px', textTransform: 'uppercase' }}>
          Emotions
        </div>
        {Object.entries(EMOTION_COLOR).map(([em, color]) => (
          <div key={em} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 6, fontSize: 12, color: 'var(--muted)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ textTransform: 'capitalize' }}>{em}</span>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--dim)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
          DistilBERT · HuggingFace API
        </div>
      </div>
    </aside>
  );
}

// ── Topbar ─────────────────────────────────────────────────────────────────────

function Topbar({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 24px', borderBottom: '1px solid var(--border)',
      background: 'var(--surface)', flexShrink: 0,
    }}>
      <div>
        <h1 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', letterSpacing: '-0.01em' }}>{title}</h1>
        {sub && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{sub}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  );
}

// ── MetricCard ─────────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, trend, color }: {
  label: string; value: string | number; sub?: string;
  trend?: 'up' | 'down' | 'neutral'; color?: string;
}) {
  return (
    <div className="metric fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          {label}
        </span>
        {trend && (
          <span style={{ color: trend === 'up' ? '#4ade80' : trend === 'down' ? '#f87171' : 'var(--dim)', display: 'flex', alignItems: 'center' }}>
            {trend === 'up' ? <ArrowUpRight size={13} /> : trend === 'down' ? <ArrowUpRight size={13} style={{ transform: 'rotate(90deg)' }} /> : <Minus size={13} />}
          </span>
        )}
      </div>
      <div style={{ marginTop: 8, fontSize: 26, fontWeight: 700, color: color ?? 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

// ── ResultTable ────────────────────────────────────────────────────────────────

function ResultTable({ results, onClear }: { results: AnalysisResult[]; onClear: () => void }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<'confidence' | 'emotion' | 'priority'>('confidence');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const emotions = ['all', ...Array.from(new Set(results.map(r => r.emotion)))];

  const filtered = useMemo(() => {
    let r = results.filter(row =>
      (filter === 'all' || row.emotion === filter) &&
      row.message.toLowerCase().includes(search.toLowerCase())
    );
    r = [...r].sort((a, b) => {
      let av: string | number = 0, bv: string | number = 0;
      if (sortKey === 'confidence') { av = a.confidence; bv = b.confidence; }
      else if (sortKey === 'emotion') { av = a.emotion; bv = b.emotion; }
      else if (sortKey === 'priority') {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        av = order[a.priority as keyof typeof order] ?? 4;
        bv = order[b.priority as keyof typeof order] ?? 4;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return r;
  }, [results, filter, search, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: typeof sortKey }) => (
    <span style={{ opacity: sortKey === k ? 1 : 0.3, marginLeft: 3 }}>
      {sortDir === 'asc' && sortKey === k ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
    </span>
  );

  return (
    <div className="card fade-in" style={{ overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, padding: '12px 16px', alignItems: 'center', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--dim)', pointerEvents: 'none' }} />
          <input
            className="search-input"
            placeholder="Search messages…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Emotion filter */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {emotions.map(em => (
            <button
              key={em}
              onClick={() => setFilter(em)}
              className="btn btn-ghost"
              style={{
                padding: '4px 10px', fontSize: 12,
                ...(filter === em ? { background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', borderColor: 'rgba(99,102,241,0.3)' } : {}),
              }}
            >
              {em === 'all' ? 'All' : <><span style={{ width: 7, height: 7, borderRadius: '50%', background: EMOTION_COLOR[em], display: 'inline-block', marginRight: 5 }} />{em}</>}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'center' }}>{filtered.length} rows</span>
          <button className="btn btn-ghost" onClick={onClear} style={{ padding: '4px 8px', color: 'var(--dim)' }}>
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
        <table className="data-table">
          <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>Message</th>
              <th onClick={() => toggleSort('emotion')} style={{ cursor: 'pointer', width: 110 }}>
                Emotion <SortIcon k="emotion" />
              </th>
              <th onClick={() => toggleSort('confidence')} style={{ cursor: 'pointer', width: 130 }}>
                Confidence <SortIcon k="confidence" />
              </th>
              <th onClick={() => toggleSort('priority')} style={{ cursor: 'pointer', width: 100 }}>
                Priority <SortIcon k="priority" />
              </th>
              <th style={{ width: 32 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6}><div className="empty-state" style={{ padding: '32px', fontSize: 13 }}>No messages match your filter.</div></td></tr>
            )}
            {filtered.map(r => (
              <>
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <td style={{ color: 'var(--dim)', fontSize: 11 }}>{r.id + 1}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 440 }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{r.emoji}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{r.message}</span>
                    </div>
                  </td>
                  <td>
                    <span className="badge" style={{ color: r.color, background: `${r.color}15`, border: `1px solid ${r.color}30`, textTransform: 'capitalize' }}>
                      {r.emotion}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="conf-bar" style={{ width: 64 }}>
                        <div className="conf-bar-fill" style={{ width: `${r.confidence}%`, background: r.color }} />
                      </div>
                      <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--muted)' }}>{r.confidence}%</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${PRI_CLASS[r.priority] ?? ''}`} style={{ textTransform: 'capitalize' }}>
                      {r.priority === 'critical' && <AlertCircle size={10} />}
                      {r.priority}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: 'var(--dim)' }}>
                      {expanded === r.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </span>
                  </td>
                </tr>
                {expanded === r.id && (
                  <tr key={`${r.id}-exp`}>
                    <td />
                    <td colSpan={5} style={{ padding: '0 0 12px' }}>
                      <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '10px 0 0' }}>
                        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 7, padding: '10px 12px' }}>
                          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 5 }}>Suggested Offer</div>
                          <div style={{ fontSize: 13, color: 'var(--text)' }}>🎁 {r.offer}</div>
                        </div>
                        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 7, padding: '10px 12px' }}>
                          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 5 }}>Recommended Action</div>
                          <div style={{ fontSize: 13, color: 'var(--text)' }}>⚡ {r.action}</div>
                        </div>
                        {r.allScores.length > 0 && (
                          <div style={{ gridColumn: '1 / -1', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 7, padding: '10px 12px' }}>
                            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>Emotion Breakdown</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {r.allScores.map(s => (
                                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span style={{ width: 60, fontSize: 11, textTransform: 'capitalize', color: 'var(--muted)' }}>{s.label}</span>
                                  <div className="conf-bar" style={{ flex: 1 }}>
                                    <div className="conf-bar-fill" style={{ width: `${s.score}%`, background: r.emotion === s.label ? r.color : 'var(--border-hi)' }} />
                                  </div>
                                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--muted)', width: 32, textAlign: 'right' }}>{s.score}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── AnalyzeView ────────────────────────────────────────────────────────────────

function AnalyzeView({ onResults }: { onResults: (r: ApiResponse) => void }) {
  const [tab, setTab] = useState<'single' | 'batch'>('single');
  const [text, setText] = useState('');
  const [csvRows, setCsvRows] = useState<string[]>([]);
  const [csvName, setCsvName] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const parseCSV = useCallback((file: File) => {
    setCsvName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: true,
      complete(res) {
        const rows = res.data.map(r =>
          r['message'] ?? r['Message'] ?? r['text'] ?? r['Text'] ?? Object.values(r)[0]
        ).filter(Boolean) as string[];
        rows.length === 0 ? setError('CSV must have a "message" column.') : (setCsvRows(rows), setError(''));
      },
      error(e) { setError(`Parse error: ${e.message}`); },
    });
  }, []);

  const run = useCallback(async () => {
    const msgs = tab === 'single' ? [text.trim()] : csvRows;
    if (!msgs[0]) { setError('No messages to analyze.'); return; }
    if (msgs.length > 500) { setError('Max 500 messages per batch.'); return; }
    setError(''); setLoading(true); setProgress(8);
    const tick = setInterval(() => setProgress(p => Math.min(p + 6, 80)), 600);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs }),
      });
      const data: ApiResponse = await res.json();
      clearInterval(tick); setProgress(100);
      if (!res.ok || data.error) { setError(data.error ?? 'Analysis failed. Is HF_TOKEN set?'); }
      else { onResults(data); }
    } catch (e: unknown) {
      clearInterval(tick);
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 800);
    }
  }, [tab, text, csvRows, onResults]);

  const canRun = tab === 'single' ? text.trim().length > 0 : csvRows.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%', overflow: 'auto' }}>
      <Topbar
        title="Analyze Customer Messages"
        sub="Detect emotions and map them to personalized offers and CX actions"
        actions={
          <button className="btn btn-primary" onClick={run} disabled={loading || !canRun}>
            {loading ? <><RefreshCw size={14} className="spin" /> Analyzing…</> : <><Zap size={14} /> Run Analysis</>}
          </button>
        }
      />

      <div style={{ padding: '24px', display: 'flex', gap: 24, flex: 1, overflow: 'auto', alignItems: 'flex-start' }}>

        {/* Left: input panel */}
        <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

          {/* Tabs */}
          <div className="tab-bar">
            {(['single', 'batch'] as const).map(t => (
              <div key={t} className={`tab ${tab === t ? 'active' : ''}`}
                onClick={() => { setTab(t); setError(''); }}>
                {t === 'single' ? 'Single message' : 'Batch upload (CSV)'}
              </div>
            ))}
          </div>

          {tab === 'single' ? (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Customer message</span>
                {text && <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => setText('')}><X size={11} /> Clear</button>}
              </div>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Paste a customer message, review, support ticket, or survey response…"
                style={{ width: '100%', padding: '14px 16px', minHeight: 140, fontSize: 14, lineHeight: 1.6, background: 'transparent', border: 'none', borderRadius: 0, resize: 'vertical' }}
              />
              <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 6 }}>EXAMPLES</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {SAMPLES.map(s => (
                    <button key={s} className="btn btn-ghost"
                      style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '5px 8px', fontSize: 12, color: 'var(--muted)', height: 'auto', whiteSpace: 'normal', lineHeight: 1.4 }}
                      onClick={() => setText(s)}>
                      <ChevronRight size={11} style={{ flexShrink: 0, color: 'var(--dim)' }} />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                className="drop-zone"
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('over'); }}
                onDragLeave={e => e.currentTarget.classList.remove('over')}
                onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('over'); const f = e.dataTransfer.files[0]; f?.name.endsWith('.csv') ? parseCSV(f) : setError('Please drop a .csv file.'); }}
                onClick={() => fileRef.current?.click()}
              >
                {csvName ? (
                  <>
                    <CheckCircle2 size={22} style={{ color: '#22c55e', margin: '0 auto 8px' }} />
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>{csvName}</div>
                    <div style={{ color: '#22c55e', fontSize: 12, marginTop: 3 }}>{csvRows.length} messages loaded</div>
                    <button className="btn btn-ghost" style={{ marginTop: 10, fontSize: 11 }} onClick={e => { e.stopPropagation(); setCsvName(''); setCsvRows([]); }}>
                      <X size={11} /> Remove
                    </button>
                  </>
                ) : (
                  <>
                    <Upload size={22} style={{ color: 'var(--dim)', margin: '0 auto 10px' }} />
                    <div style={{ fontWeight: 500, color: 'var(--text)', fontSize: 13 }}>Drop CSV file here or click to browse</div>
                    <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>
                      Requires a <code style={{ background: 'var(--border)', padding: '1px 5px', borderRadius: 3 }}>message</code> column · Max 500 rows
                    </div>
                  </>
                )}
                <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files?.[0]) parseCSV(e.target.files[0]); }} />
              </div>

              {csvRows.length > 0 && (
                <div className="card" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Preview — first 5 rows
                  </div>
                  {csvRows.slice(0, 5).map((m, i) => (
                    <div key={i} style={{ padding: '7px 14px', borderBottom: i < 4 ? '1px solid var(--border)' : 'none', fontSize: 13, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--dim)', marginRight: 10, fontFamily: 'monospace', fontSize: 11 }}>{i + 1}</span>{m}
                    </div>
                  ))}
                  {csvRows.length > 5 && <div style={{ padding: '7px 14px', fontSize: 12, color: 'var(--dim)' }}>… {csvRows.length - 5} more rows</div>}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="fade-in" style={{ display: 'flex', gap: 8, padding: '10px 14px', borderRadius: 7, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#fca5a5', fontSize: 13 }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
            </div>
          )}

          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Activity size={12} className="spin" /> Running DistilBERT inference…</span>
                <span style={{ fontFamily: 'monospace' }}>{progress}%</span>
              </div>
              <div style={{ height: 3, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', borderRadius: 99, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}
        </div>

        {/* Right: info panel */}
        <div style={{ width: 264, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 10 }}>Emotion → Action Map</div>
            {[
              { em: 'Joy',      col: '#22c55e', pri: 'Low',      act: 'Upsell' },
              { em: 'Anger',    col: '#ef4444', pri: 'Critical', act: 'Escalate' },
              { em: 'Sadness',  col: '#3b82f6', pri: 'High',     act: 'Retain' },
              { em: 'Fear',     col: '#a855f7', pri: 'High',     act: 'Reassure' },
              { em: 'Love',     col: '#ec4899', pri: 'Low',      act: 'Advocate' },
              { em: 'Surprise', col: '#f59e0b', pri: 'Medium',   act: 'Engage' },
            ].map(({ em, col, pri, act }) => (
              <div key={em} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{em}</span>
                <span className={`badge pri-${pri.toLowerCase()}`} style={{ fontSize: 10 }}>{pri}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)', width: 52, textAlign: 'right' }}>{act}</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>Model Info</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--muted)' }}>
              {[
                ['Model', 'DistilBERT fine-tuned'],
                ['Dataset', 'Emotions NLP (6-class)'],
                ['Provider', 'HuggingFace API'],
                ['Max input', '512 tokens'],
                ['Batch limit', '500 messages'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ color: 'var(--dim)' }}>{k}</span>
                  <span style={{ color: 'var(--text)', textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── InsightsView ───────────────────────────────────────────────────────────────

function InsightsView({ data }: { data: ApiResponse | null }) {
  if (!data) return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar title="Insights" sub="Emotion distribution and trends across your dataset" />
      <div className="empty-state" style={{ flex: 1 }}>
        <BarChart2 size={28} style={{ opacity: 0.25 }} />
        <div style={{ fontWeight: 600, color: 'var(--text)' }}>No data yet</div>
        <div style={{ fontSize: 12 }}>Run an analysis first to see insights.</div>
      </div>
    </div>
  );

  const chartData = Object.entries(data.emotionCounts).map(([emotion, count]) => ({
    emotion, count,
    color: data.results.find(r => r.emotion === emotion)?.color ?? '#6b7280',
    pct: Math.round((count / data.total) * 100),
  })).sort((a, b) => b.count - a.count);

  const radialData = chartData.map((d, i) => ({ ...d, fill: d.color }));
  const critCount = data.results.filter(r => r.priority === 'critical').length;
  const highCount = data.results.filter(r => r.priority === 'high').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar title="Insights" sub={`Analysis of ${data.total} messages · avg confidence ${data.avgConfidence}%`} />
      <div style={{ padding: 24, flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Metrics row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <MetricCard label="Total Analyzed"    value={data.total}                              sub="messages processed" />
          <MetricCard label="Avg Confidence"    value={`${data.avgConfidence}%`}               sub="model certainty" />
          <MetricCard label="Emotion Types"     value={Object.keys(data.emotionCounts).length} sub="distinct emotions" />
          <MetricCard label="Critical"          value={critCount}                              sub="need immediate action" color={critCount > 0 ? '#f87171' : undefined} />
          <MetricCard label="High Priority"     value={highCount}                              sub="retention risk" color={highCount > 0 ? '#fb923c' : undefined} />
        </div>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 14 }}>Message Count by Emotion</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="emotion" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12 }}
                  labelStyle={{ color: 'var(--text)', fontWeight: 600 }}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {chartData.map((e, i) => <Cell key={i} fill={e.color} fillOpacity={0.8} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 14 }}>Distribution Breakdown</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {chartData.map(d => (
                <div key={d.emotion} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                  <span style={{ width: 64, fontSize: 12, textTransform: 'capitalize', color: 'var(--text)' }}>{d.emotion}</span>
                  <div className="conf-bar" style={{ flex: 1 }}>
                    <div className="conf-bar-fill" style={{ width: `${d.pct}%`, background: d.color }} />
                  </div>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--muted)', width: 40, textAlign: 'right' }}>{d.count} ({d.pct}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Priority summary */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 12 }}>Priority Distribution</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {(['critical', 'high', 'medium', 'low'] as const).map(p => {
              const count = data.results.filter(r => r.priority === p).length;
              const pct = Math.round((count / data.total) * 100);
              return (
                <div key={p} className={`metric`} style={{ padding: '12px 14px' }}>
                  <span className={`badge ${PRI_CLASS[p]}`} style={{ fontSize: 10, textTransform: 'capitalize', marginBottom: 6 }}>{p}</span>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>{count}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{pct}% of total</div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── AlertsView ─────────────────────────────────────────────────────────────────

function AlertsView({ results }: { results: AnalysisResult[] }) {
  const critical = results.filter(r => r.priority === 'critical');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar title="Critical Alerts" sub={`${critical.length} messages requiring immediate CX action`} />
      <div style={{ padding: 24, flex: 1, overflow: 'auto' }}>
        {critical.length === 0 ? (
          <div className="empty-state">
            <CheckCircle2 size={28} style={{ color: '#22c55e', opacity: 0.5 }} />
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>No critical issues</div>
            <div style={{ fontSize: 12 }}>All customers are within acceptable emotion ranges.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {critical.map(r => (
              <div key={r.id} className="card fade-in" style={{ padding: 16, borderLeft: '3px solid #ef4444' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <AlertCircle size={16} style={{ color: '#f87171', flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, color: 'var(--text)', marginBottom: 8 }}>&ldquo;{r.message}&rdquo;</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span className="badge pri-critical">Critical</span>
                      <span className="badge" style={{ color: r.color, background: `${r.color}15`, border: `1px solid ${r.color}30` }}>{r.emoji} {r.emotion}</span>
                      <span className="badge" style={{ color: 'var(--muted)', background: 'var(--panel)', border: '1px solid var(--border)' }}>Confidence: {r.confidence}%</span>
                    </div>
                    <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
                        <div style={{ color: 'var(--dim)', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', marginBottom: 4, textTransform: 'uppercase' }}>Offer</div>
                        <div style={{ color: 'var(--text)' }}>{r.offer}</div>
                      </div>
                      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
                        <div style={{ color: 'var(--dim)', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', marginBottom: 4, textTransform: 'uppercase' }}>Action</div>
                        <div style={{ color: 'var(--text)' }}>{r.action}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────

export default function Home() {
  const [view, setView] = useState('analyze');
  const [data, setData] = useState<ApiResponse | null>(null);

  const handleResults = useCallback((r: ApiResponse) => {
    setData(r);
    setView('results');
  }, []);

  const criticalCount = data?.results.filter(r => r.priority === 'critical').length ?? 0;

  const downloadCSV = () => {
    if (!data) return;
    const headers = ['ID', 'Message', 'Emotion', 'Confidence (%)', 'Priority', 'Suggested Offer', 'Action'];
    const rows = data.results.map(r =>
      [r.id + 1, `"${r.message.replace(/"/g, '""')}"`, r.emotion, r.confidence, r.priority, `"${r.offer}"`, `"${r.action}"`]
    );
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: 'emotioniq_results.csv',
    });
    a.click();
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <Sidebar view={view} setView={setView} total={data?.total ?? 0} critical={criticalCount} />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {view === 'analyze' && <AnalyzeView onResults={handleResults} />}

        {view === 'results' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Topbar
              title="Results"
              sub={data ? `${data.total} messages · avg confidence ${data.avgConfidence}%` : 'No data yet'}
              actions={data ? (
                <>
                  <button className="btn btn-secondary" onClick={downloadCSV}><Download size={14} /> Export CSV</button>
                  <button className="btn btn-ghost" onClick={() => setView('analyze')}><Zap size={14} /> New Analysis</button>
                </>
              ) : undefined}
            />
            <div style={{ padding: 24, flex: 1, overflow: 'auto' }}>
              {data ? (
                <ResultTable results={data.results} onClear={() => { setData(null); setView('analyze'); }} />
              ) : (
                <div className="empty-state">
                  <FileText size={28} style={{ opacity: 0.25 }} />
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>No results yet</div>
                  <div style={{ fontSize: 12 }}>Run an analysis to see results here.</div>
                  <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setView('analyze')}>
                    Go to Analyze
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'insights' && <InsightsView data={data} />}
        {view === 'alerts' && <AlertsView results={data?.results ?? []} />}
      </main>
    </div>
  );
}
