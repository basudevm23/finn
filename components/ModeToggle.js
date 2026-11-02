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
      <div className="modebar-r">{right}</div>
    </div>
  );
}
