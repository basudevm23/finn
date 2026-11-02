import { PORTFOLIO } from '@/lib/portfolio';
import { announcements } from '@/lib/bse';
import { classify } from '@/lib/classify';
import { cached, peek, DAY } from '@/lib/cache';
import { gemini, hasKey } from '@/lib/gemini';
import { SAMPLE_FILINGS } from '@/lib/fixtures';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req) {
  const hours = Math.min(24 * 30, Math.max(1, +new URL(req.url).searchParams.get('hours') || 24));
  const cutoff = Date.now() - hours * 3600e3;
  const from = new Date(cutoff);

  const settled = await Promise.allSettled(
    PORTFOLIO.map((s) => cached(`bse:${s.ticker}:${hours}:${Math.floor(Date.now() / 6e5)}`, 6e5, () => announcements(s, from)))
  );
  const ok = settled.filter((r) => r.status === 'fulfilled');
  const sample = ok.length === 0;
  const raw = sample ? SAMPLE_FILINGS : ok.flatMap((r) => r.value);

  const seen = new Set();
  const items = raw
    .filter((f) => f.ts >= cutoff && !seen.has(f.id) && seen.add(f.id))
    .map(classify)
    .sort((a, b) => a.tier - b.tier || b.ts - a.ts);

  await addStories(items);

  return Response.json({
    hours,
    generatedAt: Date.now(),
    sample,
    failed: settled.length - ok.length,
    counts: { 1: 0, 2: 0, 3: 0, ...Object.fromEntries([1, 2, 3].map((t) => [t, items.filter((i) => i.tier === t).length])) },
    items,
  });
}

// Story writer: one cheap batched call turns every Important/Update filing into a Medium-style
// story (headline + 20-30 word summary + mood for the illustration). Cached per filing for a week,
// so each filing is written once; routine filings never reach a model.
async function addStories(items) {
  const want = items.filter((i) => i.tier <= 2);
  want.forEach((i) => Object.assign(i, peek(`story:${i.id}`) || {}));
  const todo = want.filter((i) => !i.story).slice(0, 120);
  if (!todo.length || !hasKey()) return;
  const chunks = [];
  for (let k = 0; k < todo.length; k += 30) chunks.push(todo.slice(k, k + 30));
  await Promise.all(chunks.map(oneBatch));
}

async function oneBatch(todo) {
  try {
    const out = await gemini({
      tier: 'cheap',
      parts: [{
        text:
          'You write a 2-minute morning digest of stock-exchange filings for a busy investor, in the style of short Medium posts.\n' +
          'For each filing return:\n' +
          '- "h": a headline, max 9 words, plain and specific (name the company, the thing, the number if any). No clickbait.\n' +
          '- "s": a summary of 20 to 30 words: what happened, the key number or date, and why an investor might care. ' +
          'Use ONLY facts in the given text; never invent numbers. If the text is thin, say what kind of filing it is and what to check in it.\n' +
          '- "m": mood for the investor: "good", "bad" or "neutral".\n' +
          'Return JSON {"<id>": {"h": "...", "s": "...", "m": "..."}}.\n\n' +
          JSON.stringify(todo.map((i) => ({ id: i.id, co: i.name, type: i.category, title: i.subject, text: i.headline.slice(0, 700) }))),
      }],
    });
    for (const i of todo) {
      const o = out?.[i.id];
      if (!o?.s) continue;
      const story = { story: String(o.s), line: String(o.h || i.title), mood: ['good', 'bad'].includes(o.m) ? o.m : 'neutral' };
      Object.assign(i, story);
      cached(`story:${i.id}`, 7 * DAY, async () => story);
    }
  } catch (e) {
    console.error('stories', e.message);
  }
}
