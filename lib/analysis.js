// Deterministic research sections, computed in code from reported financials (no LLM, no tokens).
// Each section returns { rows/series, findings[] } where findings are plain-English statements
// generated from the numbers, so the screen reads like analysis but every word is checkable.

const last = (a, n = 1) => (a ? a.filter((v) => v != null).slice(-n) : []);
const pct = (a, b) => (a != null && b ? ((a - b) / Math.abs(b)) * 100 : null);
const cagr = (end, start, yrs) => (end > 0 && start > 0 && yrs > 0 ? (Math.pow(end / start, 1 / yrs) - 1) * 100 : null);
const r1 = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 10) / 10);
// Annual tables end with "TTM" sometimes: keep only fiscal-year columns for trends.
const fyCols = (periods) => periods.map((p, i) => [p, i]).filter(([p]) => /^FY\d{2}$/.test(p));

function series(block, key, n = 6) {
  if (!block?.[key]) return [];
  return fyCols(block.periods).slice(-n).map(([p, i]) => ({ p, v: block[key][i] }));
}

export function financialSnapshot(s, latestQ) {
  const t = s.top || {};
  const pick = (re) => Object.entries(t).find(([k]) => re.test(k))?.[1] || null;
  const a = s.annual;
  const ttmIdx = a ? a.periods.indexOf('TTM') : -1;
  return {
    quarter: latestQ,
    keys: [
      ['Market cap', pick(/market cap/i)],
      ['Price', pick(/current price/i)],
      ['P/E', pick(/stock p\/e/i)],
      ['ROCE', pick(/^roce/i)],
      ['ROE', pick(/^roe/i)],
      ['Dividend yield', pick(/dividend yield/i)],
      ['TTM revenue', ttmIdx >= 0 && a.sales ? `₹${Math.round(a.sales[ttmIdx]).toLocaleString('en-IN')} Cr` : null],
      ['TTM profit', ttmIdx >= 0 && a.pat ? `₹${Math.round(a.pat[ttmIdx]).toLocaleString('en-IN')} Cr` : null],
    ].filter(([, v]) => v),
  };
}

export function trajectory(s) {
  const sales = series(s.annual, 'sales', 6);
  const opm = series(s.annual, 'opm', 6);
  const pat = series(s.annual, 'pat', 6);
  const f = [];
  if (sales.length >= 4) {
    const n = sales.length - 1;
    const g = cagr(sales[n].v, sales[0].v, n);
    const g3 = cagr(sales[n].v, sales[n - 3].v, 3);
    if (g != null) f.push({ t: `Revenue grew ${r1(g)}% a year over ${n} years (${sales[0].p} → ${sales[n].p})${g3 != null ? `, ${r1(g3)}% a year in the last 3` : ''}.`, tone: g3 != null && g != null && g3 < g - 3 ? 'bad' : g > 10 ? 'good' : 'neutral' });
  }
  if (pat.length >= 4) {
    const n = pat.length - 1;
    const g = cagr(pat[n].v, pat[0].v, n);
    if (g != null) f.push({ t: `Profit grew ${r1(g)}% a year over the same period.`, tone: g > 12 ? 'good' : g < 0 ? 'bad' : 'neutral' });
    else if (pat[n].v < 0) f.push({ t: `The company is loss-making in ${pat[n].p}.`, tone: 'bad' });
  }
  if (opm.length >= 3 && opm[0].v != null && opm.at(-1).v != null) {
    const d = opm.at(-1).v - opm[0].v;
    f.push({ t: `Operating margin ${Math.abs(d) < 1.5 ? 'held roughly flat' : d > 0 ? 'expanded' : 'compressed'}: ${opm[0].v}% in ${opm[0].p} → ${opm.at(-1).v}% in ${opm.at(-1).p}.`, tone: d >= 1.5 ? 'good' : d <= -1.5 ? 'bad' : 'neutral' });
  }
  const q = s.quarters;
  const n = q.periods.length;
  const yoyRev = n > 4 ? pct(q.revenue?.[n - 1], q.revenue?.[n - 5]) : null;
  if (yoyRev != null) f.push({ t: `Latest quarter revenue is ${yoyRev >= 0 ? 'up' : 'down'} ${Math.abs(r1(yoyRev))}% on a year ago.`, tone: yoyRev > 8 ? 'good' : yoyRev < 0 ? 'bad' : 'neutral' });
  return {
    annual: sales.map((x, i) => ({ l: x.p, v: x.v, m: opm[i]?.v, pat: pat[i]?.v })),
    quarters: q.labels.slice(Math.max(0, n - 8)).map((l, j) => ({ l, v: q.revenue?.[Math.max(0, n - 8) + j], m: q.margin?.[Math.max(0, n - 8) + j] })),
    findings: f,
  };
}

