// Tiny in-process cache. Stores the promise first so concurrent requests for the
// same key share one upstream call (and one LLM bill). Survives warm serverless reuse.
const store = (globalThis.__finnCache ||= new Map());

export async function cached(key, ttlMs, fn) {
  const hit = store.get(key);
  if (hit && hit.exp > Date.now()) return hit.val;
  const p = fn();
  store.set(key, { exp: Date.now() + ttlMs, val: p });
  try {
    const v = await p;
    store.set(key, { exp: Date.now() + ttlMs, val: v });
    return v;
  } catch (e) {
    store.delete(key);
    throw e;
  }
}

export const peek = (key) => {
  const hit = store.get(key);
  return hit && hit.exp > Date.now() && !(hit.val instanceof Promise) ? hit.val : undefined;
};

export const HOUR = 3600e3;
export const DAY = 24 * HOUR;
