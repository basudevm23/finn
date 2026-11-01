// Mock portfolio: 18 NSE/BSE names across sectors and sizes.
// bse = BSE scrip code (used for the BSE announcements API).
export const PORTFOLIO = [
  { ticker: 'RELIANCE', bse: '500325', name: 'Reliance Industries', sector: 'Energy' },
  { ticker: 'HDFCBANK', bse: '500180', name: 'HDFC Bank', sector: 'Banks' },
  { ticker: 'ICICIBANK', bse: '532174', name: 'ICICI Bank', sector: 'Banks' },
  { ticker: 'BAJFINANCE', bse: '500034', name: 'Bajaj Finance', sector: 'NBFC' },
  { ticker: 'INFY', bse: '500209', name: 'Infosys', sector: 'IT' },
  { ticker: 'TCS', bse: '532540', name: 'Tata Consultancy Services', sector: 'IT' },
  { ticker: 'PERSISTENT', bse: '533179', name: 'Persistent Systems', sector: 'IT' },
  { ticker: 'ITC', bse: '500875', name: 'ITC', sector: 'FMCG' },
  { ticker: 'TITAN', bse: '500114', name: 'Titan Company', sector: 'Consumer' },
  { ticker: 'TRENT', bse: '500251', name: 'Trent', sector: 'Retail' },
  { ticker: 'MARUTI', bse: '532500', name: 'Maruti Suzuki', sector: 'Auto' },
  { ticker: 'SUNPHARMA', bse: '524715', name: 'Sun Pharmaceutical', sector: 'Pharma' },
  { ticker: 'BHARTIARTL', bse: '532454', name: 'Bharti Airtel', sector: 'Telecom' },
  { ticker: 'LT', bse: '500510', name: 'Larsen & Toubro', sector: 'Capital Goods' },
  { ticker: 'HAL', bse: '541154', name: 'Hindustan Aeronautics', sector: 'Defence' },
  { ticker: 'NTPC', bse: '532555', name: 'NTPC', sector: 'Power' },
  { ticker: 'DIXON', bse: '540699', name: 'Dixon Technologies', sector: 'Electronics' },
  { ticker: 'POLYCAB', bse: '542652', name: 'Polycab India', sector: 'Cables' },
];

// Ad-hoc research suggestions (outside the portfolio). The engine works on any NSE ticker.
export const ADHOC = ['ETERNAL', 'ASIANPAINT', 'IRCTC', 'DMART'];

export const bySym = Object.fromEntries(PORTFOLIO.map((s) => [s.ticker, s]));
export const byBse = Object.fromEntries(PORTFOLIO.map((s) => [s.bse, s]));
