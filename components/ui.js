'use client';
import { useEffect, useRef, useState } from 'react';

export const cr = (v) => (v == null ? '—' : `₹${Math.round(v).toLocaleString('en-IN')}`);
export const pc = (v, d = 1) => (v == null || !isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(d)}%`);
export const tone = (v) => (v == null ? '' : v > 0 ? 'up' : v < 0 ? 'down' : '');

export function ago(ts) {
  const m = Math.round((Date.now() - ts) / 6e4);
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
}

export function Spark({ data, w = 64, h = 22 }) {
  if (!data?.length) return null;
  const lo = Math.min(...data), hi = Math.max(...data), r = hi - lo || 1;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - ((v - lo) / r) * h).toFixed(1)}`).join(' ');
  const up = data[data.length - 1] >= data[0];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="spark" aria-hidden>
      <polyline points={pts} fill="none" stroke={up ? 'var(--up)' : 'var(--down)'} strokeWidth="1.4" />
    </svg>
  );
}

export function useLocal(key, init) {
  const [v, setV] = useState(init);
  useEffect(() => {
    try { const s = localStorage.getItem(key); if (s) setV(JSON.parse(s)); } catch {}
  }, [key]);
  const set = (nv) => {
    setV((old) => {
      const val = typeof nv === 'function' ? nv(old) : nv;
      try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
      return val;
    });
  };
  return [v, set];
}

// Fires once when the element first scrolls into view (used for pay-per-view enrichment).
export function useSeen() {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!ref.current || seen) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { rootMargin: '120px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

export function NumTable({ rows, period }) {
  return (
    <table className="nt">
      <thead>
        <tr><th>{period || ''}</th><th>₹ Cr</th><th>QoQ</th><th>YoY</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td>{r.label}</td>
            <td className="mono">{cr(r.cur)}</td>
            <td className={`mono ${tone(r.qoq)}`}>{pc(r.qoq)}</td>
            <td className={`mono ${tone(r.yoy)}`}>{pc(r.yoy)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Loader({ steps }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), 4500);
    return () => clearInterval(t);
  }, [steps.length]);
  return (
    <div className="loader">
      <span className="pulse" />
      {steps[i]}
    </div>
  );
}
