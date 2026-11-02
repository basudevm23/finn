'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PORTFOLIO, ADHOC } from '@/lib/portfolio';
import { useSession } from '@/components/ui';
import ModeToggle from '@/components/ModeToggle';

export default function ResearchHome() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [recent] = useSession('finn.recent', []);

  // Type-ahead: free screener search only (no AI per keystroke).
  useEffect(() => {
    setMsg('');
    if (q.trim().length < 2) return setHits([]);
    const t = setTimeout(() => {
      fetch(`/api/resolve?q=${encodeURIComponent(q.trim())}`).then((r) => r.json()).then((d) => setHits(d.results || [])).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // On submit: if search found nothing, the AI works out the company (brand / old name / typo).
  const submit = async (e) => {
    e.preventDefault();
    if (hits[0]) return router.push(`/research/${hits[0].sym}`);
    if (q.trim().length < 2) return;
    setBusy(true);
    const d = await fetch(`/api/resolve?ai=1&q=${encodeURIComponent(q.trim())}`).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (d.results?.[0]) router.push(`/research/${d.results[0].sym}`);
    else setMsg(`Couldn't find a listed company for "${q}". Try the company's name, e.g. "Infosys".`);
  };

  return (
    <>
      <header className="top">
        <ModeToggle />
        <p className="eyebrow">Pull › Research</p>
        <h1 className="page-title">Dig into a company</h1>
        <p className="sub">Eight views grounded only in annual reports, concall transcripts and reported financials.</p>
        <form className="search" onSubmit={submit}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Company name or ticker, e.g. zomato" autoCorrect="off" spellCheck={false} enterKeyHint="search" />
          <button type="submit" disabled={busy}>{busy ? '…' : 'Go'}</button>
        </form>
        {hits.length > 0 && (
          <div className="results">
            {hits.map((h, i) => (
              <Link key={`${h.sym}${i}`} href={`/research/${h.sym}`}>{h.name}<span>{h.sym}</span></Link>
            ))}
          </div>
        )}
        {busy && <p className="hint">Not an exact match, so working out which company you mean…</p>}
        {msg && <p className="hint">{msg}</p>}
      </header>

      {recent.length > 0 && (
        <section className="sec">
          <div className="sec-h"><span>Recently researched</span><span>this session</span></div>
          <div className="list">
            {recent.map((r, i) => (
              <Link key={`${r.sym}${i}`} href={`/research/${r.sym}`}><b>{r.sym}</b><span>{r.name}</span><i>›</i></Link>
            ))}
          </div>
        </section>
      )}

      <section className="sec">
        <div className="sec-h"><span>Try outside your portfolio</span></div>
        <div className="chips" style={{ marginTop: 0 }}>
          {ADHOC.map((s) => <Link key={s} href={`/research/${s}`} className="chip">{s}</Link>)}
        </div>
      </section>

      <section className="sec">
        <div className="sec-h"><span>Your portfolio</span><span>{PORTFOLIO.length}</span></div>
        <div className="list">
          {PORTFOLIO.map((p) => (
            <Link key={p.ticker} href={`/research/${p.ticker}`}><b>{p.ticker}</b><span>{p.name}</span><i>{p.sector}</i></Link>
          ))}
        </div>
      </section>
    </>
  );
}
