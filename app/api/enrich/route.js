import { cached, DAY } from '@/lib/cache';
import { gemini, hasKey, pdfPart, fetchPdf } from '@/lib/gemini';
import { screener, headline } from '@/lib/screener';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Lazy enrichment of a tier-1 card. The client calls this only when the card scrolls into
// view, so tokens are spent on what the investor actually looks at — once per filing.
export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const id = p.get('id'), kind = p.get('kind'), pdf = p.get('pdf'), head = (p.get('h') || '').slice(0, 500), co = p.get('co') || '', t = p.get('t') || '';
  if (!hasKey()) return Response.json({ error: 'Add GEMINI_API_KEY to enable enrichment' }, { status: 200 });
  if (!pdf) return Response.json({ error: 'No filing attached' });
  try {
    const data = await cached(`enrich:${kind}:${id}`, 30 * DAY, () =>
      kind === 'results' ? results(pdf).catch((e) => fromReported(t, e)) : kind === 'bio' ? bio(pdf, head, co) : Promise.reject(new Error('bad kind'))
    );
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message });
  }
}

// LLM extracts raw line items; code does every calculation (EBITDA, QoQ, YoY).
async function results(pdf) {
  const buf = await fetchPdf(pdf);
  const x = await gemini({
    tier: 'cheap',
    parts: [pdfPart(buf), {
      text:
        'This is an Indian listed company\'s quarterly results filing. Prefer the CONSOLIDATED statement if present. ' +
        'Read exactly these line items for three columns: the latest quarter ("cur"), the immediately preceding quarter ("prev"), ' +
        'and the same quarter last year ("yoy"). Copy numbers exactly as printed (no conversion). ' +
        'For banks/NBFCs use "Interest earned"/"Revenue from operations" as revenue and leave depreciation null if absent.\n' +
        'Return JSON: {"period":"e.g. Q2 FY27 (Sep 2026)","basis":"consolidated|standalone","unit":"crore|lakh|million|other",' +
        '"revenue":{"cur":n,"prev":n,"yoy":n},"other_income":{...},"finance_costs":{...},"depreciation":{...},"pbt":{...},"pat":{...}}. Use null when not printed.',
    }],
  });
  const f = x.unit === 'lakh' ? 0.01 : x.unit === 'million' ? 0.1 : 1; // -> ₹ crore
  const col = (k, c) => (x[k]?.[c] == null ? null : +x[k][c] * f);
  const ebitda = (c) => {
    const [pbt, fc, dep, oi] = ['pbt', 'finance_costs', 'depreciation', 'other_income'].map((k) => col(k, c));
    return pbt == null || fc == null || dep == null ? null : pbt + fc + dep - (oi || 0);
  };
  const pct = (a, b) => (a != null && b ? ((a - b) / Math.abs(b)) * 100 : null);
  const row = (label, get) => {
    const [cur, prev, yoy] = ['cur', 'prev', 'yoy'].map(get);
    return { label, cur, prev, yoyBase: yoy, qoq: pct(cur, prev), yoy: pct(cur, yoy) };
  };
  return {
    type: 'results',
    period: x.period,
    basis: x.basis,
    rows: [
      row('Revenue', (c) => col('revenue', c)),
      row('EBITDA', ebitda),
      row('PBT', (c) => col('pbt', c)),
      row('PAT', (c) => col('pat', c)),
    ],
    note: 'EBITDA = PBT + finance costs + depreciation − other income, computed from the filing.',
  };
}

// Fallback when the filing can't be read (e.g. a 30 MB PDF): the same four lines from the
// standardised quarterly table, computed in code. Labelled so the investor knows the source.
async function fromReported(t, err) {
  if (!t) throw err;
  const s = await cached(`scr:${t}`, 6 * 3600e3, () => screener(t));
  const h = headline(s.quarters);
  return {
    type: 'results', period: h.period, basis: 'reported financials', rows: h.rows,
    note: `Filing PDF unreadable (${err.message}); numbers from the reported quarterly table. EBITDA = operating profit.`,
  };
}

// Incoming-executive background: read the filing for the name, then grounded web search.
async function bio(pdf, head, co) {
  const buf = await fetchPdf(pdf).catch(() => null);
  const x = await gemini({
    tier: 'cheap',
    search: true,
    parts: [
      ...(buf ? [pdfPart(buf)] : []),
      {
        text:
          `Company: ${co}. Filing: "${head}".\n` +
          'Identify the person being APPOINTED (incoming) and their new role, and anyone outgoing. ' +
          'Then search the web (LinkedIn, company bios, reputable profiles) for the incoming person\'s professional background. ' +
          'Reply with ONLY a JSON code block: {"incoming":{"name":"","role":"","effective":"",' +
          '"background":["max 4 bullets, ≤14 words each: prior employers & roles, years, education"],' +
          '"read":"one line: what this hire signals, factual, ≤18 words"},"outgoing":{"name":"","role":""} or null}',
      },
    ],
  });
  return { type: 'bio', ...x, sources: (x._sources || []).slice(0, 3) };
}
