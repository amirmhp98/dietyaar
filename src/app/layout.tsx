import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Manrope } from 'next/font/google';
import { cookies } from 'next/headers';
import './globals.css';
import { DirectionProvider, Toaster } from '@/components/UiComponents';
import { APP_DESCRIPTION, APP_NAME } from '@/lib/app-config';
import { locale } from '@/lib/locale';
import { APPEARANCE_COOKIE, parseAppearance } from '@/lib/theme-cookie';
import { cn } from '@/lib/utils';

/**
 * Display face for headings, section titles and the score numeral (design.md
 * "Product UI" › Typography, decision 025); body text stays on the system
 * stack. Self-hosted by next/font, one variable file, weights 500–700 in use.
 * To try Plus Jakarta Sans instead, change the import to
 * `import { Plus_Jakarta_Sans as Manrope } from 'next/font/google';`.
 */
const display = Manrope({
  subsets: ['latin'],
  weight: 'variable',
  display: 'swap',
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1c1c' },
  ],
};

/**
 * Resolves "system" before first paint and follows OS changes, so there is no
 * flash. Explicit light/dark are already rendered by the server from the cookie.
 */
const APPEARANCE_INIT_SCRIPT = `(function(){try{var h=document.documentElement;var p=h.getAttribute('data-appearance')||'system';var m=window.matchMedia('(prefers-color-scheme: dark)');function apply(){var pref=h.getAttribute('data-appearance')||'system';var dark=pref==='dark'||(pref==='system'&&m.matches);h.classList.toggle('dark',dark);h.setAttribute('data-theme',dark?'dark':'light')}if(p==='system'){apply()}m.addEventListener('change',apply)}catch(e){}})()`;

/**
 * Document shell only: html/body, appearance, direction, toasts.
 * Auth and the app chrome live in the (app) route group; the (auth) group
 * renders bare pages such as /login and /signup.
 */
export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const appearance = parseAppearance((await cookies()).get(APPEARANCE_COOKIE)?.value);
  const serverDark = appearance === 'dark';

  return (
    <html
      lang={locale.lang}
      dir={locale.dir}
      className={cn(display.variable, serverDark && 'dark')}
      data-theme={serverDark ? 'dark' : 'light'}
      data-appearance={appearance}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_INIT_SCRIPT }} />
      </head>
      <body className="bg-background font-sans text-foreground antialiased">
        <DirectionProvider>
          {children}
          <Toaster />
        </DirectionProvider>
      </body>
    </html>
  );
}
