// End-of-day price & volume from Yahoo Finance's chart endpoint (same data as yfinance).
import { UA } from './gemini';

export async function eod(ticker) {
  let d;
  for (const host of ['query1', 'query2']) {
    const r = await fetch(
      `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}.NS?range=3mo&interval=1d`,
      { headers: UA, next: { revalidate: 1800 } }
    );
    if (r.ok) { d = await r.json(); break; }
  }
  const res = d?.chart?.result?.[0];
  if (!res) throw new Error(`No price data for ${ticker}`);
  const q = res.indicators.quote[0];
  const bars = res.timestamp
    .map((t, i) => ({ t: t * 1000, c: q.close[i], v: q.volume[i] }))
    .filter((b) => b.c != null && b.v != null);
  const n = bars.length;
  if (n < 3) throw new Error('Too few bars');
  const last = bars[n - 1], prev = bars[n - 2];
  const window = bars.slice(Math.max(0, n - 21), n - 1); // 20 sessions before today
  const avgVol = window.reduce((s, b) => s + b.v, 0) / window.length;
  return {
    ticker,
    date: last.t,
    close: last.c,
    chg: ((last.c - prev.c) / prev.c) * 100,
    vol: last.v,
    avgVol,
    volX: avgVol ? last.v / avgVol : null,
    spark: bars.slice(-30).map((b) => +b.c.toFixed(2)),
  };
}
