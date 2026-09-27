import type { Metadata, Viewport } from 'next';
import { Anton, JetBrains_Mono } from 'next/font/google';
import { SITE } from '@/content/site';
import './globals.css';

const display = Anton({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-anton',
  fallback: ['Archivo Black', 'Impact', 'sans-serif'],
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
});

export const metadata: Metadata = {
  title: `${SITE.project} — ${SITE.tagline}`,
  description: SITE.shortDescription,
  metadataBase: new URL(SITE.github),
  openGraph: {
    title: SITE.project,
    description: SITE.shortDescription,
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#050505',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body>
        {children}
        <noscript>
          <p className="noscript-note">
            {`${SITE.project}. ${SITE.tagline}. ${SITE.shortDescription} The interactive instrument requires JavaScript; the full written record is on this page.`}
          </p>
        </noscript>
      </body>
    </html>
  );
}
