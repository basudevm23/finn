'use client';
import { useEffect, useState } from 'react';

// Small-print data attribution shown at the foot of every screen (display only).
export default function DataNote() {
  const [t, setT] = useState('');
  useEffect(() => {
    setT(new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
  }, []);
  return (
    <footer className="datanote">
      <p><b>Data</b> · Filings: BSE corporate announcements · Prices &amp; volume: Yahoo Finance end-of-day (NSE) · Financials, concall transcripts &amp; annual reports: company filings via screener.in · AI summaries &amp; analysis: Google Gemini</p>
      <p>Prices are end-of-day, not live{t ? ` · page loaded ${t} IST` : ''} · For information only, not investment advice.</p>
    </footer>
  );
}
