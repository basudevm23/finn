'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ADHOC } from '@/lib/portfolio';

// The pull side lives in one place: type any NSE ticker (or a sentence containing one).
export default function AskBar({ hint = 'Dig into any NSE ticker…', extra = [] }) {
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const router = useRouter();
  const go = (sym) => sym && router.push(`/r/${encodeURIComponent(sym.toUpperCase())}`);
  const submit = (e) => {
    e.preventDefault();
    const tok = q.trim().split(/\s+/).find((w) => /^[A-Za-z&-]{2,15}$/.test(w) && w === w.toUpperCase()) || q.trim().split(/\s+/).pop();
    go(tok);
  };
  return (
    <div className="ask">
      <div className="ask-in">
        {focus && (
          <div className="sugg">
            {[...extra, ...ADHOC].slice(0, 6).map((s) => (
              <button key={s} className="chip" onMouseDown={() => go(s)}>{s}</button>
            ))}
          </div>
        )}
        <form onSubmit={submit}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 150)}
            placeholder={hint}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
          />
          <button type="submit">Dig in</button>
        </form>
      </div>
    </div>
  );
}
