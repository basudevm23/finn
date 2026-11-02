import { cached, DAY } from '@/lib/cache';
import { gemini, hasKey, UA } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

// "zomato", "infosys", "hdfc bank", "INFY" -> [{ sym, name }]
// Step 1: screener.in's own company search (free, exact).
// Step 2 (only on submit, only if step 1 finds nothing): a cheap LLM call works out the
// company's current official name / NSE symbol (e.g. Zomato -> Eternal), then step 1 again
// to verify, so the model can never send you to a company that doesn't exist.
export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const q = (p.get('q') || '').trim().slice(0, 60);
  if (q.length < 2) return Response.json({ results: [] });

  let results = await search(q);
  let via = 'search';
  if (!results.length && p.get('ai') === '1' && hasKey()) {
    try {
      const g = await cached(`resolve:${q.toLowerCase()}`, 30 * DAY, () =>
        gemini({
          tier: 'cheap',
          parts: [{
            text:
              `An investor typed "${q}" to look up a company listed on NSE/BSE in India. It may be a brand, an old name, ` +
              'a misspelling or a ticker. Return JSON {"name":"current official listed company name","nse":"current NSE symbol or null",' +
              '"also":["up to 2 other search terms"]}. If it is not an Indian listed company, return {"name":null}.',
          }],
        })
      );
      for (const term of [g?.nse, g?.name, ...(g?.also || [])].filter(Boolean)) {
        results = await search(term);
        if (results.length) { via = 'ai'; break; }
      }
    } catch (e) {
      console.error('resolve', e.message);
    }
  }
  return Response.json({ results: results.slice(0, 6), via });
}

async function search(q) {
  return cached(`scs:${q.toLowerCase()}`, DAY, async () => {
    const r = await fetch(`https://www.screener.in/api/company/search/?q=${encodeURIComponent(q)}&v=3&fts=1`, { headers: UA });
    if (!r.ok) return [];
    const rows = await r.json();
    return rows
      .map((x) => ({ name: x.name, sym: (x.url || '').match(/\/company\/([^/]+)\//)?.[1] }))
      .filter((x, i, all) => x.sym && x.name && all.findIndex((y) => y.sym === x.sym) === i);
  }).catch(() => []);
}
