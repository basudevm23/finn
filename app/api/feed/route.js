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

  await addOneLiners(items);

  return Response.json({
    hours,
    generatedAt: Date.now(),
    sample,
    failed: settled.length - ok.length,
    counts: { 1: 0, 2: 0, 3: 0, ...Object.fromEntries([1, 2, 3].map((t) => [t, items.filter((i) => i.tier === t).length])) },
    items,
  });
}

// One cheap batched call summarises every tier-2 filing (and tier-1 deals) that isn't cached yet.
// Each filing is summarised once, ever; tier-3 routine filings are never sent to a model.
async function addOneLiners(items) {
  const want = items.filter((i) => i.tier === 2 || i.kind === 'oneliner');
  want.forEach((i) => (i.line = peek(`line:${i.id}`)));
  const todo = want.filter((i) => !i.line).slice(0, 40);
  if (!todo.length || !hasKey()) return;
  try {
    const out = await gemini({
      tier: 'cheap',
      parts: [{
        text:
          'You triage stock-exchange filings for a busy investor. For each filing write ONE line, max 14 words: ' +
          'what happened and the number that matters if present. Plain words, no hype, no advice. ' +
          'Use only the text given. If the text says nothing beyond its title, return a tightened title.\n' +
          'Return JSON object {"<id>": "<line>"}.\n\n' +
          JSON.stringify(todo.map((i) => ({ id: i.id, co: i.name, type: i.category, title: i.subject, text: i.headline.slice(0, 600) }))),
      }],
    });
    for (const i of todo) if (out?.[i.id]) { i.line = String(out[i.id]); cached(`line:${i.id}`, 7 * DAY, async () => i.line); }
  } catch (e) {
    console.error('oneliners', e.message);
  }
}
