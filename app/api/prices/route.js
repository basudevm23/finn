import { PORTFOLIO } from '@/lib/portfolio';
import { eod } from '@/lib/yahoo';
import { cached } from '@/lib/cache';
import { samplePrice } from '@/lib/fixtures';

export const dynamic = 'force-dynamic';

// EOD stats only; the client applies the user's own thresholds (vol × avg, ±% move).
export async function GET(req) {
  const extra = new URL(req.url).searchParams.get('t');
  const tickers = extra ? extra.split(',').slice(0, 5) : PORTFOLIO.map((p) => p.ticker);
  const res = await Promise.allSettled(tickers.map((t) => cached(`eod:${t}`, 1800e3, () => eod(t))));
  const live = res.filter((r) => r.status === 'fulfilled').length;
  const prices = res.map((r, i) => (r.status === 'fulfilled' ? r.value : live === 0 ? samplePrice(tickers[i]) : null)).filter(Boolean);
  return Response.json({ sample: live === 0, prices });
}
