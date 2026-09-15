import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { DirectionProvider, Toaster } from '@/components/UiComponents';
import { APP_DESCRIPTION, APP_NAME } from '@/lib/app-config';
import { locale } from '@/lib/locale';

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
};

/** Applies the saved theme before first paint so there is no flash of the wrong theme. */
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.remove('dark');document.documentElement.setAttribute('data-theme','light')}}catch(e){}})()`;

/**
 * Document shell only: html/body, font, theme, direction, toasts.
 * Auth and the app chrome live in the (app) route group; the (auth) group
 * renders bare pages such as /login.
 */
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang={locale.lang}
      dir={locale.dir}
      className="dark"
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
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
