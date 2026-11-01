'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CATEGORY_LABEL } from '@/lib/classify';
import { ago, pc, tone, Spark, useLocal, useSession, useSeen, NumTable, Loader } from '@/components/ui';

const WINDOWS = [[24, '24H'], [72, '3D'], [168, '7D'], [720, '30D']];
const DEFAULTS = { pricePct: 4, volX: 2, cats: ['results', 'M&A', 'management_change', 'fund_raise', 'pledging'] };

export default function Alerts() {
  const [hours, setHours] = useLocal('finn.hours', 24);
  const [cfg, setCfg] = useLocal('finn.cfg', DEFAULTS);
  const [readIds, setReadIds, ready] = useSession('finn.read', []);
  const [feed, setFeed] = useState(null);
  const [px, setPx] = useState(null);
  const [routineOpen, setRoutineOpen] = useState(false);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    setFeed(null);
    fetch(`/api/feed?hours=${hours}`).then((r) => r.json()).then(setFeed).catch(() => setFeed({ items: [] }));
  }, [hours]);
  useEffect(() => {
    fetch('/api/prices').then((r) => r.json()).then(setPx).catch(() => setPx({ prices: [] }));
  }, []);

  const read = useMemo(() => new Set(readIds), [readIds]);
  const markRead = (...ids) => setReadIds((r) => [...new Set([...r, ...ids])].slice(-1000));

  // Price alerts: the user's own thresholds applied to end-of-day data.
  const moves = useMemo(
    () =>
      (px?.prices || [])
        .map((p) => ({ ...p, id: `mv:${p.ticker}:${new Date(p.date).toDateString()}`, hitPx: Math.abs(p.chg) >= cfg.pricePct, hitVol: p.volX >= cfg.volX }))
        .filter((p) => p.hitPx || p.hitVol)
        .sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg)),
    [px, cfg]
  );

  const items = (feed?.items || []).map((i) => ({ ...i, watched: cfg.cats.includes(i.category) }));
  const important = group(items.filter((i) => i.tier === 1).sort((a, b) => b.watched - a.watched || b.ts - a.ts));
  const fyi = group(items.filter((i) => i.tier === 2));
  const routine = items.filter((i) => i.tier === 3);

  const isRead = (g) => read.has(g.id);
  const unread = [...moves, ...important, ...fyi].filter((g) => !isRead(g));
  const unreadImportant = important.filter((g) => !isRead(g)).length + moves.filter((m) => !isRead(m)).length;

  // Tell the tab bar how many are unread (session-scoped).
  useEffect(() => {
    if (!feed || !ready) return;
    try { sessionStorage.setItem('finn.unreadCount', String(unread.length)); } catch {}
    window.dispatchEvent(new Event('finn-unread'));
  }, [feed, ready, unread.length]);

  const allIds = (gs) => gs.flatMap((g) => [g.id, ...(g.rest || []).map((r) => r.id)]);
  const winLabel = WINDOWS.find((w) => w[0] === hours)?.[1] || `${hours}h`;

  return (
    <>
      <header className="top">
        <div className="row between">
          <div>
            <div className="row"><span className="logo">FINN</span><span className="date">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span></div>
            <h1 className="page-title">Alerts</h1>
          </div>
          <div className="row">
            {unread.length > 0 && <button className="icon-btn" onClick={() => markRead(...allIds([...moves, ...important, ...fyi]))}>Mark all read</button>}
            <button className="icon-btn" aria-label="Alert settings" onClick={() => setSheet(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
            </button>
          </div>
        </div>
        <div className="chips">
          {WINDOWS.map(([h, l]) => (
            <button key={h} className={`chip ${h === hours ? 'on' : ''}`} onClick={() => setHours(h)}>{l}</button>
          ))}
        </div>
      </header>

      {!feed ? (
        <div className="sec"><Loader steps={['Checking filings across your 18 holdings…', 'Sorting signal from paperwork…']} /></div>
      ) : (
        <>
          <h2 className="brief">
            {unread.length ? <><b>{unread.length} unread</b>{unreadImportant ? `, ${unreadImportant} important` : ''}.</> : "You're all caught up."}
          </h2>
          <p className="sub">{items.length} filings in the last {winLabel} · {routine.length} routine ones tucked away</p>
          {(feed.sample || px?.sample) && <div className="banner">Live exchange/price sources unreachable, so this is labelled sample data.</div>}

          {px?.prices?.length > 0 && (
            <div className="tape">
              {px.prices.map((p) => (
                <Link key={p.ticker} href={`/research/${p.ticker}`} className="tk">
                  <b>{p.ticker}</b><span className={tone(p.chg)}>{pc(p.chg)}</span>
                </Link>
              ))}
            </div>
          )}

          {moves.length > 0 && (
            <section className="sec">
              <div className="sec-h"><span>Price alerts</span><span>±{cfg.pricePct}% · {cfg.volX}× vol</span></div>
              {moves.map((m) => (
                <div key={m.id} className={`card ${isRead(m) ? 'read' : ''}`} onClick={() => markRead(m.id)}>
                  {!isRead(m) && <span className="dot" />}
                  <Link href={`/research/${m.ticker}`} className="move">
                    <div>
                      <div className="meta"><span className="t">{m.ticker}</span><span className="mono">₹{m.close.toFixed(1)}</span></div>
                      <div className="row" style={{ marginTop: 6 }}>
                        <span className={`pill ${tone(m.chg)}`}>{m.chg > 0 ? '▲' : '▼'} {pc(m.chg)}</span>
                        {m.hitVol && <span className="pill vol">{m.volX.toFixed(1)}× avg volume</span>}
                      </div>
                    </div>
                    <Spark data={m.spark} w={80} h={30} />
                  </Link>
                  <Related ticker={m.ticker} items={items} />
                </div>
              ))}
            </section>
          )}

          <section className="sec">
            <div className="sec-h"><span>Important</span><span>{important.filter((g) => !isRead(g)).length} new</span></div>
            {important.length === 0 && <div className="empty"><b>Quiet.</b>Nothing important in this window.</div>}
            {important.map((g) => <ImportantCard key={g.id} i={g} isRead={isRead(g)} onRead={() => markRead(g.id, ...g.rest.map((r) => r.id))} />)}
          </section>

          {fyi.length > 0 && (
            <section className="sec">
              <div className="sec-h"><span>FYI</span><span>{fyi.filter((g) => !isRead(g)).length} new</span></div>
              {fyi.map((i) => (
                <div key={i.id} className={`line-row ${isRead(i) ? 'read' : ''}`}>
                  {!isRead(i) && <span className="dot" />}
                  <Link href={`/research/${i.ticker}`} className="t" onClick={() => markRead(i.id)}>{i.ticker}</Link>
                  <a className="txt" href={i.pdf || undefined} target="_blank" rel="noreferrer" onClick={() => markRead(i.id, ...i.rest.map((r) => r.id))}>
                    {i.line || i.title}
                    <small>
                      <span style={i.watched ? { color: 'var(--accent)' } : undefined}>{CATEGORY_LABEL[i.category]}</span> · {ago(i.ts)}
                      {i.rest.length > 0 && ` · +${i.rest.length} similar`}
                    </small>
                  </a>
                </div>
              ))}
            </section>
          )}

          {routine.length > 0 && (
            <section className="sec">
              <button className="toggle" onClick={() => setRoutineOpen((o) => !o)}>
                {routineOpen ? '▾' : '▸'} Routine ({routine.length}): trading windows, certificates, newspaper ads…
              </button>
              {routineOpen && routine.map((i) => (
                <div key={i.id} className="line-row dim">
                  <span className="t">{i.ticker}</span>
                  <a className="txt" href={i.pdf || undefined} target="_blank" rel="noreferrer">{i.title}<small>{ago(i.ts)}</small></a>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {sheet && <Settings cfg={cfg} setCfg={setCfg} close={() => setSheet(false)} />}
    </>
  );
}

// One card per company + topic: 8 NCLAT updates from the same case become one card.
function group(list) {
  const map = new Map();
  for (const i of list) {
    const k = `${i.ticker}|${i.category}`;
    if (map.has(k)) map.get(k).rest.push(i);
    else map.set(k, { ...i, rest: [] });
  }
  return [...map.values()];
}

// A price move is more useful next to its likely cause.
function Related({ ticker, items }) {
  const f = items.find((i) => i.ticker === ticker && i.tier === 1) || items.find((i) => i.ticker === ticker && i.tier === 2);
  if (!f) return null;
  return <p className="note" style={{ marginTop: 8 }}>Possibly related: {CATEGORY_LABEL[f.category]} · {f.line || f.title}</p>;
}

function ImportantCard({ i, isRead, onRead }) {
  const [ref, seen] = useSeen();
  const [x, setX] = useState(null);
  useEffect(() => {
    if (!seen || x || !(i.kind === 'results' || i.kind === 'bio') || i.sample) return;
    const q = new URLSearchParams({ id: i.id, kind: i.kind, pdf: i.pdf || '', h: i.headline, co: i.name || i.ticker, t: i.ticker });
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 90e3);
    fetch(`/api/enrich?${q}`, { signal: ctl.signal }).then((r) => r.json()).then(setX)
      .catch(() => setX({ error: 'Taking too long (free-tier queue). Reopen the app to retry.' }))
      .finally(() => clearTimeout(timer));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen, i.id]);

  return (
    <div ref={ref} className={`card ${isRead ? 'read' : ''}`} onClick={onRead}>
      {!isRead && <span className="dot" />}
      <div className="meta">
        <span className="t">{i.ticker}</span>
        <span className={`tag ${i.watched ? 'hot' : ''}`}>{CATEGORY_LABEL[i.category]}</span>
        <span className="when">{ago(i.ts)}</span>
      </div>
      <p className="hl">{i.line || i.title}</p>
      {(i.kind === 'results' || i.kind === 'bio') && (
        <div className="enrich">
          {i.sample ? <p className="err">Sample item: live sources needed for the {i.kind === 'results' ? 'numbers' : 'background'}.</p>
            : !x ? <Loader steps={i.kind === 'results' ? ['Reading the results filing…', 'Working out QoQ / YoY…'] : ['Finding who was appointed…', 'Looking up their background…']} />
            : x.error ? <p className="err">{x.error}</p>
            : x.type === 'results' ? <><NumTable rows={x.rows} period={x.period} /><p className="note">{x.basis} · {x.note}</p></>
            : <Bio x={x} />}
        </div>
      )}
      {i.rest.length > 0 && (
        <details className="note" style={{ marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
          <summary>+{i.rest.length} earlier {CATEGORY_LABEL[i.category].toLowerCase()} updates</summary>
          {i.rest.map((r) => (
            <a key={r.id} href={r.pdf || undefined} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 4 }}>
              {ago(r.ts)} · {r.line || r.title}
            </a>
          ))}
        </details>
      )}
      <div className="actions">
        {i.pdf && <a href={i.pdf} target="_blank" rel="noreferrer">Filing ↗</a>}
        <Link href={`/research/${i.ticker}`} className="go">Research {i.ticker} →</Link>
      </div>
    </div>
  );
}

function Bio({ x }) {
  const p = x.incoming;
  if (!p?.name) return <p className="err">Couldn't identify the incoming person from the filing.</p>;
  return (
    <div className="bio">
      <h4>{p.name} <span>· {p.role}{p.effective ? ` · from ${p.effective}` : ''}</span></h4>
      {p.background?.length > 0 && <ul>{p.background.map((b, k) => <li key={k}>{b}</li>)}</ul>}
      {x.outgoing?.name && <p className="note">Replaces {x.outgoing.name} ({x.outgoing.role})</p>}
      {p.read && <p className="read">{p.read}</p>}
      {x.sources?.length > 0 && <div className="src">{x.sources.map((s, k) => <a key={k} href={s.url} target="_blank" rel="noreferrer">{s.title || 'source'}</a>)}</div>}
    </div>
  );
}

function Settings({ cfg, setCfg, close }) {
  const [u, setU] = useState(null);
  useEffect(() => { fetch('/api/usage').then((r) => r.json()).then(setU).catch(() => {}); }, []);
  const set = (k, v) => setCfg({ ...cfg, [k]: v });
  const toggle = (c) => set('cats', cfg.cats.includes(c) ? cfg.cats.filter((x) => x !== c) : [...cfg.cats, c]);
  return (
    <>
      <div className="scrim" onClick={close} />
      <div className="sheet">
        <h3>Alert settings</h3>
        <p className="sub">You decide what counts as unusual; FINN watches end-of-day data for it.</p>
        <div className="field">
          <label>Price moves more than <b>±{cfg.pricePct}%</b></label>
          <input type="range" min="1" max="10" step="0.5" value={cfg.pricePct} onChange={(e) => set('pricePct', +e.target.value)} />
        </div>
        <div className="field">
          <label>Volume above <b>{cfg.volX}× 20-day avg</b></label>
          <input type="range" min="1.2" max="5" step="0.1" value={cfg.volX} onChange={(e) => set('volX', +e.target.value)} />
        </div>
        <div className="field">
          <label>Highlight these filing types</label>
          <div className="cats">
            {Object.entries(CATEGORY_LABEL).filter(([c]) => c !== 'unclassified').map(([c, l]) => (
              <button key={c} className={`chip ${cfg.cats.includes(c) ? 'on' : ''}`} onClick={() => toggle(c)}>{l}</button>
            ))}
          </div>
        </div>
        {u && (
          <div className="usage">
            AI: {u.llm ? `${u.models.cheap} (reading) → ${u.models.smart} (judging)` : 'off (no key)'}<br />
            Since server start: {u.calls} calls · {Math.round((u.input + u.output) / 1000)}k tokens · ₹0 on free tier
          </div>
        )}
        <button className="chip on" style={{ marginTop: 18, width: '100%', padding: 10 }} onClick={close}>Done</button>
      </div>
    </>
  );
}
