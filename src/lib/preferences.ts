/**
 * Names of cookies that carry per-browser UI preferences. Kept in a plain
 * module (no 'use client', no server-only) so both the server layout that
 * reads them and the client provider that writes them can import the names.
 */
export const SIDEBAR_COLLAPSED_COOKIE = 'sidebar-collapsed';
export const PREFERENCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
