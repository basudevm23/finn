// BSE corporate announcements (public JSON API behind bseindia.com).
import { UA } from './gemini';

const H = { ...UA, Accept: 'application/json, text/plain, */*', Referer: 'https://www.bseindia.com/', Origin: 'https://www.bseindia.com' };
const API = 'https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w';

const ymdIST = (d) => new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '');

export async function announcements(stock, from, to = new Date()) {
  const out = [];
  for (let page = 1; page <= 4; page++) {
    const q = new URLSearchParams({
      pageno: page, strCat: '-1', strPrevDate: ymdIST(from), strScrip: stock.bse,
      strSearch: 'P', strToDate: ymdIST(to), strType: 'C', subcategory: '-1',
    });
    const r = await fetch(`${API}?${q}`, { headers: H, cache: 'no-store' });
    if (!r.ok) throw new Error(`BSE ${r.status}`);
    const rows = (await r.json())?.Table || [];
    out.push(...rows.map((row) => normalize(row, stock)));
    if (rows.length < 50) break;
  }
  return out;
}

function normalize(row, stock) {
  const dt = row.NEWS_DT || row.DT_TM;
  const ts = dt ? new Date(/[zZ+]/.test(dt.slice(19)) ? dt : `${dt.slice(0, 19)}+05:30`).getTime() : Date.now();
  return {
    id: String(row.NEWSID),
    ticker: stock.ticker,
    name: stock.name,
    ts,
    subject: (row.NEWSSUB || '').trim(),
    headline: (row.HEADLINE || row.NEWSSUB || '').replace(/\s+/g, ' ').trim(),
    bseCat: row.CATEGORYNAME || '',
    bseSub: row.SUBCATNAME || '',
    pdf: row.ATTACHMENTNAME ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${row.ATTACHMENTNAME}` : null,
  };
}
