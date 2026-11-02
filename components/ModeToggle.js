'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

// Top-level switch between the two halves of the brief:
// Push = the app reaches out to you; Pull = you ask it to dig in.
export default function ModeToggle({ right = null }) {
  const pull = usePathname().startsWith('/research');
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const read = () => { try { setUnread(+sessionStorage.getItem('finn.unreadCount') || 0); } catch {} };
    read();
    window.addEventListener('finn-unread', read);
    return () => window.removeEventListener('finn-unread', read);
  }, []);
  return (
    <div className="modebar">
      <span className="logo">FINN</span>
      <div className="mode" role="tablist" aria-label="Mode">
        <Link href="/" role="tab" aria-selected={!pull} className={!pull ? 'on' : ''}>
          Push{unread > 0 && <span className="mbadge">{unread > 99 ? '99+' : unread}</span>}
        </Link>
        <Link href="/research" role="tab" aria-selected={pull} className={pull ? 'on' : ''}>Pull</Link>
      </div>
      <div className="modebar-r row"><ThemeButton />{right}</div>
    </div>
  );
}

function ThemeButton() {
  const [t, setT] = useState('dark');
  useEffect(() => { setT(document.documentElement.dataset.theme || 'dark'); }, []);
  const flip = () => {
    const n = t === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = n;
    try { localStorage.setItem('finn.theme', n); } catch {}
    setT(n);
  };
  return (
    <button className="theme-btn" onClick={flip} aria-label={`Switch to ${t === 'dark' ? 'light' : 'dark'} theme`}>
      {t === 'dark'
        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>}
    </button>
  );
}
