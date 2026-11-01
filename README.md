# FINN: your portfolio, filtered

A mobile-first investment agent for Indian equities. It has two workflows.

- **Push: the morning triage inbox.** Every filing across an 18-stock portfolio for a window you pick (24H / 3D / 7D / 30D) is sorted into three tiers: *Material* (rich card), *Worth a glance* (one line) and *Routine* (collapsed into a count). End-of-day price and volume alerts use thresholds you set. You clear items by swiping, until you reach "Nothing needs you."
- **Pull: promised vs delivered.** Type any NSE ticker. FINN reads the last 4 earnings-call transcripts, extracts every explicit guidance item, checks each one against reported quarterly numbers, and gives management a credibility score.

## Run

```bash
npm install
cp .env.example .env.local   # add a free key from aistudio.google.com
npm run dev                  # http://localhost:3000
```

Deploy: import the repo on Vercel and set `GEMINI_API_KEY`. `vercel.json` pins the functions to Mumbai (`bom1`), because Indian exchange sites are friendlier to Indian IPs.

The app is designed to never show a blank screen. If BSE or Yahoo can't be reached, it serves clearly labelled sample data. If no key is set, the feed still works using rules alone, and the LLM features explain what's missing.

## Architecture

```
BSE announcements API ──┐
Yahoo chart API (EOD) ──┼─► Next.js API routes (serverless) ─► in-process cache ─► PWA
screener.in (numbers,   │        │
 transcript links) ─────┘        └─► Gemini (routed: cheap extract → smart judge)
```

| Step | How | Tokens |
|---|---|---|
| Classify ~100s of filings into 17 categories + 3 tiers | Regex rules (`lib/classify.js`) | 0 |
| One-line summaries for tier-2 filings | One batched Flash-Lite call per feed load, cached per filing for 7 days | ~1–2k |
| Results card (Revenue / EBITDA / PBT / PAT, QoQ, YoY) | Flash-Lite reads the results PDF and returns raw line items; **code** computes EBITDA and the % changes | ~20k per filing, once |
| Incoming-exec bio | Flash-Lite with Google Search grounding, with sources shown | small, once |
| Unusual moves | Server sends EOD stats; the **client** applies your thresholds | 0 |
| Promised vs delivered | Map: Flash-Lite per transcript (in parallel, cached 90 days). Reduce: Flash judges against an actuals table whose growth rates are precomputed in code | ~4 PDFs + 1 small call, cached 24h |

Cost principles:
- LLMs extract, code calculates.
- Tier-3 filings never touch a model.
- Enrichment runs only when a card scrolls into view (`IntersectionObserver`), so you pay only for what the investor actually sees.
- In-flight requests are de-duplicated (the cache stores the promise).
- A live token meter is shown in the settings sheet.

**Grounding rule (pull side):** prompts restrict the model to the transcripts and reported numbers. No news, no broker notes, no model memory. Every verdict cites numbers, every call links its transcript, and quotes are shown verbatim.

## Files
- `app/page.js`: feed (push)
- `app/r/[ticker]/page.js`: research (pull)
- `app/api/*`: feed, prices, enrich, research, usage
- `lib/`: data sources, classifier, Gemini client, cache, portfolio
