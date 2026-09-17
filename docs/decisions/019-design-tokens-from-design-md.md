# 019 — Visual language: design.md tokens on the local shadcn kit

**Decision.** The component system is the boilerplate's locally owned shadcn kit (decision 004);
`design.md` supplies tokens only. The mapping onto `src/app/globals.css`: primary from
`{colors.primary}` `#3ecf8e` with near-black `on-primary` text (contrast checked ≥ 4.5:1), the
ink/hairline grey ladder for foreground, muted and border variables, `canvas-night` `#1c1c1c` and
`canvas-night-soft` `#202020` for dark surfaces, `--radius` 6 px for buttons and 12 px for cards,
the 2/4/8/12/16/24/32/64 spacing scale, and the four elevation levels as shadow utilities. Body
font is the system stack; no webfont. Product components (design-scope.md "Shared components")
are composed from the kit under `src/components/product/`. Primary controls and list rows are at
least 44 × 44 CSS px (product-spec.md § 12), overriding design.md's 36 px. Emerald appears once per
viewport as the filled primary action; status is never colour-only.

**Why.** `design.md` is a Supabase-inspired marketing token sheet, not product mockups; the product
spec asks for one component library and a minimal, calm UI. Keeping the kit avoids a second
primitive layer and keeps the RTL/bidi fixes in one place.

**Consequences.** `/components` is the visual regression surface for both themes. Dark mode keeps
the `.dark` class switch; "System" appearance resolves it from `prefers-color-scheme` before first
paint (implementation-plan.md § 5 task 3.3). Any new colour is a CSS variable, never a hex value in
a component.
