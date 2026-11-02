# FINN: your portfolio, filtered

A mobile-first investment agent for Indian equities, built around the brief's two modes. A **Push / Pull** toggle sits at the top of every screen.

Link: https://finn-tau-pink.vercel.app/ 

## Push: the app reaches out to you
- **Digest** (a windowed digest; choose 24H, 3D, 7D or 30D). Every filing across the 18-stock portfolio, prioritised:
  - **Important**: material filings shown as Medium-style stories, each with a headline, a 20–30-word summary, read time and an animated cover. Tapping one opens a reader. A results story shows Revenue / EBITDA / PBT / PAT with QoQ and YoY; a CEO/CFO change shows a sourced background of the incoming person.
  - **Updates**: notable but not urgent, written the same way.
  - **Routine**: paperwork (trading windows, certificates, newspaper ads), kept to one line each.
- **Triggered alerts**: alerts fire on your own thresholds.
  - **Price & volume**: end-of-day moves beyond ±X% or volume above N× the 20-day average, both set with sliders. Each move is shown next to any filing from the same window.
  - **Filings you track**: material announcements of the types you chose (results, M&A, management change…).
- **Read state**: unread items are a darker pink and read items turn lighter. "Mark all N as read" clears the current tab. Read state lasts for the session.

## Pull: you ask it to dig in
Search any listed company by name or ticker ("zomato" resolves to ETERNAL). The report has the brief's eight sections as tabs:

| Section | Built from | How |
|---|---|---|
| Business snapshot | Latest annual report (falls back to the latest transcript) | Flash-Lite reads the PDF |
| Financial snapshot | Reported financials + EOD price | Code |
| Trajectory | 6 years annual + 8 quarters | Code: CAGRs, margin direction, plain-English findings |
| Balance sheet | Reported balance sheets + ratios | Code: D/E, borrowings trend, CWIP, funding mix, working-capital cycle |
| Cash quality | Reported cash-flow statements | Code: operating cash ÷ profit by year, reinvestment rate |
| Narrative vs numbers | Last 4 concall transcripts vs reported quarters | Map: Flash-Lite per transcript. Reduce: Flash judges each promise (delivered / partly / missed / too early) and scores credibility out of 10 |
| Guidance | Latest call + still-open promises | Extracted with verbatim quotes |
| Bull vs bear | Only the facts in the tabs above | Same Flash call; each point must cite a number or a management statement |

The pull side is grounded only in company filings: no news, no broker notes, no model memory (enforced in the prompts). Every section names its source.

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
| Story headline + 20–30-word summary + mood for Important/Updates | Batched Flash-Lite calls (30 filings each), cached per filing for 7 days | ~2–4k |
| Results card (Revenue / EBITDA / PBT / PAT, QoQ, YoY) | Flash-Lite reads the results PDF and returns raw line items; **code** computes EBITDA and the % changes | ~20k per filing, once |
| Incoming-exec bio | Flash-Lite with Google Search grounding, with sources shown | small, once |
| Unusual moves | Server sends EOD stats; the **client** applies your thresholds | 0 |
| Promised vs delivered | Map: Flash-Lite per transcript (in parallel, cached 90 days). Reduce: Flash judges against an actuals table whose growth rates are precomputed in code | ~4 PDFs + 1 small call, cached 24h |

Cost principles:
- LLMs extract, code calculates.
- Tier-3 filings never touch a model.
- A story's PDF (results numbers, executive bio) is read only when the investor opens it, so you pay only for what they actually read.
- In-flight requests are de-duplicated (the cache stores the promise).
- A live token meter is shown in the settings sheet.

**Grounding rule (pull side):** prompts restrict the model to the transcripts and reported numbers. No news, no broker notes, no model memory. Every verdict cites numbers, every call links its transcript, and quotes are shown verbatim.

## Files
- `app/page.js`: Push (Digest: Important / Updates / Routine; Triggered alerts: Price & volume / Filings you track; story reader)
- `app/research/page.js`: Pull search (name or ticker), recent research this session
- `app/research/[ticker]/page.js`: the eight-section research report
- `lib/analysis.js`: deterministic Financial snapshot, Trajectory, Balance sheet, Cash quality
- `components/Art.js`: animated cover illustrations per filing type
- `app/api/resolve`: name → ticker (screener search first; AI fallback for brands/old names like "Zomato" → ETERNAL, verified against screener)
- `app/api/*`: feed, prices, enrich, research, usage
- `lib/`: data sources, classifier, Gemini client, cache, portfolio
