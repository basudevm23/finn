'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CATEGORY_LABEL } from '@/lib/classify';
import Art, { EmptyArt } from '@/components/Art';
import ModeToggle from '@/components/ModeToggle';
import { ago, pc, tone, Spark, useLocal, useSession, NumTable, Loader } from '@/components/ui';

const WINDOWS = [[24, '24H'], [72, '3D'], [168, '7D'], [720, '30D']];
const DEFAULTS = { pricePct: 4, volX: 2, cats: ['results', 'M&A', 'management_change', 'fund_raise', 'pledging'] };
// The brief's two flavours of Push, each with its own tabs.
const SECTIONS = {
  digest: { label: 'Digest', tabs: [['important', 'Important'], ['updates', 'Updates'], ['routine', 'Routine']] },
  alerts: { label: 'Triggered alerts', tabs: [['moves', 'Price & volume'], ['tracked', 'Filings you track']] },
};
const SUB = {
  important: (w) => `Material filings from the last ${w}, most important first.`,
  updates: (w) => `Worth knowing, not urgent: the rest of the last ${w}.`,
  routine: (w) => `Paperwork from the last ${w}, kept out of your way.`,
  moves: (_, c) => `Stocks that crossed your limits: ±${c.pricePct}% price or ${c.volX}× average volume.`,
  tracked: (_, c, n) => `Material filings of the ${n} types you chose to be alerted on.`,
};
const words = (s = '') => s.split(/\s+/).filter(Boolean).length;
const readMins = (n) => Math.max(1, Math.round(n / 200));

