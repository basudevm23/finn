// Gemini REST client with model routing + token accounting.
// cheap  -> bulk extraction (PDF reading, one-liners, bios)
// smart  -> the one reasoning step (promised vs delivered judgement)
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Google retires model IDs often. Env var wins; otherwise try these in order and remember
// the first one that answers (a 404 just moves to the next candidate).
const CANDIDATES = {
  cheap: [process.env.GEMINI_CHEAP_MODEL, 'gemini-3.5-flash-lite', 'gemini-3-flash-lite', 'gemini-flash-lite-latest'].filter(Boolean),
  smart: [process.env.GEMINI_SMART_MODEL, 'gemini-3.5-flash', 'gemini-3-flash', 'gemini-flash-latest'].filter(Boolean),
};
export const MODELS = (globalThis.__finnModels ||= { cheap: CANDIDATES.cheap[0], smart: CANDIDATES.smart[0] });

export const hasKey = () => !!process.env.GEMINI_API_KEY;

export const usage = (globalThis.__finnUsage ||= { calls: 0, input: 0, output: 0, byModel: {}, since: Date.now() });

export const UA = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: '*/*',
};

export async function gemini({ tier = 'cheap', parts, json = true, search = false, temperature = 0.1 }) {
  if (!hasKey()) throw new Error('GEMINI_API_KEY not set');
  const body = { contents: [{ role: 'user', parts }], generationConfig: { temperature } };
  if (search) body.tools = [{ google_search: {} }];
  else if (json) body.generationConfig.responseMimeType = 'application/json';

  const list = [MODELS[tier], ...CANDIDATES[tier].filter((m) => m !== MODELS[tier])];
  let r, model;
  for (model of list) {
    for (let attempt = 0; attempt < 3; attempt++) {
      r = await fetch(`${BASE}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify(body),
      });
      if (r.status !== 429 && r.status !== 503) break;
      await new Promise((s) => setTimeout(s, 1500 * (attempt + 1))); // free-tier backoff
    }
    if (r.status !== 404) break;
  }
  if (!r.ok) {
    const msg = (await r.text()).match(/"message":\s*"([^"]{0,140})/)?.[1] || '';
    throw new Error(r.status === 429 ? 'AI rate limit hit; try again in a minute' : `AI step failed (${r.status}) ${msg}`);
  }
  MODELS[tier] = model;
  const d = await r.json();

  const u = d.usageMetadata || {};
  usage.calls++;
  usage.input += u.promptTokenCount || 0;
  usage.output += u.candidatesTokenCount || 0;
  const m = (usage.byModel[model] ||= { calls: 0, tokens: 0 });
  m.calls++;
  m.tokens += u.totalTokenCount || 0;

  const cand = d.candidates?.[0];
  const text = cand?.content?.parts?.map((p) => p.text || '').join('') || '';
  const sources = (cand?.groundingMetadata?.groundingChunks || [])
    .map((c) => c.web && { title: c.web.title, url: c.web.uri })
    .filter(Boolean);
  if (!json) return { text, sources };
  const out = parseJSON(text);
  if (search && out && typeof out === 'object') out._sources = sources;
  return out;
}

export function parseJSON(t) {
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const s = (fence ? fence[1] : t).trim();
  try {
    return JSON.parse(s);
  } catch {
    const i = Math.min(...['{', '['].map((c) => (s.indexOf(c) < 0 ? Infinity : s.indexOf(c))));
    const j = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
    if (i < j) return JSON.parse(s.slice(i, j + 1));
    throw new Error('Model returned non-JSON');
  }
}

export const pdfPart = (buf) => ({
  inline_data: { mime_type: 'application/pdf', data: Buffer.from(buf).toString('base64') },
});

const ALLOWED = /(^|\.)(bseindia\.com|nseindia\.com|screener\.in)$/;
export async function fetchPdf(url, { anyHost = false } = {}) {
  const u = new URL(url);
  if (!anyHost && !ALLOWED.test(u.hostname)) throw new Error('Host not allowed');
  const r = await fetch(u, { headers: { ...UA, Referer: 'https://www.bseindia.com/' } });
  if (!r.ok) throw new Error(`PDF ${r.status}`);
  const buf = await r.arrayBuffer();
  if (buf.byteLength > 18e6) throw new Error('PDF too large');
  return buf;
}
