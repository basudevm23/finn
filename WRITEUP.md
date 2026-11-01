Subject: ENAM - IIT screening - 2027

Hi ENAM team,

Please find my submission for the FINN build challenge.

- Prototype (open on a phone): <VERCEL_URL>
- Repository: <GITHUB_URL>
- AI build history: <CLAUDE_SHARE_LINK>

**What I built.** FINN is a mobile-first PWA that does two workflows well rather than eight thinly.

1. **Push, as a triage inbox.** Filings across an 18-stock portfolio arrive for a window you choose. They are sorted into Material, Worth a glance, and Routine (collapsed). Results filings become a Revenue / EBITDA / PBT / PAT card with QoQ and YoY. CFO and CEO changes come with a sourced background of the incoming person. End-of-day moves trigger alerts on thresholds the user sets (default ±4% price, 2× 20-day volume), and each move is shown next to any filing from the same window. You swipe to clear, until the app says "Nothing needs you."
2. **Pull, as promised vs delivered.** Type any NSE ticker. FINN reads the last four concall transcripts, extracts every explicit guidance item, judges each one against reported quarterly numbers (delivered / partly / missed / too early), notes where the story shifted, and scores management credibility out of 10. Every claim links to its source.

**Key decisions and tradeoffs**
- *Interaction model:* a feed you clear, with a single "Dig in" bar for any ticker, instead of chat. Investors triage first and ask second, so a chat box would hide the most important thing: what changed.
- *Filtering is the product.* Seventeen categories and three tiers come from zero-cost rules. A "board meeting to consider results" filing is routine; the results themselves are material. A CFO change is material; an independent-director change is not.
- *Cost:* LLMs extract and code calculates, so EBITDA and all % changes are computed deterministically. Gemini Flash-Lite handles bulk PDF reading and Flash is used only for the single reasoning step. Enrichment loads only when a card scrolls into view. Outputs are cached per filing and per transcript, and concurrent calls are de-duplicated. It runs entirely on free tiers.
- *Primary sources only* on the pull side: transcripts plus reported financials, with no news or model memory, enforced in the prompts.
- *Robustness:* if exchange or price sources are unreachable, FINN shows labelled sample data rather than breaking.

**What I left out on purpose:** the other six research modules (cash quality, balance sheet, bull/bear), real push notifications, NSE as a second filings source, user accounts, and the annual-report deep dive. All of them fit the existing map-reduce pipeline.

**Next steps:** web-push notifications for triggered alerts, a persistent KV cache, and a per-stock "why did it move" view that joins filings, price, and transcript commentary. I'd also add cash-conversion and working-capital checks from annual reports, and evaluate the classifier against a labelled set of filings.

Thanks,
Mansi Ghodke
