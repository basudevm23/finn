import { screener, headline } from '@/lib/screener';
import { eod } from '@/lib/yahoo';
import { cached, HOUR, DAY } from '@/lib/cache';
import { gemini, hasKey, pdfPart, fetchPdf, MODELS } from '@/lib/gemini';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// part=numbers  -> fast, deterministic (screener table + price). Renders instantly.
// part=guidance -> map-reduce over the last 4 concall transcripts:
//                  cheap model extracts guidance per call (parallel) -> code builds the actuals
//                  table -> smart model judges promised vs delivered. Cached per ticker for a day.
export async function GET(req, { params }) {
  const { ticker } = await params;
  const sym = ticker.toUpperCase();
  const part = new URL(req.url).searchParams.get('part') || 'numbers';
  try {
    const s = await cached(`scr:${sym}`, 6 * HOUR, () => screener(sym));
    if (part === 'numbers') {
      const price = await cached(`eod:${sym}`, 1800e3, () => eod(sym)).catch(() => null);
      const q = s.quarters, k = Math.max(0, q.periods.length - 8);
      return Response.json({
        sym, name: s.name, url: s.url, price,
        last: headline(q),
        trend: q.labels.slice(k).map((l, i) => ({ l, rev: q.revenue?.[k + i], m: q.margin?.[k + i] })),
        concalls: s.concalls.slice(0, 4), reports: s.reports, isBank: q.isBank,
      });
    }
    if (!hasKey()) return Response.json({ error: 'Add GEMINI_API_KEY to run the promised-vs-delivered analysis.' });
    const out = await cached(`pvd:${sym}`, DAY, () => promisedVsDelivered(s));
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 200 });
  }
}

async function promisedVsDelivered(s) {
  const calls = s.concalls.slice(0, 4);
  if (!calls.length) throw new Error('No concall transcripts found on screener for this company.');

  // MAP: one cheap call per transcript, in parallel, cached by transcript URL forever.
  const extracted = (
    await Promise.allSettled(
      calls.map((c) =>
        cached(`gx:${c.url}`, 90 * DAY, async () => {
          const buf = await fetchPdf(c.url, { anyHost: true });
          const g = await gemini({
            tier: 'cheap',
            parts: [pdfPart(buf), {
              text:
                `Earnings-call transcript of ${s.name}, call dated ${c.date}. Indian fiscal year (Q1 = Apr–Jun).\n` +
                'Extract ONLY explicit forward-looking guidance from management on headline numbers: revenue/volume growth, ' +
                'EBITDA/operating margin, profit, capex, debt, order book, or named segment targets. Ignore vague optimism. ' +
                'Use nothing outside this document.\n' +
                'JSON: {"quarter":"the quarter just reported, e.g. Q1 FY26","tone":"confident|steady|cautious|defensive",' +
                '"guidance":[{"metric":"","promise":"≤18-word paraphrase","target":"number/range or null","horizon":"e.g. Q2 FY26, FY26, next 2-3 yrs","quote":"verbatim ≤25 words","speaker":""}],' +
                '"pressed_on":["≤2 things analysts pushed hardest on, ≤10 words each"]}',
            }],
          });
          return { ...g, date: c.date, url: c.url };
        })
      )
    )
  )
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
  if (!extracted.length) throw new Error('Could not read any transcript PDFs.');

  // Actuals computed in code (YoY growth, margins) so the judge never does arithmetic.
  const q = s.quarters, n = q.periods.length;
  const st = Math.max(0, n - 8);
  const actuals = q.labels.slice(st).map((l, j) => {
    const i = st + j;
    const yoy = (a) => (a && a[i] != null && a[i - 4] ? +(((a[i] - a[i - 4]) / Math.abs(a[i - 4])) * 100).toFixed(1) : null);
    return { quarter: l, revenue_cr: q.revenue?.[i], rev_yoy_pct: yoy(q.revenue), margin_pct: q.margin?.[i], pat_cr: q.pat?.[i], pat_yoy_pct: yoy(q.pat) };
  });

  // REDUCE: one smart call.
  const v = await gemini({
    tier: 'smart',
    temperature: 0.2,
    parts: [{
      text:
        `You are an analyst checking ${s.name}'s management credibility. Use ONLY the two inputs below — no outside knowledge, no news.\n` +
        'INPUT A — guidance extracted from the last earnings calls (oldest may be first or last):\n' + JSON.stringify(extracted.map(({ url, ...e }) => e)) +
        '\nINPUT B — reported quarterly actuals (₹ crore, % as given; Indian fiscal year):\n' + JSON.stringify(actuals) +
        '\n\nTasks:\n1. Merge repeated guidance into single items; note if it was reiterated, raised, cut, or quietly dropped across calls.\n' +
        '2. For each item judge vs INPUT B: delivered | partly | missed | too_early (horizon not yet reported) | unverifiable (metric not in B). ' +
        'Evidence must cite specific numbers from B.\n3. Score credibility 0–10 (delivered weighs most; unverifiable is neutral).\n' +
        'JSON: {"headline":"≤18 words verdict","credibility":n,"items":[{"metric":"","promise":"","said_in":"quarter of call","horizon":"","verdict":"","evidence":"≤22 words","trend":"reiterated|raised|cut|dropped|new"}],' +
        '"drift":["≤3 places the story changed across calls, ≤20 words each"],"watch":"the one thing to check next quarter, ≤18 words"}',
    }],
  });

  return {
    ...v,
    calls: extracted.map((e) => ({ date: e.date, quarter: e.quarter, tone: e.tone, pressed_on: e.pressed_on, url: e.url, quotes: (e.guidance || []).map((g) => ({ metric: g.metric, quote: g.quote, speaker: g.speaker })) })),
    actuals,
    pipeline: { extract: MODELS.cheap, judge: MODELS.smart, transcripts: extracted.length },
  };
}
