Subject: ENAM - IIT screening - 2027

Hi ENAM team,

Please find my submission for the FINN build challenge.

- Prototype (open on a phone): https://finn-tau-pink.vercel.app/
- Repository: https://github.com/basudevm23/finn
- AI build history:  https://github.com/basudevm23/finn/blob/main/BUILD_LOG.md

**What I built.** FINN is a mobile-first PWA with a Push / Pull switch at the top, mirroring the brief.

1. **Push.**
   - *Digest*: every filing across an 18-stock portfolio for a window you pick, split into Important, Updates and Routine.
     - Important and Updates read like a 2-minute Medium feed: a headline, a 20–30-word summary and an animated cover per filing type.
     - Results stories open to Revenue / EBITDA / PBT / PAT with QoQ and YoY. CFO/CEO changes open to a sourced background of the incoming person.
   - *Triggered alerts*: end-of-day price and volume moves beyond thresholds you set, plus material filings of the types you choose to track.
   - Unread items are shaded darker and turn lighter once read.
2. **Pull.** Search any company by name or ticker to get all eight research views from the brief, each grounded in primary sources:
   - *From the annual report*: Business snapshot.
   - *From reported financials, computed in code*: Financial snapshot, Trajectory, Balance sheet and Cash quality.
   - *From concall transcripts*: Guidance and Narrative vs numbers. The worked example is here: the last four quarters' promises are judged delivered / partly / missed / too early against reported numbers, with a credibility score and how the story shifted.
   - *Bull vs bear*: a tight case each way, built only from those facts.

**Key decisions and tradeoffs**
- *Interaction model:* a short story feed you read and clear (Push), and a separate research space you search by company name (Pull), instead of chat. Investors triage first and ask second, so a chat box would hide the most important thing: what changed.
- *Filtering is the product.* Seventeen categories and three tiers come from zero-cost rules. A "board meeting to consider results" filing is routine; the results themselves are material. A CFO change is material; an independent-director change is not.
- *Cost:* LLMs extract and code calculates; four of the eight research views use no AI at all, and EBITDA and every % change are computed deterministically. Gemini Flash-Lite handles bulk PDF reading and Flash is used only for the single reasoning step. Each story's PDF is read only when you open it. Outputs are cached per filing and per transcript, and concurrent calls are de-duplicated. It runs entirely on free tiers.
- *Primary sources only* on the pull side: annual reports, transcripts and reported financials, with no news or model memory, enforced in the prompts.
- *Robustness:* if exchange or price sources are unreachable, FINN shows labelled sample data rather than breaking.

**What I left out on purpose:** real OS push notifications (alerts show in-app), NSE as a second filings source, user accounts and a persistent database. The portfolio is a fixed mock, as the brief allows.

**Next steps:** web-push notifications for triggered alerts, a persistent KV cache, and a per-stock "why did it move" view that joins filings, price, and transcript commentary. I'd also evaluate the classifier against a labelled set of filings, and add segment-level trajectory from annual-report notes.

Thanks,
Basudev Mohapatra
