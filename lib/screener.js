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
    if (reports.length < 3) reports.push({ title: t, url: new URL($(a).attr('href'), url).href });
  });

  return {
    sym,
    name: $('h1').first().text().trim() || sym,
    url,
    quarters,
    concalls,
    reports,
  };
}

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
