'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import AskBar from '@/components/AskBar';
import { CATEGORY_LABEL } from '@/lib/classify';
import { ago, pc, tone, Spark, useLocal, useSeen, NumTable, Loader } from '@/components/ui';

const WINDOWS = [[24, '24H'], [72, '3D'], [168, '7D'], [720, '30D']];
const DEFAULTS = { pricePct: 4, volX: 2, cats: ['results', 'M&A', 'management_change', 'fund_raise', 'pledging'] };

export default function Feed() {
  const [hours, setHours] = useLocal('finn.hours', 24);
  const [cfg, setCfg] = useLocal('finn.cfg', DEFAULTS);
  const [done, setDone] = useLocal('finn.done', []);
  const [feed, setFeed] = useState(null);
  const [px, setPx] = useState(null);
  const [routineOpen, setRoutineOpen] = useState(false);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    setFeed(null);
    fetch(`/api/feed?hours=${hours}`).then((r) => r.json()).then(setFeed).catch(() => setFeed({ items: [], error: true }));
  }, [hours]);
  useEffect(() => {
    fetch('/api/prices').then((r) => r.json()).then(setPx).catch(() => setPx({ prices: [] }));
  }, []);

  const doneSet = useMemo(() => new Set(done), [done]);
  const clear = (id) => setDone((d) => [...new Set([...d, id])].slice(-500));

  // Triggered alerts: the user's thresholds, applied to EOD data.
  const moves = useMemo(
    () =>
      (px?.prices || [])
        .map((p) => ({ ...p, hitPx: Math.abs(p.chg) >= cfg.pricePct, hitVol: p.volX >= cfg.volX }))
        .filter((p) => (p.hitPx || p.hitVol) && !doneSet.has(`mv:${p.ticker}:${p.date}`))
        .sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg)),
    [px, cfg, doneSet]
  );

  const items = (feed?.items || []).map((i) => ({ ...i, alert: cfg.cats.includes(i.category) && i.tier <= 2 }));
  const live = items.filter((i) => !doneSet.has(i.id));
  const material = live.filter((i) => i.tier === 1 || i.alert).sort((a, b) => b.alert - a.alert || a.tier - b.tier);
  const notable = live.filter((i) => i.tier === 2 && !i.alert);
  const routine = items.filter((i) => i.tier === 3);
  const cleared = items.filter((i) => i.tier < 3 && doneSet.has(i.id)).length;
  const need = material.length + moves.length;
  const winLabel = WINDOWS.find((w) => w[0] === hours)?.[1] || `${hours}h`;

  return (
    <>
      <header className="top">
        <div className="row between">
          <div className="row">
            <span className="logo">FIN<i>N</i></span>
            <span className="date">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          </div>
          <button className="icon-btn" aria-label="Alert settings" onClick={() => setSheet(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
          </button>
        </div>
        <div className="chips">
          {WINDOWS.map(([h, l]) => (
            <button key={h} className={`chip ${h === hours ? 'on' : ''}`} onClick={() => setHours(h)}>{l}</button>
          ))}
        </div>
      </header>

      {!feed ? (
        <Loader steps={['Pulling filings across 18 holdings…', 'Sorting signal from paperwork…']} />
      ) : (
        <>
          <h2 className="brief">
            {need ? <><b>{need}</b> {need === 1 ? 'thing needs' : 'things need'} you.</> : 'Nothing needs you.'}{' '}
            <span style={{ color: 'var(--dim)', fontWeight: 400 }}>
              {notable.length} worth a glance, {routine.length} routine hidden.
            </span>
          </h2>
          <p className="sub">
            {items.length} filings in the last {winLabel} · swipe left or tap ✓ to clear
            {cleared ? ` · ${cleared} cleared` : ''}
          </p>
          {(feed.sample || px?.sample) && (
            <div className="banner">Live exchange/price sources unreachable from this server, so you're seeing labelled sample data.</div>
          )}

          {px?.prices?.length > 0 && (
            <div className="tape">
              {px.prices.map((p) => (
                <Link key={p.ticker} href={`/r/${p.ticker}`} className="tk">
                  <b>{p.ticker}</b>
                  <span className={tone(p.chg)}>{pc(p.chg)}</span>
                </Link>
              ))}
            </div>
          )}

          {moves.length > 0 && (
            <section className="sec">
              <div className="sec-h"><span>Unusual moves</span><span>±{cfg.pricePct}% · {cfg.volX}× vol</span></div>
              {moves.map((m) => (
                <Swipe key={m.ticker} className="card alert" onClear={() => clear(`mv:${m.ticker}:${m.date}`)}>
                  <Link href={`/r/${m.ticker}`} className="move">
                    <div>
                      <div className="meta"><span className="t">{m.ticker}</span><span className="mono">₹{m.close.toFixed(1)}</span></div>
                      <div className="row" style={{ marginTop: 6 }}>
                        <span className={`pill ${tone(m.chg)} ${m.hitPx ? '' : 'faded'}`}>{m.chg > 0 ? '▲' : '▼'} {pc(m.chg)}</span>
                        {m.hitVol && <span className="pill vol">{m.volX.toFixed(1)}× avg vol</span>}
                      </div>
                    </div>
                    <Spark data={m.spark} w={80} h={30} />
                  </Link>
                  <Related ticker={m.ticker} items={items} />
                </Swipe>
              ))}
            </section>
          )}

          <section className="sec">
            <div className="sec-h"><span>Material</span><span>{material.length}</span></div>
            {material.length === 0 && <div className="empty"><b>Clear.</b>No material filings in this window.</div>}
            {material.map((i) => <Material key={i.id} i={i} onClear={() => clear(i.id)} />)}
          </section>

          {notable.length > 0 && (
            <section className="sec">
              <div className="sec-h"><span>Worth a glance</span><span>{notable.length}</span></div>
              {notable.map((i) => (
                <Swipe key={i.id} className="line-row" onClear={() => clear(i.id)}>
                  <Link href={`/r/${i.ticker}`} className="t">{i.ticker}</Link>
                  <a className="txt" href={i.pdf || undefined} target="_blank" rel="noreferrer">
                    {i.line || i.subject || i.headline}
                    <small>{CATEGORY_LABEL[i.category]} · {ago(i.ts)}</small>
                  </a>
                </Swipe>
              ))}
            </section>
          )}

          {routine.length > 0 && (
            <section className="sec">
              <button className="toggle" onClick={() => setRoutineOpen((o) => !o)}>
                {routineOpen ? '▾' : '▸'} {routine.length} routine filings (trading windows, certificates, newspaper ads…)
              </button>
              {routineOpen &&
                routine.map((i) => (
                  <div key={i.id} className="line-row dim">
                    <span className="t">{i.ticker}</span>
                    <a className="txt" href={i.pdf || undefined} target="_blank" rel="noreferrer">{i.subject || i.headline}<small>{ago(i.ts)}</small></a>
                  </div>
                ))}
            </section>
          )}

          {cleared > 0 && (
            <p className="sub" style={{ marginTop: 16, textAlign: 'center' }}>
              <button onClick={() => setDone([])} style={{ textDecoration: 'underline', color: 'var(--dim)' }}>Restore {cleared} cleared</button>
            </p>
          )}
        </>
      )}

      {sheet && <Settings cfg={cfg} setCfg={setCfg} close={() => setSheet(false)} />}
      <AskBar extra={material.slice(0, 2).map((i) => i.ticker)} />
    </>
  );
}

// A price move is more useful next to its likely cause.
function Related({ ticker, items }) {
  const f = items.find((i) => i.ticker === ticker && i.tier <= 2);
  if (!f) return null;
  return <p className="note" style={{ marginTop: 8 }}>Same window: {CATEGORY_LABEL[f.category]} — {f.line || f.subject}</p>;
}

function Swipe({ className, onClear, children }) {
  const x0 = useRef(null);
  const [leaving, setLeaving] = useState(false);
  const out = () => { setLeaving(true); setTimeout(onClear, 180); };
  return (
    <div
      className={`${className} ${leaving ? 'leaving' : ''}`}
      onTouchStart={(e) => (x0.current = e.touches[0].clientX)}
      onTouchEnd={(e) => { if (x0.current != null && e.changedTouches[0].clientX - x0.current < -70) out(); x0.current = null; }}
    >
      {children}
      {className.includes('line-row') && <button onClick={out} aria-label="Clear" style={{ color: 'var(--faint)', padding: '0 2px' }}>✓</button>}
    </div>
  );
}

function Material({ i, onClear }) {
  const [ref, seen] = useSeen();
  const [x, setX] = useState(null);
  useEffect(() => {
    if (!seen || x || !(i.kind === 'results' || i.kind === 'bio') || i.sample) return;
    const q = new URLSearchParams({ id: i.id, kind: i.kind, pdf: i.pdf || '', h: i.headline, co: i.name || i.ticker });
    fetch(`/api/enrich?${q}`).then((r) => r.json()).then(setX).catch((e) => setX({ error: e.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen, i.id]);

  return (
    <Swipe className={`card ${i.alert ? 'alert' : ''}`} onClear={onClear}>
      <div ref={ref}>
        <div className="meta">
          <Link href={`/r/${i.ticker}`} className="t">{i.ticker}</Link>
          <span className={`tag ${i.alert ? 'hot' : ''}`}>{CATEGORY_LABEL[i.category]}</span>
          <span className="when">{ago(i.ts)}</span>
        </div>
        <p className="hl">{i.line || i.subject || i.headline}</p>
        {(i.kind === 'results' || i.kind === 'bio') && (
          <div className="enrich">
            {i.sample ? <p className="err">Sample item; connect live sources for the {i.kind === 'results' ? 'headline numbers' : 'background check'}.</p>
              : !x ? <Loader steps={i.kind === 'results' ? ['Reading the results filing…', 'Computing QoQ / YoY…'] : ['Reading the filing for the name…', 'Looking up their background…']} />
              : x.error ? <p className="err">{x.error}</p>
              : x.type === 'results' ? <><NumTable rows={x.rows} period={x.period} /><p className="note">{x.basis} · {x.note}</p></>
              : <Bio x={x} />}
          </div>
        )}
        <div className="actions">
          {i.pdf && <a href={i.pdf} target="_blank" rel="noreferrer">Filing ↗</a>}
          <Link href={`/r/${i.ticker}`} className="go">Dig in →</Link>
          <button className="done" onClick={onClear}>✓ Done</button>
        </div>
      </div>
    </Swipe>
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
        <h3>What counts as unusual</h3>
        <p className="sub">You decide; FINN watches. Applied to end-of-day data.</p>
        <div className="field">
          <label>Daily price move beyond <b>±{cfg.pricePct}%</b></label>
          <input type="range" min="1" max="10" step="0.5" value={cfg.pricePct} onChange={(e) => set('pricePct', +e.target.value)} />
        </div>
        <div className="field">
          <label>Volume above <b>{cfg.volX}× 20-day avg</b></label>
          <input type="range" min="1.2" max="5" step="0.1" value={cfg.volX} onChange={(e) => set('volX', +e.target.value)} />
        </div>
        <div className="field">
          <label>Always alert me on</label>
          <div className="cats">
            {Object.entries(CATEGORY_LABEL).filter(([c]) => c !== 'unclassified').map(([c, l]) => (
              <button key={c} className={`chip ${cfg.cats.includes(c) ? 'on' : ''}`} onClick={() => toggle(c)}>{l}</button>
            ))}
          </div>
        </div>
        {u && (
          <div className="usage">
            LLM: {u.llm ? `${u.models.cheap} (extract) → ${u.models.smart} (judge)` : 'off (no key)'}<br />
            This server since start: {u.calls} calls · {Math.round((u.input + u.output) / 1000)}k tokens · ₹0 on free tier
          </div>
        )}
        <button className="chip on" style={{ marginTop: 18, width: '100%', padding: 10 }} onClick={close}>Done</button>
      </div>
    </>
  );
}
