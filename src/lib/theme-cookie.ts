/**
 * Appearance cookie contract shared by the root layout (server) and the
 * actions that write it. Free of server-only imports.
 */
export const APPEARANCE_COOKIE = 'appearance';
export const APPEARANCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type AppearanceValue = 'system' | 'light' | 'dark';

export function appearanceCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: APPEARANCE_COOKIE_MAX_AGE,
  };
}

export function parseAppearance(value: string | undefined): AppearanceValue {
  return value === 'light' || value === 'dark' ? value : 'system';
}
