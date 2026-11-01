'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function TabBar() {
  const path = usePathname();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const read = () => { try { setUnread(+sessionStorage.getItem('finn.unreadCount') || 0); } catch {} };
    read();
    window.addEventListener('finn-unread', read);
    return () => window.removeEventListener('finn-unread', read);
  }, []);
  const onResearch = path.startsWith('/research');
  return (
    <nav className="tabbar">
      <div className="tabbar-in">
        <Link href="/" className={`tab ${!onResearch ? 'on' : ''}`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
          Alerts
          {unread > 0 && <span className="badge">{unread > 99 ? '99+' : unread}</span>}
        </Link>
        <Link href="/research" className={`tab ${onResearch ? 'on' : ''}`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          Research
        </Link>
      </div>
    </nav>
  );
}
