'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AskBar from '@/components/AskBar';
import { pc, tone, Spark, NumTable, Loader } from '@/components/ui';

const ORDER = ['delivered', 'partly', 'missed', 'too_early', 'unverifiable'];
const LABEL = { delivered: 'Delivered', partly: 'Partly', missed: 'Missed', too_early: 'Too early', unverifiable: 'Unverifiable' };

export default function Research() {
  const { ticker } = useParams();
  const sym = decodeURIComponent(ticker).toUpperCase();
  const router = useRouter();
  const [num, setNum] = useState(null);
  const [pvd, setPvd] = useState(null);

  useEffect(() => {
    setNum(null); setPvd(null);
    fetch(`/api/research/${sym}?part=numbers`).then((r) => r.json()).then((d) => {
      setNum(d);
      if (!d.error) fetch(`/api/research/${sym}?part=guidance`).then((r) => r.json()).then(setPvd).catch((e) => setPvd({ error: e.message }));
    }).catch((e) => setNum({ error: e.message }));
  }, [sym]);

  const maxRev = Math.max(...(num?.trend || []).map((t) => t.rev || 0), 1);

  return (
    <>
      <header className="r-head">
        <button className="icon-btn" onClick={() => (history.length > 1 ? router.back() : router.push('/'))} aria-label="Back">←</button>
        <h1>{sym}</h1>
        {num?.name && <div className="nm">{num.name}</div>}
        {num?.price && (
          <div className="px">
            ₹{num.price.close.toFixed(1)}
            <span className={`pill ${tone(num.price.chg)}`}>{pc(num.price.chg)}</span>
            <Spark data={num.price.spark} w={90} h={26} />
          </div>
        )}
      </header>

      {!num ? <div className="sec"><Loader steps={['Loading reported numbers…']} /></div>
        : num.error ? <div className="sec"><div className="empty"><b>Couldn't load {sym}</b>{num.error}. Check the NSE symbol (e.g. DMART is listed as AVENUEMRT on some sources).</div></div>
        : (
          <>
            <section className="sec">
              <div className="sec-h"><span>Latest quarter</span><span>{num.last.period}</span></div>
              <div className="card"><NumTable rows={num.last.rows} period="" />
                {num.isBank && <p className="note">Bank: revenue = total income; financing profit replaces EBITDA.</p>}
              </div>
            </section>

            <section className="sec">
              <div className="sec-h"><span>8-quarter trajectory</span><span>revenue · margin</span></div>
              <div className="bars">
                {num.trend.map((t) => (
                  <div key={t.l}>
                    <em>{t.m != null ? `${t.m}%` : ''}</em>
                    <span className="b" style={{ height: `${Math.max(4, ((t.rev || 0) / maxRev) * 62)}px` }} />
                    <small>{t.l.replace(' FY', "'")}</small>
                  </div>
                ))}
              </div>
            </section>

            <section className="sec">
              <div className="sec-h"><span>Promised vs delivered</span><span>last {num.concalls.length} calls</span></div>
              {!pvd ? (
                <div className="card"><Loader steps={[`Reading ${num.concalls.length} earnings-call transcripts…`, 'Pulling out every explicit guidance…', 'Checking each promise against reported numbers…', 'Scoring credibility…']} /></div>
              ) : pvd.error ? <div className="card"><p className="err">{pvd.error}</p></div> : <PvD d={pvd} />}
            </section>

            <section className="sec">
              <div className="sec-h"><span>Primary sources</span></div>
              <div className="src" style={{ fontSize: 11.5 }}>
                {num.concalls.map((c) => <a key={c.url} href={c.url} target="_blank" rel="noreferrer">Concall {c.date}</a>)}
                {num.reports.map((r) => <a key={r.url} href={r.url} target="_blank" rel="noreferrer">{r.title}</a>)}
                <a href={num.url} target="_blank" rel="noreferrer">Reported financials</a>
              </div>
            </section>

            <p className="foot">
              Grounded only in company transcripts and reported financials. No news, broker notes or model memory.
              {pvd?.pipeline && <><br />{pvd.pipeline.transcripts} transcripts read by {pvd.pipeline.extract} · judged by {pvd.pipeline.judge} · cached 24h</>}
            </p>
          </>
        )}
      <AskBar hint="Another ticker…" />
    </>
  );
}

function PvD({ d }) {
  const items = [...(d.items || [])].sort((a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict));
  const tally = ORDER.map((v) => [v, items.filter((i) => i.verdict === v).length]).filter(([, n]) => n);
  const score = +d.credibility;
  return (
    <>
      <div className="card">
        <div className="score">
          <div className={`n ${score >= 7 ? 'up' : score < 5 ? 'down' : ''}`} style={score >= 5 && score < 7 ? { color: 'var(--accent)' } : {}}>
            {Number.isFinite(score) ? score : '–'}<small>/10</small>
          </div>
          <p>{d.headline}</p>
        </div>
        <div className="tally">{tally.map(([v, n]) => <span key={v} className={`v ${v}`}>{n} {LABEL[v]}</span>)}</div>
      </div>

      {items.map((it, k) => (
        <div key={k} className="pvd">
          <div className="m">
            <span className={`v ${it.verdict}`}>{LABEL[it.verdict] || it.verdict}</span>
            <span>{it.metric}</span>
            <span className="tr">{it.said_in}{it.trend && it.trend !== 'new' ? ` · ${it.trend}` : ''}</span>
          </div>
          <p className="p">{it.promise}{it.horizon ? <span style={{ color: 'var(--faint)' }}> ({it.horizon})</span> : null}</p>
          <p className="e">{it.evidence}</p>
        </div>
      ))}

      {d.drift?.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="sec-h"><span>How the story shifted</span></div>
          <ul className="bul">{d.drift.map((x, k) => <li key={k}>{x}</li>)}</ul>
        </div>
      )}
      {d.watch && <div className="watch"><b>WATCH NEXT QUARTER</b>{d.watch}</div>}

      <div style={{ marginTop: 14 }}>
        <div className="sec-h"><span>Call by call</span><span>tap for quotes</span></div>
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
    </>
  );
}
