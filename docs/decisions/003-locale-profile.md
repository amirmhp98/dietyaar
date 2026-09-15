# 003 — One locale profile per deployment, strings through `t()`

**Decision.** `src/lib/locale.ts` holds one active profile (language, direction, calendar, numerals,
time zone, week, currency) selected by `NEXT_PUBLIC_LOCALE` at build time. All user-facing strings are
keys in a dictionary under `src/messages/` read through `t()` / `tp()`. Formatting goes through
`@/lib/format`.
Layout uses logical CSS only.

**Why.** The default product is Persian, RTL and Jalali, but the same code must run as an English LTR
app without a rewrite. A build-time profile keeps `t()` free of hooks and contexts, so it works
identically in server components, client components, server actions and Playwright specs. It also
removes a whole category of bugs: no component decides for itself what "right" means or how to render
a digit.

**Consequences.** One deployment serves one locale; per-user language switching would need a runtime
provider and is out of scope. The e2e suite reads its locators through `t()`, so it passes for
either profile.

**Amended 2026-09-15: one language per project.** Adopters build a Persian app or an English app,
never both, and the original requirement that every string exist in both `fa.ts` and `en.ts` was pure
cost for them. Now `setup.sh --locale fa|en` keeps one dictionary, deletes the other, rewrites
`src/messages/index.ts` to a single re-export and sets `FALLBACK_LOCALE` in `src/lib/locale.ts`. A
project has one file to add strings to and no parity to maintain. The boilerplate repository itself
keeps both dictionaries (the parity check lives in `src/messages/index.ts`) and its CI builds, runs the
e2e suite and exercises `setup.sh` for both languages, so either choice stays verified.

`--locale en` also strips what only Persian needs: the Yekan Bakh font and its `[lang='fa']` CSS,
`src/lib/persian.ts`, `src/lib/validators/iran.ts`, `docs/rtl-fa-checklist.md`, the RTL smoke check
(and its `lint:rtl` script) and the "Persian and RTL" rules in `AGENTS.md`. Those live between
`fa-only` markers in the boilerplate so the script can remove them by block rather than by regex.
Logical CSS utilities and `t()` stay in both flavours: they cost nothing in LTR and stripping them
would fork the UI kit.
