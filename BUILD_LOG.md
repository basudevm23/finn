# FINN: AI build history

FINN was built with **Claude** (Anthropic), working as an agentic coding assistant, between 1 and 3 Nov 2026. This log records the session in order:

- each instruction I gave (condensed from my actual messages);
- what the agent did in response;
- what I tested on my own machine and what broke;
- the git commit each step produced.

The commit hashes match the repository history. The full chat transcript can be shown on request.

**How I used the tool:** I made the product and design calls and ran every build locally against live BSE, Yahoo and screener.in data. I fed real outputs and errors back to the agent. The agent wrote the code, checked layouts in a headless browser, and flagged risks (blocked data sources, retired model IDs, unverified parsing) instead of hiding them.

---

### 1. Brief → ten design decisions → first build
**My prompt:** "Build this entirely from start to end. Ask me the design choices mentioned in the problem statement, one by one (only the top 10). Build 1–2 workflows, but make them highly efficient. Follow every instruction in the brief, and spend few tokens."

**Agent:** read both PDFs and asked 10 design questions in three rounds. My answers:

| # | Decision | My choice |
|---|---|---|
| 1 | Workflows | Push digest + Pull "promised vs delivered" |
| 2 | Interaction model | Prioritised feed + ask-anything bar |
| 3 | Delivery | Next.js PWA on Vercel |
| 4 | Models | Gemini free tier, routed: Flash-Lite extracts, Flash judges |
| 5 | Portfolio | 18 diversified large/mid caps |
| 6 | Pull depth | Promised vs delivered first |
| 7 | Triage | 3 tiers: material (rich card), notable (one line), routine (collapsed) |
| 8 | Alert defaults | Volume > 2× 20-day average, price ±4%, user-adjustable |
| 9 | Look | Dark, terminal-minimal |
| 10 | Data & cost | Live fetch + cache; summarise each filing once |

The agent built BSE announcements, Yahoo EOD and screener.in clients; a zero-token regex classifier (17 categories, 3 tiers); and results and executive-bio enrichment. It also built a map-reduce over 4 concall transcripts and a labelled sample-data fallback.
*Commit `5384281`*

### 2. Clarifying the stack
**My prompt:** "What Gemini model have you used, and how will it pull NSE, BSE and Yahoo Finance data?"
**Agent:** explained the routing and each endpoint, and why NSE's API was skipped for filings (cookie-gated, often blocks cloud servers). It flagged that the sources are unofficial and could block a cloud host.

### 3. First live run: two real bugs
**What I tested:** ran it locally and pasted the 3-day output. Two problems: Gemini returned 404 (`gemini-2.5-flash-lite` retired for new keys), and 19 items were marked "need you", most of them wrongly tagged Results.
**Agent:**
- Switched to `gemini-3.5-*` with automatic fallback when a model ID is retired.
- Found the cause of the wrong tags: BSE files decks, analyst-meet outcomes and press releases under its "Result" category. The classifier now uses the filing's own subject first.
- Re-ran my exact filings through the classifier to show the before/after.

*Commit `eabec52`*

### 4. Thirty-day view: noise and rate limits
**What I tested:** pasted the 30-day output. It had 55 "material" cards, with 8 POLYCAB NCLAT updates shown separately; an NTPC results PDF failed as "too large"; and cards were stuck on "Computing…".
**Agent:**
- Grouped updates on the same company and topic into one thread.
- Stopped watched categories from promoting routine items.
- Fixed more misclassifications.
- Added a fallback to reported financials when a PDF can't be read.
- Added a 3-call queue so the free tier stops rate-limiting.
- Cleaned up the raw "Regulation 30 (LODR)" titles.

*Commit `650e4d7`*

### 5. Research by company name; separate pages; light theme
**My prompt:** "Users won't remember tickers. Let the LLM extract the company from a typed name (ZOMATO failed with screener 404). Put research on its own page, use a white UI with light pink, add read/unread indicators, simplify section names, and keep state for the session."
**Agent:** name → ticker resolution uses screener search first. Only if that fails does an AI call guess the company, and the guess is verified against screener (so "Zomato" → ETERNAL). The agent also added separate Alerts and Research pages, read/unread state and session memory.
*Commit `3b12872`*

### 6. Tabs and Medium-style stories
**My prompt:** "Put Alerts, Important, etc. in separate tabs, kept even when empty. Make updates read like Medium posts, a 2-minute read with 20–30 words each, with animations or pictures."
**Agent:**
- Gemini now writes each filing as a headline, a 20–30-word summary and a mood, in batched calls cached per filing.
- Each filing type gets its own animated SVG cover.
- Tapping a story opens a reader view.
- A story's PDF is read only when it's opened (cost).

*Commit `a485ca2`*

### 7. Push/Pull structure; all eight research sections
**My prompt:** "What does 'Mark read' do? Unread should be darker and read lighter. Headings should follow the section. Add a Push/Pull toggle with the brief's headings, and make sure every Push and Pull item in the brief is there."
**Agent:**
- Push now has Digest (Important / Updates / Routine) and Triggered alerts (Price & volume / Filings you track).
- Pull now has all 8 research views. Financial snapshot, Trajectory, Balance sheet and Cash quality are computed in code, with no AI. Business snapshot is read from the annual report. Guidance, Narrative vs numbers and Bull vs bear come from transcripts and reported numbers only.
- The deterministic analysis was unit-tested on a synthetic company.

*Commit `050b16f`*

### 8. Readability for traders
**My prompt:** pasted guidance on high-contrast financial UIs (charcoal/navy background, white primary numbers, slate secondary text, teal for automated output). "Frontend only; don't touch the backend."
**Agent:** added a dark default with a light option. Each colour now has one job: blue = selection and unread, green/red = gains and losses only, teal = anything the AI or system generated, amber = warnings. No API or library files changed (verified with `git diff`).
*Commit `af311b9`*

### 9. Bugs from my local run + submission polish
- **What I tested:** hit a React duplicate-key error on a research page. The cause was that screener listed the same annual report twice; the agent removed duplicates at the source and made the keys unique. *`68172bc`*
- Repo hygiene for deploy (`.env.example` tracked, secrets ignored). *`803cdb8`*
- Corrected the author on the commits and in the writeup to me. *`bde56cf`*
- **My prompt:** "Mention the data sources somewhere in small font." The agent added a small-print data attribution footer. *`bbc115f`*
- **My prompt:** "Isn't the date important here?" Yes: the agent added the trading-session date to price alerts and holdings, a stale-data warning, and exact filing times on stories. *`f3ccf3c`*

### 10. Deployment
GitHub Pages can't host it: FINN needs server routes to reach BSE, Yahoo and screener (browser CORS) and to keep the Gemini key secret. So I deployed it on Vercel (free plan, Mumbai region) from this GitHub repo.