export default function Push() {
  const [hours, setHours] = useLocal('finn.hours', 24);
  const [cfg, setCfg] = useLocal('finn.cfg', DEFAULTS);
  const [readIds, setReadIds, ready] = useSession('finn.read', []);
  const [section, setSection] = useSession('finn.section', 'digest');
  const [tabs, setTabs] = useSession('finn.tabs', { digest: 'important', alerts: 'moves' });
  const [feed, setFeed] = useState(null);
  const [px, setPx] = useState(null);
  const [sheet, setSheet] = useState(false);
  const [open, setOpen] = useState(null);
  const tab = tabs[section] || SECTIONS[section].tabs[0][0];
  const setTab = (t) => setTabs((x) => ({ ...x, [section]: t }));

  useEffect(() => {
    setFeed(null);
    fetch(`/api/feed?hours=${hours}`).then((r) => r.json()).then(setFeed).catch(() => setFeed({ items: [] }));
  }, [hours]);
  useEffect(() => {
    fetch('/api/prices').then((r) => r.json()).then(setPx).catch(() => setPx({ prices: [] }));
  }, []);

  const read = useMemo(() => new Set(readIds), [readIds]);
  const markRead = (...ids) => setReadIds((r) => [...new Set([...r, ...ids])].slice(-1000));
  const isRead = (g) => read.has(g.id);

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
  const lists = {
    important,
    updates: group(items.filter((i) => i.tier === 2)),
    routine: items.filter((i) => i.tier === 3),
    moves,
    tracked: important.filter((g) => g.watched),
  };
  const unreadOf = (k) => (k === 'routine' ? 0 : lists[k].filter((g) => !isRead(g)).length);
  const unreadSec = (sec) => SECTIONS[sec].tabs.reduce((n, [k]) => n + unreadOf(k), 0);
  const unreadTotal = unreadOf('important') + unreadOf('updates') + unreadOf('moves');

  useEffect(() => {
    if (!feed || !ready) return;
    try { sessionStorage.setItem('finn.unreadCount', String(unreadTotal)); } catch {}
    window.dispatchEvent(new Event('finn-unread'));
  }, [feed, ready, unreadTotal]);

  const allIds = (gs) => gs.flatMap((g) => [g.id, ...(g.rest || []).map((r) => r.id)]);
  const openStory = (g) => { setOpen(g); markRead(...allIds([g])); };
  const winLabel = WINDOWS.find((w) => w[0] === hours)?.[1] || `${hours}h`;
  const tabLabel = SECTIONS[section].tabs.find(([k]) => k === tab)?.[1];
  const list = lists[tab] || [];
  const unreadHere = unreadOf(tab);

  return (
    <>
      <header className="top">
        <ModeToggle right={
          <button className="icon-btn" aria-label="Alert settings" onClick={() => setSheet(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
          </button>
        } />
        <div className="seg two">
          {Object.entries(SECTIONS).map(([k, s]) => {
            const u = feed ? unreadSec(k) : 0;
            return (
              <button key={k} className={section === k ? 'on' : ''} onClick={() => setSection(k)}>
                {s.label}{u > 0 && <span className="cnt new">{u}</span>}
              </button>
            );
          })}
        </div>
        <p className="eyebrow">Push › {SECTIONS[section].label}</p>
        <h1 className="page-title">{tabLabel}</h1>
        <p className="sub">{SUB[tab](winLabel, cfg, cfg.cats.length)}</p>
        {section === 'digest' && (
          <div className="chips">
            {WINDOWS.map(([h, l]) => (
              <button key={h} className={`chip sm ${h === hours ? 'on' : ''}`} onClick={() => setHours(h)}>{l}</button>
            ))}
          </div>
        )}
        <nav className="utabs" role="tablist">
          {SECTIONS[section].tabs.map(([k, l]) => {
            const u = feed ? unreadOf(k) : 0;
            const n = feed ? lists[k].length : null;
            return (
              <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                {l}{n != null && <span className={`cnt ${u ? 'new' : ''}`}>{u || n}</span>}
              </button>
            );
          })}
        </nav>
      </header>

      {(feed?.sample || px?.sample) && <div className="banner">Live exchange/price sources unreachable, so this is labelled sample data.</div>}

      {!feed ? (
        <div className="sec"><Loader steps={['Checking filings across your 18 holdings…', 'Writing your digest…']} /></div>
      ) : (
        <div className="pane" key={section + tab + hours}>
          {tab !== 'routine' && list.length > 0 && (
            <div className="legend">
              <span><i className="sw new" />New</span>
              <span><i className="sw" />Read</span>
              {unreadHere > 0 && (
                <button onClick={() => markRead(...allIds(list))}>Mark all {unreadHere} as read</button>
              )}
            </div>
          )}
          {tab === 'moves' && <PricePane moves={moves} prices={px?.prices || []} cfg={cfg} items={items} isRead={isRead} markRead={markRead} />}
          {tab === 'important' && <StoryPane list={list} isRead={isRead} onOpen={openStory} hero empty="Nothing material in this window." />}
          {tab === 'updates' && <StoryPane list={list} isRead={isRead} onOpen={openStory} empty="No updates in this window." />}
          {tab === 'tracked' && (
            <StoryPane list={list} isRead={isRead} onOpen={openStory}
              empty={<>No material filings of your chosen types. <button className="link" onClick={() => setSheet(true)}>Change types</button></>} />
          )}
          {tab === 'routine' && <RoutinePane list={list} />}
        </div>
      )}

      {open && <Reader g={open} close={() => setOpen(null)} />}
      {sheet && <Settings cfg={cfg} setCfg={setCfg} close={() => setSheet(false)} />}
    </>
  );
}

function Empty({ title, text }) {
  // Every tab stays visible even when empty, so you know it was checked.
  return (
    <div className="empty">
      <EmptyArt />
      <b>{title}</b>
      {text}
    </div>
  );
}

/* ---------------- Price ---------------- */
function PricePane({ moves, prices, cfg, items, isRead, markRead }) {
  return (
    <>
      {moves.length === 0 && <Empty title="Calm day." text="Nothing crossed your price or volume limits." />}
      {moves.map((m, k) => (
        <div key={m.id} className={`card rise ${isRead(m) ? 'read' : 'unread'}`} style={{ animationDelay: `${k * 60}ms` }} onClick={() => markRead(m.id)}>
          {!isRead(m) && <span className="dot" />}
          <Link href={`/research/${m.ticker}`} className="move">
            <div>
              <div className="meta"><span className="t">{m.ticker}</span><span className="mono">₹{m.close.toFixed(1)}</span></div>
              <div className="row" style={{ marginTop: 6 }}>
                <span className={`pill ${tone(m.chg)}`}>{m.chg > 0 ? '▲' : '▼'} {pc(m.chg)}</span>
                {m.hitVol && <span className="pill vol">{m.volX.toFixed(1)}× avg volume</span>}
              </div>
            </div>
            <Spark data={m.spark} w={84} h={32} />
          </Link>
          <Related ticker={m.ticker} items={items} />
        </div>
      ))}
      {prices.length > 0 && (
        <section className="sec">
          <div className="sec-h"><span>All holdings today</span><span>{prices.length}</span></div>
          <div className="grid">
            {prices.map((p) => (
              <Link key={p.ticker} href={`/research/${p.ticker}`} className="tile">
                <b>{p.ticker}</b>
                <span className={`mono ${tone(p.chg)}`}>{pc(p.chg)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Related({ ticker, items }) {
  const f = items.find((i) => i.ticker === ticker && i.tier === 1) || items.find((i) => i.ticker === ticker && i.tier === 2);
  if (!f) return null;
  return <p className="note" style={{ marginTop: 8 }}>Possibly related: {f.line || f.title}</p>;
}

/* ---------------- Stories (Medium-style) ---------------- */
function StoryPane({ list, isRead, onOpen, hero, empty }) {
  if (!list.length) return <Empty title="All quiet." text={empty} />;
  const total = list.reduce((s, g) => s + words(g.line || g.title) + words(g.story), 0);
  const [first, ...rest] = list;
  return (
    <>
      <p className="digest"><b>{list.length}</b> {list.length === 1 ? 'story' : 'stories'} · about {readMins(total)} min to read</p>
      {hero ? <Hero g={first} isRead={isRead(first)} onOpen={() => onOpen(first)} /> : <Story g={first} k={0} isRead={isRead(first)} onOpen={() => onOpen(first)} />}
      {rest.map((g, k) => <Story key={g.id} g={g} k={k + 1} isRead={isRead(g)} onOpen={() => onOpen(g)} />)}
    </>
  );
}

function Byline({ g }) {
  return (
    <div className="byline">
      <span className={`avatar m-${g.mood || 'neutral'}`}>{g.ticker.slice(0, 2)}</span>
      <span className="who">{g.name || g.ticker}</span>
      <span className="in">in</span>
      <span className={`kicker ${g.watched ? 'hot' : ''}`}>{CATEGORY_LABEL[g.category]}</span>
    </div>
  );
}

function Meta({ g }) {
  const mins = readMins(words(g.story) + words(g.line));
  return (
    <div className="smeta">
      {g.mood === 'good' && <span className="mood good">▲ Positive</span>}
      {g.mood === 'bad' && <span className="mood bad">▼ Negative</span>}
      <span>{ago(g.ts)} ago</span><span>·</span><span>{mins} min read</span>
      {g.rest?.length > 0 && <><span>·</span><span>+{g.rest.length} related</span></>}
    </div>
  );
}

function Hero({ g, isRead, onOpen }) {
  return (
    <article className={`hero rise ${isRead ? 'read' : 'unread'}`} onClick={onOpen}>
      <Art category={g.category} mood={g.mood} ticker={g.ticker} size="hero" />
      <div className="hero-body">
        <Byline g={g} />
        <h2 className="s-title">{!isRead && <span className="dot inline" />}{g.line || g.title}</h2>
        {g.story && <p className="s-dek">{g.story}</p>}
        <Meta g={g} />
      </div>
    </article>
  );
}

function Story({ g, k, isRead, onOpen }) {
  return (
    <article className={`story rise ${isRead ? 'read' : 'unread'}`} style={{ animationDelay: `${Math.min(k, 8) * 60}ms` }} onClick={onOpen}>
      <div className="story-main">
        <Byline g={g} />
        <h3 className="s-title sm">{!isRead && <span className="dot inline" />}{g.line || g.title}</h3>
        {g.story && <p className="s-dek sm">{g.story}</p>}
        <Meta g={g} />
      </div>
      <Art category={g.category} mood={g.mood} />
    </article>
  );
}

/* ---------------- Reader ---------------- */
function Reader({ g, close }) {
  const [x, setX] = useState(null);
  const rich = (g.kind === 'results' || g.kind === 'bio') && !g.sample;
  useEffect(() => {
    if (!rich) return;
    const q = new URLSearchParams({ id: g.id, kind: g.kind, pdf: g.pdf || '', h: g.headline, co: g.name || g.ticker, t: g.ticker });
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 90e3);
    fetch(`/api/enrich?${q}`, { signal: ctl.signal }).then((r) => r.json()).then(setX)
      .catch(() => setX({ error: 'Taking too long (free-tier queue). Close and reopen to retry.' }))
      .finally(() => clearTimeout(timer));
    document.body.style.overflow = 'hidden';
    return () => { ctl.abort(); clearTimeout(timer); document.body.style.overflow = ''; };
  }, [g, rich]);

  return (
    <div className="reader" role="dialog" aria-modal="true">
      <div className="reader-in">
        <div className="reader-bar">
          <button className="icon-btn" onClick={close}>← Back</button>
          <span className="date">{new Date(g.ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <Art category={g.category} mood={g.mood} ticker={g.ticker} size="hero" />
        <div className="article">
          <Byline g={g} />
          <h1 className="a-title">{g.line || g.title}</h1>
          <Meta g={g} />
          {g.story ? <p className="a-body">{g.story}</p> : <p className="a-body muted">{g.title}. Open the filing for the full details.</p>}

          {(g.kind === 'results' || g.kind === 'bio') && (
            <div className="a-box">
              <div className="sec-h"><span>{g.kind === 'results' ? 'The numbers' : 'Who is coming in'}</span></div>
              {g.sample ? <p className="err">Sample story: connect live sources to see the {g.kind === 'results' ? 'numbers' : 'background'}.</p>
                : !x ? <Loader steps={g.kind === 'results' ? ['Reading the results filing…', 'Working out QoQ / YoY…'] : ['Finding who was appointed…', 'Looking up their background…']} />
                : x.error ? <p className="err">{x.error}</p>
                : x.type === 'results' ? <><NumTable rows={x.rows} period={x.period} /><p className="note">{x.basis} · {x.note}</p></>
                : <Bio x={x} />}
            </div>
          )}

          {g.rest?.length > 0 && (
            <div className="a-box">
              <div className="sec-h"><span>Earlier in this thread</span><span>{g.rest.length}</span></div>
              {g.rest.map((r) => (
                <a key={r.id} className="thread" href={r.pdf || undefined} target="_blank" rel="noreferrer">
                  <span>{ago(r.ts)}</span>{r.line || r.title}
                </a>
              ))}
            </div>
          )}

          <div className="a-actions">
            {g.pdf && <a className="btn ghost" href={g.pdf} target="_blank" rel="noreferrer">Read the filing ↗</a>}
            <Link className="btn" href={`/research/${g.ticker}`}>Research {g.ticker} →</Link>
          </div>
        </div>
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

/* ---------------- Routine ---------------- */
function RoutinePane({ list }) {
  if (!list.length) return <Empty title="Nothing routine." text="No paperwork filings in this window." />;
  return (
    <>
      <p className="digest"><b>{list.length}</b> filings: trading windows, certificates, newspaper ads and similar.</p>
      {list.map((i) => (
        <div key={i.id} className="line-row dim">
          <span className="t">{i.ticker}</span>
          <a className="txt" href={i.pdf || undefined} target="_blank" rel="noreferrer">{i.title}<small>{CATEGORY_LABEL[i.category]} · {ago(i.ts)}</small></a>
        </div>
      ))}
    </>
  );
}

// One story per company + topic: 8 NCLAT updates from the same case become one story.
function group(list) {
  const map = new Map();
  for (const i of list) {
    const k = `${i.ticker}|${i.category}`;
    if (map.has(k)) map.get(k).rest.push(i);
    else map.set(k, { ...i, rest: [] });
  }
  return [...map.values()];
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
