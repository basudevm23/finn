// Rule-based classifier (zero tokens). Maps a BSE filing to the reference-doc category,
// then to an attention tier. The tier is the product's judgement:
//   1 = material   -> rich card (results numbers, incoming-exec bio, deal)
//   2 = notable    -> one-line summary
//   3 = routine    -> collapsed into a count
const RULES = [
  // Specific types first, so a word like "results" elsewhere can't capture them.
  ['unclassified', /statutory auditor|secretarial auditor|cost auditor|auditor rotation|scrutini[sz]er/i],
  ['postal_ballot', /postal ballot/i],
  ['agm_egm', /\bagm\b|\begm\b|annual general|extraordinary general|e-?voting/i],
  ['earnings_call', /earnings call|conference call|con-?call|transcript|audio recording|call recording/i],
  ['investor_meetings', /investor meet|analysts? meet|analyst \/ investor|investors? conference|schedule of .*meet/i],
  ['results_deck', /investor presentation|results? (deck|presentation)|shareholders?'? letter|earnings presentation/i],
  ['results', /financial results|results for the (quarter|half|year|period)|(un)?audited .*results|quarterly results/i],
  ['pledging', /pledg|encumbrance/i],
  ['insider_trading', /\breg(ulation)?\.? ?7\b|\bsast\b|insider trading|regulation 29|regulation 31/i],
  ['credit_rating', /credit rating|\brating\b/i],
  ['dividend', /dividend/i],
  ['bonus_split', /bonus|stock split|sub-?division/i],
  ['fund_raise', /\bqip\b|rights issue|preferential|buy-?back|commercial paper|debentures?|\bncds?\b|fund rais|allotment/i],
  ['M&A', /acqui|merger|amalgamat|demerg|joint venture|scheme of arrangement|business transfer|share purchase|divest|sale of .*stake/i],
  ['litigation', /litigation|penalt|show cause|nclt|insolvency|\bcirp\b|tax demand|\bgst\b.*order|order .*(authority|tribunal|court)|sebi order|\bfine\b/i],
  ['management_change', /appoint|resign|cessation|re-?designat|key managerial|change in directorate|\b(ceo|cfo|cto|coo|md)\b|managing director|chief (executive|financial|operating)|company secretary|director/i],
  ['capex', /capex|capacity expansion|new (plant|facility)|commission(ed|ing)/i],
  ['press_release', /press release|media release|order (win|received)|bags|launch|partnership|clarification/i],
];

const ROUTINE = /newspaper|publication|intimation|closure of trading window|trading window|certificate|74\(5\)|compliance|esop|esos|loss of share|duplicate share|investor complaints|esg|business responsibility|sustainability/i;
const TOP_ROLE = /\b(ceo|cfo|coo|md)\b|managing director|chief (executive|financial|operating)|chairman|whole[- ]time director/i;
const OUTCOME = /outcome|approv|declar|result/i;

export function classify(f) {
  // Classify on the filing's own subject first. BSE's category is only a fallback: in results
  // season it files decks, analyst-meet outcomes and press releases under "Result".
  const own = `${f.subject || ''} | ${f.headline || ''}`;
  const text = `${own} | ${f.bseSub || ''}`;
  const match = (t) => RULES.find(([, re]) => re.test(t))?.[0];
  let cat = match(f.subject || '') || match(own) || match(f.bseSub || '') || 'unclassified';
  if (cat === 'unclassified' && /financial result/i.test(f.bseSub || '')) cat = 'results';

  let tier = 3;
  let kind = null; // which rich enrichment a tier-1 card gets
  const routine = ROUTINE.test(text);

  switch (cat) {
    case 'results':
      if (!routine && !/board meeting|intimation/i.test(text)) { tier = 1; kind = 'results'; }
      else tier = 3; // "board meeting to consider results" is a calendar item, not news
      break;
    case 'results_deck':
      cat = 'results'; tier = 2; // the deck/letter around results: worth a glance, not a second card
      break;
    case 'management_change':
      if (TOP_ROLE.test(text)) { tier = 1; kind = 'bio'; }
      else tier = /independent|nominee|additional director|company secretary/i.test(text) ? 3 : 2;
      break;
    case 'fund_raise':
      // QIP/rights/preferential/buyback move the equity story; plain allotments (ESOP, NCD) don't
      tier = routine ? 3 : /\bqip\b|rights|preferential|buy-?back/i.test(text) ? 1 : 2;
      kind = tier === 1 ? 'oneliner' : null;
      break;
    case 'M&A':
      tier = routine ? 3 : 1; kind = tier === 1 ? 'oneliner' : null;
      break;
    case 'pledging':
    case 'litigation':
      tier = /sebi|nclt|insolvency|\bcirp\b|penalt|demand/i.test(text) ? 1 : 2; kind = tier === 1 ? 'oneliner' : null;
      break;
    case 'credit_rating':
      tier = /downgrad|negative|watch/i.test(text) ? 1 : 2;
      break;
    case 'dividend':
    case 'bonus_split':
    case 'capex':
    case 'press_release':
      tier = routine ? 3 : 2;
      break;
    case 'insider_trading':
      tier = /promoter/i.test(text) ? 2 : 3;
      break;
    case 'earnings_call':
      tier = /transcript/i.test(text) ? 2 : 3; // transcripts feed the research engine
      break;
    case 'agm_egm':
    case 'postal_ballot':
      tier = OUTCOME.test(text) && !routine ? 2 : 3;
      break;
    default:
      tier = 3;
  }
  return { ...f, category: cat, tier, kind };
}

export const CATEGORY_LABEL = {
  results: 'Results', 'M&A': 'M&A', fund_raise: 'Fund raise', management_change: 'Mgmt change',
  litigation: 'Litigation', insider_trading: 'Insider', earnings_call: 'Concall', investor_meetings: 'Investor meet',
  credit_rating: 'Rating', dividend: 'Dividend', bonus_split: 'Bonus/Split', capex: 'Capex',
  press_release: 'Press', postal_ballot: 'Postal ballot', agm_egm: 'AGM/EGM', pledging: 'Pledge', unclassified: 'Routine',
};
