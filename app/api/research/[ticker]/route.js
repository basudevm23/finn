import { screener, headline } from '@/lib/screener';
import { eod } from '@/lib/yahoo';
import { cached, HOUR, DAY } from '@/lib/cache';
import { gemini, hasKey, pdfPart, fetchPdf, MODELS } from '@/lib/gemini';
import { financialSnapshot, trajectory, balanceSheet, cashQuality, factsForJudge } from '@/lib/analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Pull side. Three independent parts so each fits its own serverless time budget:
//   part=numbers  -> Financial snapshot, Trajectory, Balance sheet, Cash quality. Pure code, instant.
//   part=business -> Business snapshot read from the latest annual report (or latest transcript).
//   part=guidance -> Guidance, Narrative vs numbers, Bull vs bear: map-reduce over 4 transcripts.
// Grounding: only company filings (annual reports, transcripts, reported financials).
export async function GET(req, { params }) {
  const { ticker } = await params;
  const sym = ticker.toUpperCase();
  const part = new URL(req.url).searchParams.get('part') || 'numbers';
  try {
    const s = await cached(`scr2:${sym}`, 6 * HOUR, () => screener(sym));
    const isBank = s.quarters.isBank || /bank/i.test(s.name);
    if (part === 'numbers') {
      const price = await cached(`eod:${sym}`, 1800e3, () => eod(sym)).catch(() => null);
      return Response.json({
        sym, name: s.name, url: s.url, price, isBank,
        financials: financialSnapshot(s, headline(s.quarters)),
        trajectory: trajectory(s),
        balance: balanceSheet(s, isBank),
        cash: cashQuality(s, isBank),
        concalls: s.concalls.slice(0, 4), reports: s.reports,
      });
    }
    if (!hasKey()) return Response.json({ error: 'Add GEMINI_API_KEY to enable the AI sections.' });
    if (part === 'business') return Response.json(await cached(`biz:${sym}`, 30 * DAY, () => business(s)));
    return Response.json(await cached(`pvd2:${sym}`, DAY, () => promisedVsDelivered(s, isBank)));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 200 });
  }
}

const BIZ_PROMPT = (name, src) =>
  `This is ${name}'s ${src}. Using ONLY this document, describe the business for an investor new to it.\n` +
  'JSON: {"what":"what the company does, 25-35 words, plain English",' +
  '"segments":[{"name":"","share":"% of revenue as stated, or null","note":"≤12 words"}],' +
  '"mix":"one line on revenue mix by geography/customer/product if stated, else null",' +
  '"facts":["up to 4 short facts with numbers: scale, plants, customers, market position"],' +
  '"source_note":"which section/page this came from, ≤10 words"}';

async function business(s) {
  // Try the latest annual report first (primary source); fall back to the latest transcript.
  for (const r of s.reports.slice(0, 1)) {
    try {
      const buf = await fetchPdf(r.url, { anyHost: true });
      const out = await gemini({ tier: 'cheap', parts: [pdfPart(buf), { text: BIZ_PROMPT(s.name, `annual report (${r.title})`) }] });
      return { ...out, source: { title: r.title, url: r.url } };
    } catch (e) {
      console.error('biz AR', e.message);
    }
  }
  const c = s.concalls[0];
  if (!c) throw new Error('No annual report or transcript available to describe the business.');
  const buf = await fetchPdf(c.url, { anyHost: true });
  const out = await gemini({ tier: 'cheap', parts: [pdfPart(buf), { text: BIZ_PROMPT(s.name, `earnings-call transcript (${c.date})`) }] });
  return { ...out, source: { title: `Concall transcript, ${c.date}`, url: c.url } };
}

async function promisedVsDelivered(s, isBank) {
  const calls = s.concalls.slice(0, 4);
  if (!calls.length) throw new Error('No concall transcripts found for this company.');

  // MAP: one cheap call per transcript, in parallel, cached by transcript URL.
  const extracted = (
    await Promise.allSettled(
      calls.map((c) =>
        cached(`gx2:${c.url}`, 90 * DAY, async () => {
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
                '"pressed_on":["≤2 things analysts pushed hardest on, ≤10 words each"],' +
                '"risks":["≤2 risks management itself acknowledged, ≤14 words each"]}',
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

  // Actuals and context computed in code, so the judge never does arithmetic or uses memory.
  const q = s.quarters, n = q.periods.length, st = Math.max(0, n - 8);
  const actuals = q.labels.slice(st).map((l, j) => {
    const i = st + j;
    const yoy = (a) => (a && a[i] != null && a[i - 4] ? +(((a[i] - a[i - 4]) / Math.abs(a[i - 4])) * 100).toFixed(1) : null);
    return { quarter: l, revenue_cr: q.revenue?.[i], rev_yoy_pct: yoy(q.revenue), margin_pct: q.margin?.[i], pat_cr: q.pat?.[i], pat_yoy_pct: yoy(q.pat) };
  });
  const facts = factsForJudge(trajectory(s), balanceSheet(s, isBank), cashQuality(s, isBank));

  // REDUCE: one smart call.
  const v = await gemini({
    tier: 'smart',
    temperature: 0.2,
    parts: [{
      text:
        `You are an analyst checking ${s.name}'s management credibility. Use ONLY the inputs below: no outside knowledge, no news.\n` +
        'INPUT A: guidance and risks extracted from recent earnings calls:\n' + JSON.stringify(extracted.map(({ url, ...e }) => e)) +
        '\nINPUT B: reported quarterly actuals (₹ crore, % as given; Indian fiscal year):\n' + JSON.stringify(actuals) +
        '\nINPUT C: multi-year facts computed from reported financials:\n' + JSON.stringify(facts) +
        '\n\nTasks:\n1. Merge repeated guidance into single items; note if it was reiterated, raised, cut, or quietly dropped across calls.\n' +
        '2. For each item judge vs INPUT B: delivered | partly | missed | too_early (horizon not yet reported) | unverifiable (metric not in B). ' +
        'Evidence must cite specific numbers from B.\n3. Score credibility 0–10 (delivered weighs most; unverifiable is neutral).\n' +
        '4. Write a tight bull case and bear case, 3 points each, ≤22 words, each citing a number from B/C or a management statement from A.\n' +
        'JSON: {"headline":"≤18 words verdict","credibility":n,"items":[{"metric":"","promise":"","said_in":"quarter of call","horizon":"","verdict":"","evidence":"≤22 words","trend":"reiterated|raised|cut|dropped|new"}],' +
        '"drift":["≤3 places the story changed across calls, ≤20 words each"],"watch":"the one thing to check next quarter, ≤18 words",' +
        '"bull":["",""," "],"bear":["","",""]}',
    }],
  });

  const latest = extracted[0];
  return {
    ...v,
    guidance: { date: latest.date, quarter: latest.quarter, tone: latest.tone, items: latest.guidance || [], url: latest.url, risks: latest.risks || [] },
    calls: extracted.map((e) => ({ date: e.date, quarter: e.quarter, tone: e.tone, pressed_on: e.pressed_on, url: e.url, quotes: (e.guidance || []).map((g) => ({ metric: g.metric, quote: g.quote, speaker: g.speaker })) })),
    actuals,
    pipeline: { extract: MODELS.cheap, judge: MODELS.smart, transcripts: extracted.length },
  };
}
