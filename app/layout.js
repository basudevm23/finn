import './globals.css';
import TabBar from '@/components/TabBar';

export const metadata = {
  title: 'FINN',
  description: 'Your portfolio, filtered. Push digest + on-demand research for Indian equities.',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'FINN' },
};
export const viewport = { themeColor: '#ffffff', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function Root({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <main className="shell">{children}</main>
        <TabBar />
        <script
          dangerouslySetInnerHTML={{
            __html: "if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))",
          }}
        />
      </body>
    </html>
  );
}
