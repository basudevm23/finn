// screener.in: standardised quarterly numbers (from company filings) + links to
// concall transcripts and annual reports. Deterministic parsing, zero tokens.
import * as cheerio from 'cheerio';
import { UA } from './gemini';

const MON = { Mar: 4, Jun: 1, Sep: 2, Dec: 3 };
export function fyLabel(p) {
  const [m, y] = p.split(' ');
  const q = MON[m];
  if (!q) return p;
  const fy = (q === 4 ? +y : +y + 1) % 100;
  return `Q${q} FY${String(fy).padStart(2, '0')}`;
}

const num = (s) => {
  const v = parseFloat(String(s).replace(/[,%\s]/g, ''));
  return Number.isFinite(v) ? v : null;
};
const key = (s) => s.replace(/ /g, ' ').replace(/[^A-Za-z% ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

function table($, sel) {
  const t = $(sel).first();
  if (!t.length) return null;
  const periods = t.find('thead th').map((_, th) => $(th).text().trim()).get().slice(1);
  const rows = {};
  t.find('tbody tr').each((_, tr) => {
    const tds = $(tr).find('td');
    const k = key($(tds[0]).text());
    if (k) rows[k] = tds.slice(1).map((_, td) => num($(td).text())).get();
  });
  return { periods, rows };
}

const pick = (rows, names) => names.map((n) => rows[n]).find(Boolean) || null;

async function page(url) {
  const r = await fetch(url, { headers: UA, next: { revalidate: 21600 } });
  if (!r.ok) throw new Error(`screener ${r.status}`);
  return cheerio.load(await r.text());
}

export async function screener(sym) {
  sym = sym.toUpperCase().replace(/[^A-Z0-9&-]/g, '');
  let $, q, url;
  for (url of [`https://www.screener.in/company/${sym}/consolidated/`, `https://www.screener.in/company/${sym}/`]) {
    try {
      $ = await page(url);
      q = table($, '#quarters table');
      if (q && q.periods.length && Object.keys(q.rows).length > 3) break;
    } catch (e) {
      if (url.endsWith(`${sym}/`)) throw e;
    }
  }
  if (!q) throw new Error(`No screener data for ${sym}`);

  const R = q.rows;
  const isBank = !R['sales'] && !!R['revenue'] && !!R['financing profit'];
  const quarters = {
    periods: q.periods,
    labels: q.periods.map(fyLabel),
    revenue: pick(R, ['sales', 'revenue']),
    ebitda: pick(R, ['operating profit', 'financing profit']),
    margin: pick(R, ['opm %', 'financing margin %']),
    pbt: pick(R, ['profit before tax']),
    pat: pick(R, ['net profit']),
    isBank,
  };

  // Concall transcripts: anchors labelled "Transcript" inside the documents section
  const concalls = [];
  $('#documents .concalls li, #documents li').each((_, li) => {
    const a = $(li).find('a').filter((_, x) => /transcript/i.test($(x).text()));
    if (!a.length) return;
    const date = ($(li).text().match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}/) || [])[0];
    const href = a.first().attr('href');
    if (href && !concalls.some((c) => c.url === href)) concalls.push({ date: date || 'Undated', url: new URL(href, url).href });
  });

  const reports = [];
  $('#documents .annual-reports a').each((_, a) => {
    const t = $(a).text().replace(/\s+/g, ' ').trim();
    const href = new URL($(a).attr('href'), url).href;
    if (reports.length < 3 && !reports.some((r) => r.url === href)) reports.push({ title: t, url: href });
  });

  // Annual statements (all straight from company filings, standardised by screener)
  const yr = (p) => (/^mar \d{4}$/i.test(p) ? `FY${p.slice(-2)}` : p.replace(/^([A-Za-z]{3}) (\d{4})$/, (_, m, y) => `${m} ${y.slice(-2)}`));
  const annual = (sel) => {
    const t = table($, sel);
    if (!t) return null;
    return { periods: t.periods.map(yr), rows: t.rows };
  };
  const pl = annual('#profit-loss table');
  const bs = annual('#balance-sheet table');
  const cf = annual('#cash-flow table');
  const ra = annual('#ratios table');

  const top = {};
  $('#top-ratios li').each((_, li) => {
    const n = $(li).find('.name').text().replace(/\s+/g, ' ').trim();
    const v = $(li).find('.value').text().replace(/\s+/g, ' ').trim();
    if (n) top[n] = v;
  });

  return {
    sym,
    name: $('h1').first().text().trim() || sym,
    url,
    quarters,
    annual: pl && {
      periods: pl.periods,
      sales: pick(pl.rows, ['sales', 'revenue']),
      opm: pick(pl.rows, ['opm %', 'financing margin %']),
      pat: pick(pl.rows, ['net profit']),
    },
    balance: bs && {
      periods: bs.periods,
      equity: sumRows(bs.rows['equity capital'], bs.rows['reserves']),
      borrowings: pick(bs.rows, ['borrowings', 'borrowing']),
      deposits: bs.rows['deposits'] || null,
      other: bs.rows['other liabilities'] || null,
      total: bs.rows['total liabilities'] || null,
      cwip: bs.rows['cwip'] || null,
      investments: bs.rows['investments'] || null,
    },
    cash: cf && {
      periods: cf.periods,
      cfo: pick(cf.rows, ['cash from operating activity']),
      cfi: pick(cf.rows, ['cash from investing activity']),
      cff: pick(cf.rows, ['cash from financing activity']),
    },
    ratios: ra && {
      periods: ra.periods,
      debtor: ra.rows['debtor days'] || null,
      inventory: ra.rows['inventory days'] || null,
      payable: ra.rows['days payable'] || null,
      ccc: ra.rows['cash conversion cycle'] || null,
      wc: ra.rows['working capital days'] || null,
      roce: pick(ra.rows, ['roce %', 'roe %']),
    },
    top,
    concalls,
    reports,
  };
}

const sumRows = (a, b) => (a && b ? a.map((v, i) => (v == null || b[i] == null ? null : v + b[i])) : a || b || null);

// Deterministic QoQ / YoY for the latest quarter — never ask an LLM to do arithmetic.
export function headline(qs) {
  const n = qs.periods.length - 1;
  const row = (label, arr) => {
    if (!arr) return null;
    const cur = arr[n], prev = arr[n - 1], yoy = arr[n - 4];
    const pct = (a, b) => (a != null && b ? ((a - b) / Math.abs(b)) * 100 : null);
    return { label, cur, prev, yoyBase: yoy, qoq: pct(cur, prev), yoy: pct(cur, yoy) };
  };
  return {
    period: qs.labels[n],
    rows: [
      row('Revenue', qs.revenue),
      row(qs.isBank ? 'Financing profit' : 'EBITDA', qs.ebitda),
      row('PBT', qs.pbt),
      row('PAT', qs.pat),
    ].filter(Boolean),
  };
}