export function balanceSheet(s, isBank) {
  const b = s.balance;
  if (!b) return { findings: [{ t: 'Balance sheet not available for this company.', tone: 'neutral' }] };
  const cols = fyCols(b.periods).slice(-6);
  const rows = cols.map(([p, i]) => ({
    p,
    equity: b.equity?.[i],
    debt: b.borrowings?.[i],
    de: b.equity?.[i] ? r1((b.borrowings?.[i] || 0) / b.equity[i]) : null,
    cwip: b.cwip?.[i],
    total: b.total?.[i],
  }));
  const r = s.ratios;
  const wc = r ? fyCols(r.periods).slice(-6).map(([p, i]) => ({ p, ccc: r.ccc?.[i], debtor: r.debtor?.[i], inventory: r.inventory?.[i], payable: r.payable?.[i], wc: r.wc?.[i] })) : [];
  const f = [];
  const now = rows.at(-1), then = rows[0];
  if (isBank) {
    f.push({ t: 'Banks borrow by design (deposits are their raw material), so debt-to-equity is not a useful health check here.', tone: 'neutral' });
  } else if (now?.de != null) {
    f.push({ t: `Debt-to-equity is ${now.de}× in ${now.p}${then?.de != null && then !== now ? ` (was ${then.de}× in ${then.p})` : ''}. ${now.de < 0.3 ? 'Low leverage: growth is funded mostly by equity and internal cash.' : now.de < 1 ? 'Moderate leverage.' : 'High leverage: debt is a big part of funding.'}`, tone: now.de < 0.5 ? 'good' : now.de > 1.2 ? 'bad' : 'neutral' });
  }
  if (!isBank && now?.debt != null && then?.debt != null && then !== now) {
    const d = pct(now.debt, then.debt);
    if (d != null && Math.abs(d) > 15) f.push({ t: `Borrowings ${d > 0 ? 'rose' : 'fell'} ${Math.abs(Math.round(d))}% from ${then.p} to ${now.p} (₹${Math.round(then.debt).toLocaleString('en-IN')} → ₹${Math.round(now.debt).toLocaleString('en-IN')} Cr).`, tone: d > 0 ? 'neutral' : 'good' });
  }
  if (now?.cwip && now?.total) {
    const share = (now.cwip / now.total) * 100;
    if (share > 3) f.push({ t: `Capital work-in-progress is ${r1(share)}% of the balance sheet: capacity is being built that isn't earning yet.`, tone: 'neutral' });
  }
  const w = wc.filter((x) => x.ccc != null);
  if (w.length >= 2) {
    const a = w[0], z = w.at(-1);
    f.push({ t: `Cash conversion cycle: ${z.ccc} days in ${z.p} vs ${a.ccc} in ${a.p}. ${z.ccc > a.ccc + 10 ? 'More cash is getting tied up in operations.' : z.ccc < a.ccc - 10 ? 'Less cash is tied up in operations than before.' : 'Broadly stable.'}`, tone: z.ccc > a.ccc + 10 ? 'bad' : z.ccc < a.ccc - 10 ? 'good' : 'neutral' });
  }
  const funding = now && now.total ? [
    ['Equity', now.equity], ['Borrowings', isBank ? null : now.debt], ['Deposits', isBank ? b.deposits?.[cols.at(-1)[1]] : null],
  ].filter(([, v]) => v).map(([k, v]) => ({ k, v, share: r1((v / now.total) * 100) })) : [];
  return { rows, wc, funding, findings: f };
}

export function cashQuality(s, isBank) {
  const c = s.cash, a = s.annual;
  if (!c?.cfo || !a?.pat) return { findings: [{ t: 'Cash flow statement not available for this company.', tone: 'neutral' }] };
  const yrs = fyCols(c.periods).slice(-6);
  const patBy = Object.fromEntries(fyCols(a.periods).map(([p, i]) => [p, a.pat[i]]));
  const rows = yrs.map(([p, i]) => ({ p, cfo: c.cfo[i], cfi: c.cfi?.[i], pat: patBy[p], conv: patBy[p] > 0 ? Math.round((c.cfo[i] / patBy[p]) * 100) : null }));
  const f = [];
  if (isBank) {
    f.push({ t: "For a bank, operating cash flow swings with deposits and loans, so 'profit turning into cash' is not a meaningful test.", tone: 'neutral' });
    return { rows, findings: f };
  }
  const ok = rows.filter((r) => r.cfo != null && r.pat > 0);
  if (ok.length >= 3) {
    const conv = Math.round((ok.reduce((x, r) => x + r.cfo, 0) / ok.reduce((x, r) => x + r.pat, 0)) * 100);
    f.push({ t: `Over ${ok.length} years, operating cash flow was ${conv}% of reported profit. ${conv >= 90 ? 'Profits are turning into cash.' : conv >= 70 ? 'Most profit converts to cash, with some leakage.' : 'A large part of profit is not showing up as cash; check receivables and inventory.'}`, tone: conv >= 90 ? 'good' : conv >= 70 ? 'neutral' : 'bad' });
    const weak = ok.filter((r) => r.conv < 60).map((r) => r.p);
    if (weak.length) f.push({ t: `Weak conversion years (under 60%): ${weak.join(', ')}.`, tone: 'bad' });
    const neg = rows.filter((r) => r.cfo < 0).map((r) => r.p);
    if (neg.length) f.push({ t: `Operating cash flow was negative in ${neg.join(', ')}.`, tone: 'bad' });
  }
  const inv = rows.filter((r) => r.cfi != null && r.cfo);
  if (inv.length >= 3) {
    const share = Math.round((-inv.reduce((x, r) => x + r.cfi, 0) / inv.reduce((x, r) => x + r.cfo, 0)) * 100);
    f.push({ t: `It reinvested about ${share}% of operating cash (investing outflows vs operating inflows) over these years.`, tone: 'neutral' });
  }
  return { rows, findings: f };
}

// Compact numeric context for the AI judge (bull/bear), so it reasons from facts, not memory.
export function factsForJudge(tr, bsh, cq) {
  return [...tr.findings, ...bsh.findings, ...cq.findings].map((x) => x.t);
}
