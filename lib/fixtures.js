// SAMPLE data, used only when live sources are unreachable (so the demo never shows a blank
// screen). The UI shows a "sample data" banner whenever this is served.
import { PORTFOLIO } from './portfolio';

const h = (x) => Date.now() - x * 3600e3;
const STORIES = {"DIXON": ["Dixon posts Q2 results for September quarter", "Dixon Technologies filed its consolidated and standalone results for the September quarter. Open the story for revenue, EBITDA and profit against last quarter and last year.", "good"], "PERSISTENT": ["Persistent Systems names a new CFO", "The board approved a new Chief Financial Officer, effective November 15. A finance-chief change mid-year is worth a look at the incoming executive's track record.", "neutral"], "LT": ["L&T wins a significant Middle East order", "Larsen & Toubro bagged a 'significant' power transmission order in the Middle East, a band L&T uses for contracts in a specified value range.", "good"], "BAJFINANCE": ["Bajaj Finance's CP rating reaffirmed", "The credit rating on Bajaj Finance's commercial paper programme was reaffirmed, keeping its short-term borrowing costs steady. No upgrade or downgrade was announced.", "neutral"], "ITC": ["ITC declares interim dividend, record date set", "ITC declared an interim dividend and fixed the record date. Shareholders on the register by that date receive the payout; the filing has the per-share amount.", "good"], "HAL": ["HAL publishes its Q2 earnings call transcript", "Hindustan Aeronautics filed the transcript of its Q2 earnings call. It feeds FINN's promised-versus-delivered check on management guidance.", "neutral"]};

export const SAMPLE_FILINGS = [
  { ticker: 'DIXON', ts: h(3), bseCat: 'Result', subject: 'Financial Results for the quarter ended September 30, 2026', headline: 'Unaudited financial results (standalone & consolidated) for Q2' },
  { ticker: 'PERSISTENT', ts: h(5), bseCat: 'Company Update', subject: 'Appointment of Chief Financial Officer', headline: 'Board approves appointment of new Chief Financial Officer (KMP) w.e.f. November 15' },
  { ticker: 'LT', ts: h(7), bseCat: 'Company Update', subject: 'Press Release', headline: 'L&T wins significant order in the Middle East for power transmission' },
  { ticker: 'BAJFINANCE', ts: h(9), bseCat: 'Company Update', subject: 'Credit Rating', headline: 'Reaffirmation of credit rating on commercial paper programme' },
  { ticker: 'ITC', ts: h(11), bseCat: 'Corp. Action', subject: 'Dividend', headline: 'Interim dividend declared; record date fixed' },
  { ticker: 'HAL', ts: h(13), bseCat: 'Company Update', subject: 'Earnings call transcript', headline: 'Transcript of the earnings conference call for Q2' },
  { ticker: 'TRENT', ts: h(15), bseCat: 'Insider Trading / SAST', subject: 'Disclosure under Regulation 7(2)', headline: 'Disclosure by designated person under SEBI PIT Regulation 7(2)' },
  { ticker: 'RELIANCE', ts: h(16), bseCat: 'Company Update', subject: 'Newspaper Publication', headline: 'Newspaper publication of financial results' },
  { ticker: 'HDFCBANK', ts: h(17), bseCat: 'Company Update', subject: 'Allotment of ESOP', headline: 'Allotment of equity shares under ESOS' },
  { ticker: 'TCS', ts: h(19), bseCat: 'Company Update', subject: 'Analyst / Investor Meet', headline: 'Schedule of analyst / institutional investor meetings' },
  { ticker: 'NTPC', ts: h(20), bseCat: 'Company Update', subject: 'Certificate under Reg 74(5)', headline: 'Compliance certificate under Regulation 74(5) of SEBI (DP) Regulations' },
  { ticker: 'SUNPHARMA', ts: h(22), bseCat: 'Company Update', subject: 'Trading window closure', headline: 'Closure of trading window' },
].map((f, i) => ({ ...f, ...(STORIES[f.ticker] ? { line: STORIES[f.ticker][0], story: STORIES[f.ticker][1], mood: STORIES[f.ticker][2] } : {}), id: `sample-${i}`, name: PORTFOLIO.find((p) => p.ticker === f.ticker)?.name, pdf: null, sample: true }));

// Deterministic pseudo-random walk so sample prices look alive but never pretend to be live.
export function samplePrice(ticker) {
  let seed = [...ticker].reduce((s, c) => s + c.charCodeAt(0), 0);
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  let p = 500 + rnd() * 3000;
  const spark = Array.from({ length: 30 }, () => (p *= 1 + (rnd() - 0.5) * 0.03));
  const chg = ticker === 'DIXON' ? 6.4 : ticker === 'PERSISTENT' ? -4.8 : (rnd() - 0.5) * 4;
  spark[29] = spark[28] * (1 + chg / 100);
  const volX = ticker === 'DIXON' ? 3.2 : ticker === 'HAL' ? 2.3 : 0.6 + rnd();
  return { ticker, date: Date.now(), close: spark[29], chg, vol: 1e6 * volX, avgVol: 1e6, volX, spark: spark.map((x) => +x.toFixed(2)), sample: true };
}
