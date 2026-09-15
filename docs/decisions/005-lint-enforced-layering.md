# 005 — Architecture rules are ESLint rules, not prose

**Decision.** The layering in `AGENTS.md` (components cannot import Prisma or services; services
cannot import Next or React; actions cannot import UI or Prisma; primitives only inside
`components/ui`) is implemented as `no-restricted-imports` rules in `eslint.config.mjs`. Physical
direction utilities and `side="left|right"` are rejected by `scripts/rtl-smoke-check.mjs`. Both run
in `npm run lint:all` and in CI. The RTL script only exists in Persian projects; `setup.sh --locale en`
removes it, since an LTR-only app gains nothing from the rule.

**Why.** Rules that live only in a markdown file decay, especially when most code is written by agents
that read the file once. A red squiggle at the import line is the cheapest possible feedback and it is
enforced on every commit. The messages on each rule say where the code should go instead.

**Consequences.** Type-only imports are always allowed, so components can still use Prisma types.
Route-segment files (`page.tsx`, `layout.tsx`, `route.ts`) may read through services; client islands
next to them may not. When a rule is wrong, change the rule and the document together.
