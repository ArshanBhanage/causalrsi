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

/**
 * Where this build is served from. Set `NEXT_PUBLIC_SITE_URL` in the Cloudflare Pages project to
 * the custom domain so canonical and Open Graph URLs are absolute; localhost is only a fallback
 * for local builds.
 */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  title: `${SITE.project} — ${SITE.tagline}`,
  description: SITE.shortDescription,
  metadataBase: new URL(siteUrl),
  alternates: { canonical: '/' },
  openGraph: {
    title: SITE.project,
    description: SITE.shortDescription,
    url: '/',
    siteName: SITE.project,
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: SITE.project,
    description: SITE.shortDescription,
  },
  robots: { index: true, follow: true },
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
