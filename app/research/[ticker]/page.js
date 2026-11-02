'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ModeToggle from '@/components/ModeToggle';
import { pc, tone, cr, Spark, NumTable, Loader, useSession } from '@/components/ui';

// The brief's eight research outputs, one tab each. "src" says where each one comes from.
const SECTIONS = [
  ['business', 'Business snapshot', 'ai'],
  ['financials', 'Financial snapshot', 'num'],
  ['trajectory', 'Trajectory', 'num'],
  ['balance', 'Balance sheet', 'num'],
  ['cash', 'Cash quality', 'num'],
  ['narrative', 'Narrative vs numbers', 'ai'],
  ['guidance', 'Guidance', 'ai'],
  ['bullbear', 'Bull vs bear', 'ai'],
];
const ORDER = ['delivered', 'partly', 'missed', 'too_early', 'unverifiable'];
const LABEL = { delivered: 'Delivered', partly: 'Partly', missed: 'Missed', too_early: 'Too early', unverifiable: 'Unverifiable' };

export default function Report() {
  const { ticker } = useParams();
  const sym = decodeURIComponent(ticker).toUpperCase();
  const router = useRouter();
  const [num, setNum] = useState(null);
  const [pvd, setPvd] = useState(null);
  const [biz, setBiz] = useState(null);
  const [tab, setTab] = useSession('finn.rtab', 'narrative');
  const [, setRecent] = useSession('finn.recent', []);

  useEffect(() => {
    setNum(null); setPvd(null); setBiz(null);
    const key = `finn.r3.${sym}`;
    let hit = {};
    try { hit = JSON.parse(sessionStorage.getItem(key) || '{}'); } catch {}
    const save = (k, v) => { try { const o = JSON.parse(sessionStorage.getItem(key) || '{}'); o[k] = v; sessionStorage.setItem(key, JSON.stringify(o)); } catch {} };
    const ai = (part, set, k) => {
      if (hit[k]) return set(hit[k]);
      fetch(`/api/research/${sym}?part=${part}`).then((r) => r.json())
        .then((d) => { set(d); if (!d.error) save(k, d); })
        .catch((e) => set({ error: e.message }));
    };
    const start = (d) => {
      setNum(d);
      setRecent((r) => [{ sym, name: d.name }, ...r.filter((x) => x.sym !== sym)].slice(0, 8));
      ai('guidance', setPvd, 'pvd');
      ai('business', setBiz, 'biz');
    };
    if (hit.num) return start(hit.num);
    fetch(`/api/research/${sym}?part=numbers`).then((r) => r.json()).then(async (d) => {
      if (d.error) {
        const res = await fetch(`/api/resolve?ai=1&q=${encodeURIComponent(sym)}`).then((r) => r.json()).catch(() => ({}));
        const to = res.results?.[0]?.sym;
        if (to && to.toUpperCase() !== sym) return router.replace(`/research/${to}`);
        return setNum(d);
      }
      save('num', d);
      start(d);
    }).catch((e) => setNum({ error: e.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sym]);

  const state = (k) => {
    const src = SECTIONS.find((s) => s[0] === k)[2];
    const d = src === 'num' ? num : k === 'business' ? biz : pvd;
    return !d ? 'loading' : d.error ? 'error' : 'ready';
  };
  const label = SECTIONS.find((s) => s[0] === tab)?.[1];

  return (
    <>
      <header className="top">
        <ModeToggle right={<button className="icon-btn" onClick={() => router.push('/research')}>← Search</button>} />
        <p className="eyebrow">Pull › {num?.name || sym}</p>
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          <h1 className="page-title r-title">{label}</h1>
          {num?.price && (
            <div className="px-mini">
              <span className="mono">{sym} ₹{num.price.close.toFixed(1)}</span>
              <span className={`pill ${tone(num.price.chg)}`}>{pc(num.price.chg)}</span>
            </div>
          )}
        </div>
        <nav className="utabs scroll" role="tablist">
          {SECTIONS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}
              ref={(el) => { if (el && tab === k) el.scrollIntoView({ block: 'nearest', inline: 'center' }); }}>
              {l}
              {num && !num.error && <i className={`st ${state(k)}`} />}
            </button>
          ))}
        </nav>
      </header>

      {!num ? <div className="sec"><Loader steps={['Loading reported financials…']} /></div>
        : num.error ? (
          <div className="empty"><b>Couldn't load {sym}</b>{/404/.test(num.error) ? `"${sym}" didn't match a listed company. Search by company name instead.` : `${num.error}. The data source may be unreachable right now.`}</div>
        ) : (
          <div className="pane" key={tab}>
            {tab === 'business' && <Business d={biz} />}
            {tab === 'financials' && <Financials d={num} />}
            {tab === 'trajectory' && <Trajectory d={num.trajectory} />}
            {tab === 'balance' && <Balance d={num.balance} />}
            {tab === 'cash' && <Cash d={num.cash} />}
            {tab === 'narrative' && <Narrative d={pvd} n={num.concalls.length} />}
            {tab === 'guidance' && <Guidance d={pvd} />}
            {tab === 'bullbear' && <BullBear d={pvd} />}
            <Sources num={num} biz={biz} />
          </div>
        )}
    </>
  );
}

/* ---------- shared bits ---------- */
function Findings({ list }) {
  if (!list?.length) return null;
  return (
    <ul className="findings">
      {list.map((f, k) => <li key={k} className={`rise f-${f.tone}`} style={{ animationDelay: `${k * 70}ms` }}>{f.t}</li>)}
    </ul>
  );
}
function Wait({ d, steps }) {
  if (!d) return <div className="card"><Loader steps={steps} /></div>;
  if (d.error) return <div className="card"><p className="err">{d.error}</p></div>;
  return null;
}
function Bars({ data, fmt = (v) => cr(v), sub, accent }) {
  const vals = data.map((x) => x.v).filter((v) => v != null);
  if (!vals.length) return null;
  const max = Math.max(...vals.map(Math.abs), 1);
  return (
    <div className="bars">
      {data.map((x, k) => (
        <div key={x.l}>
          <em>{sub ? sub(x) : ''}</em>
          <span className={`b grow ${x.v < 0 ? 'neg' : ''} ${accent && k === data.length - 1 ? 'last' : ''}`} style={{ height: `${Math.max(3, (Math.abs(x.v || 0) / max) * 62)}px`, animationDelay: `${k * 60}ms` }} title={fmt(x.v)} />
          <small>{x.l.replace(' FY', "'")}</small>
        </div>
      ))}
    </div>
  );
}
const Src = ({ children }) => <p className="srcline">⚙ {children}</p>;

/* ---------- 1. Business snapshot ---------- */
function Business({ d }) {
  const w = Wait({ d, steps: ['Opening the latest annual report…', 'Reading what the company does…', 'Pulling out segments and revenue mix…'] });
  if (w) return w;
  return (
    <>
      <p className="lead rise">{d.what}</p>
      {d.segments?.length > 0 && (
        <div className="card">
          <div className="sec-h"><span>Segments</span><span>share of revenue</span></div>
          {d.segments.map((s, k) => {
            const n = parseFloat(String(s.share || '').replace(/[^\d.]/g, ''));
            return (
              <div key={k} className="seg-row">
                <div className="row between"><b>{s.name}</b><span className="mono">{s.share || '—'}</span></div>
                {isFinite(n) && <div className="meter"><span className="grow-x" style={{ width: `${Math.min(100, n)}%` }} /></div>}
                {s.note && <p className="note">{s.note}</p>}
              </div>
            );
          })}
        </div>
      )}
      {d.mix && <p className="sub" style={{ marginTop: 10 }}><b>Revenue mix:</b> {d.mix}</p>}
      {d.facts?.length > 0 && <ul className="findings">{d.facts.map((f, k) => <li key={k} className="f-neutral">{f}</li>)}</ul>}
      <Src>Source: <a href={d.source?.url} target="_blank" rel="noreferrer">{d.source?.title}</a>{d.source_note ? ` · ${d.source_note}` : ''}</Src>
    </>
  );
}

/* ---------- 2. Financial snapshot ---------- */
function Financials({ d }) {
  const f = d.financials;
  return (
    <>
      <div className="kpis">
        {f.keys.map(([k, v], i) => <div key={k} className="kpi rise" style={{ animationDelay: `${i * 40}ms` }}><span>{k}</span><b className="mono">{v}</b></div>)}
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="sec-h"><span>Latest quarter</span><span>{f.quarter.period}</span></div>
        <NumTable rows={f.quarter.rows} period="" />
        {d.isBank && <p className="note">Bank: revenue = total income; financing profit replaces EBITDA.</p>}
      </div>
      {d.price?.spark && <div className="card"><div className="sec-h"><span>Price, last 30 sessions</span></div><Spark data={d.price.spark} w={320} h={60} /></div>}
      <Src>Reported financials (company filings, standardised). Price: end-of-day.</Src>
    </>
  );
}

/* ---------- 3. Trajectory ---------- */
function Trajectory({ d }) {
  return (
    <>
      <Findings list={d.findings} />
      {d.annual?.length > 0 && (
        <div className="card"><div className="sec-h"><span>Annual revenue</span><span>OPM % above bars</span></div>
          <Bars data={d.annual} sub={(x) => (x.m != null ? `${x.m}%` : '')} accent /></div>
      )}
      {d.annual?.some((x) => x.pat != null) && (
        <div className="card"><div className="sec-h"><span>Annual profit (PAT)</span><span>₹ Cr</span></div>
          <Bars data={d.annual.map((x) => ({ l: x.l, v: x.pat }))} sub={(x) => (x.v != null ? Math.round(x.v).toLocaleString('en-IN') : '')} accent /></div>
      )}
      <div className="card"><div className="sec-h"><span>Last 8 quarters</span><span>revenue · margin</span></div>
        <Bars data={d.quarters} sub={(x) => (x.m != null ? `${x.m}%` : '')} accent /></div>
      <Src>Computed in code from reported annual and quarterly results.</Src>
    </>
  );
}

/* ---------- 4. Balance sheet ---------- */
function Balance({ d }) {
  return (
    <>
      <Findings list={d.findings} />
      {d.rows?.some((r) => r.de != null) && (
        <div className="card"><div className="sec-h"><span>Debt to equity</span><span>× by year</span></div>
          <Bars data={d.rows.map((r) => ({ l: r.p, v: r.de }))} sub={(x) => (x.v != null ? `${x.v}×` : '')} fmt={(v) => `${v}×`} accent /></div>
      )}
      {d.funding?.length > 0 && (
        <div className="card"><div className="sec-h"><span>How it's funded</span><span>% of balance sheet</span></div>
          {d.funding.map((x) => (
            <div key={x.k} className="seg-row">
              <div className="row between"><b>{x.k}</b><span className="mono">{x.share}% · {cr(x.v)} Cr</span></div>
              <div className="meter"><span className="grow-x" style={{ width: `${Math.min(100, x.share)}%` }} /></div>
            </div>
          ))}
        </div>
      )}
      {d.wc?.some((r) => r.ccc != null) && (
        <div className="card"><div className="sec-h"><span>Working-capital cycle</span><span>days</span></div>
          <table className="nt"><thead><tr><th>Year</th><th>Debtor</th><th>Inventory</th><th>Payable</th><th>Cycle</th></tr></thead>
            <tbody>{d.wc.map((r) => <tr key={r.p}><td>{r.p}</td><td className="mono">{r.debtor ?? '—'}</td><td className="mono">{r.inventory ?? '—'}</td><td className="mono">{r.payable ?? '—'}</td><td className="mono"><b>{r.ccc ?? '—'}</b></td></tr>)}</tbody>
          </table>
        </div>
      )}
      <Src>Computed in code from reported balance sheets and ratios.</Src>
    </>
  );
}

/* ---------- 5. Cash quality ---------- */
function Cash({ d }) {
  return (
    <>
      <Findings list={d.findings} />
      {d.rows?.length > 0 && (
        <div className="card"><div className="sec-h"><span>Profit vs operating cash</span><span>₹ Cr</span></div>
          <div className="pairs">
            {d.rows.map((r, k) => {
              const max = Math.max(...d.rows.flatMap((x) => [Math.abs(x.cfo || 0), Math.abs(x.pat || 0)]), 1);
              return (
                <div key={r.p}>
                  <em className={r.conv == null ? '' : r.conv >= 90 ? 'up' : r.conv < 60 ? 'down' : ''}>{r.conv != null ? `${r.conv}%` : ''}</em>
                  <div className="pair">
                    <span className="b grow pat" style={{ height: `${Math.max(3, (Math.abs(r.pat || 0) / max) * 62)}px`, animationDelay: `${k * 60}ms` }} />
                    <span className={`b grow cfo ${r.cfo < 0 ? 'neg' : ''}`} style={{ height: `${Math.max(3, (Math.abs(r.cfo || 0) / max) * 62)}px`, animationDelay: `${k * 60 + 30}ms` }} />
                  </div>
                  <small>{r.p}</small>
                </div>
              );
            })}
          </div>
          <p className="note"><i className="key pat" /> Profit (PAT) <i className="key cfo" /> Operating cash flow · % = cash ÷ profit</p>
        </div>
      )}
      <Src>Computed in code from reported cash-flow statements.</Src>
    </>
  );
}

/* ---------- 6. Narrative vs numbers ---------- */
function Narrative({ d, n }) {
  const w = Wait({ d, steps: [`Reading ${n} earnings-call transcripts…`, 'Pulling out every explicit promise…', 'Checking each one against reported numbers…', 'Scoring credibility…'] });
  if (w) return w;
  const items = [...(d.items || [])].sort((a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict));
  const tally = ORDER.map((v) => [v, items.filter((i) => i.verdict === v).length]).filter(([, c]) => c);
  const score = +d.credibility;
  return (
    <>
      <div className="card rise">
        <div className="score">
          <div className={`n ${score >= 7 ? 'up' : score < 5 ? 'down' : 'mid'}`}>{Number.isFinite(score) ? score : '–'}<small>/10</small></div>
          <p>{d.headline}</p>
        </div>
        <div className="meter big"><span className="grow-x" style={{ width: `${(score || 0) * 10}%` }} /></div>
        <div className="tally">{tally.map(([v, c]) => <span key={v} className={`v ${v}`}>{c} {LABEL[v]}</span>)}</div>
      </div>
      <p className="sub" style={{ margin: '14px 0 4px' }}>Last four quarters: what management promised vs what was delivered.</p>
      {items.map((it, k) => (
        <div key={k} className="pvd rise" style={{ animationDelay: `${k * 50}ms` }}>
          <div className="m"><span className={`v ${it.verdict}`}>{LABEL[it.verdict] || it.verdict}</span><span>{it.metric}</span><span className="tr">{it.said_in}{it.trend && it.trend !== 'new' ? ` · ${it.trend}` : ''}</span></div>
          <p className="p">{it.promise}{it.horizon ? <span style={{ color: 'var(--faint)' }}> ({it.horizon})</span> : null}</p>
          <p className="e">{it.evidence}</p>
        </div>
      ))}
      {d.drift?.length > 0 && (
        <div className="card" style={{ marginTop: 14 }}><div className="sec-h"><span>How the story shifted</span></div><ul className="bul">{d.drift.map((x, k) => <li key={k}>{x}</li>)}</ul></div>
      )}
      {d.watch && <div className="watch"><b>WATCH NEXT QUARTER</b>{d.watch}</div>}
      <div className="sec"><div className="sec-h"><span>Call by call</span><span>tap for quotes</span></div>
        {(d.calls || []).map((c) => (
          <details key={c.url} className="pvd">
            <summary>
              <div className="m"><span style={{ color: 'var(--text)' }}>{c.quarter || c.date}</span><span>{c.tone}</span><span className="tr">{c.date}</span></div>
              {c.pressed_on?.length > 0 && <p className="e">Analysts pressed on: {c.pressed_on.join('; ')}</p>}
            </summary>
            {c.quotes.filter((q) => q.quote).map((q, k) => <p key={k} className="quote">“{q.quote}” <span style={{ color: 'var(--faint)' }}>({q.speaker || q.metric})</span></p>)}
            <a className="note" href={c.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>Open transcript ↗</a>
          </details>
        ))}
      </div>
      {d.pipeline && <Src>{d.pipeline.transcripts} transcripts read by {d.pipeline.extract}, judged by {d.pipeline.judge} against reported quarterly numbers.</Src>}
    </>
  );
}

/* ---------- 7. Guidance ---------- */
function Guidance({ d }) {
  const w = Wait({ d, steps: ['Reading the latest earnings call…', 'Listing what management guided…'] });
  if (w) return w;
  const g = d.guidance || {};
  const open = (d.items || []).filter((i) => i.verdict === 'too_early');
  return (
    <>
      <p className="sub">From the {g.quarter || 'latest'} call ({g.date}) · management tone: <b>{g.tone || '—'}</b></p>
      {!g.items?.length && <div className="empty"><b>No explicit guidance.</b>Management didn't commit to numbers on the latest call.</div>}
      {g.items?.map((x, k) => (
        <div key={k} className="card rise" style={{ animationDelay: `${k * 50}ms` }}>
          <div className="meta"><span className="tag hot">{x.metric}</span>{x.horizon && <span className="when">{x.horizon}</span>}</div>
          <p className="hl">{x.promise}{x.target ? <b className="mono" style={{ color: 'var(--accent-ink)' }}> · {x.target}</b> : null}</p>
          {x.quote && <p className="quote">“{x.quote}” <span style={{ color: 'var(--faint)' }}>({x.speaker || 'management'})</span></p>}
        </div>
      ))}
      {open.length > 0 && (
        <div className="card"><div className="sec-h"><span>Still open from earlier calls</span><span>{open.length}</span></div>
          <ul className="bul">{open.map((i, k) => <li key={k}>{i.promise} <span style={{ color: 'var(--faint)' }}>({i.horizon})</span></li>)}</ul></div>
      )}
      {g.risks?.length > 0 && (
        <div className="card"><div className="sec-h"><span>Risks management flagged</span></div><ul className="bul">{g.risks.map((r, k) => <li key={k}>{r}</li>)}</ul></div>
      )}
      <Src>Source: <a href={g.url} target="_blank" rel="noreferrer">concall transcript, {g.date}</a></Src>
    </>
  );
}

/* ---------- 8. Bull vs bear ---------- */
function BullBear({ d }) {
  const w = Wait({ d, steps: ['Weighing the evidence…', 'Writing the case each way…'] });
  if (w) return w;
  return (
    <>
      <div className="case bull rise">
        <h3>▲ Bull case</h3>
        <ol>{(d.bull || []).filter((x) => x.trim()).map((x, k) => <li key={k}>{x}</li>)}</ol>
      </div>
      <div className="case bear rise" style={{ animationDelay: '120ms' }}>
        <h3>▼ Bear case</h3>
        <ol>{(d.bear || []).filter((x) => x.trim()).map((x, k) => <li key={k}>{x}</li>)}</ol>
      </div>
      <Src>Built only from the transcripts and reported numbers in the other tabs. Not investment advice.</Src>
    </>
  );
}

function Sources({ num, biz }) {
  return (
    <div className="sec">
      <div className="sec-h"><span>Primary sources</span></div>
      <div className="src" style={{ fontSize: 11.5 }}>
        {num.concalls.map((c) => <a key={c.url} href={c.url} target="_blank" rel="noreferrer">Concall {c.date}</a>)}
        {num.reports.map((r) => <a key={r.url} href={r.url} target="_blank" rel="noreferrer">{r.title}</a>)}
        <a href={num.url} target="_blank" rel="noreferrer">Reported financials</a>
      </div>
      <p className="foot">Pull-side analysis uses only company filings: annual reports, concall transcripts and reported financials. No news, broker notes or model memory.</p>
    </div>
  );
}
