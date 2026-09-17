import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import './globals.css';
import { DirectionProvider, Toaster } from '@/components/UiComponents';
import { APP_DESCRIPTION, APP_NAME } from '@/lib/app-config';
import { locale } from '@/lib/locale';
import { APPEARANCE_COOKIE, parseAppearance } from '@/lib/theme-cookie';

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
      className={serverDark ? 'dark' : undefined}
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
