# 025 — Consumer visual language on the Supabase palette (amends 019)

**Decision.** `design.md` gets a "Product UI (Dietyaar)" section that governs app screens and
overrides the imported Supabase marketing rules wherever they disagree; the imported sheet stays
as the palette source. The palette does not change: emerald `#3ecf8e` with near-black text, the
ink / hairline grey ladder, `canvas-night` for dark. What changes is the character. Three
surfaces and no other card recipe — `hero` (tinted `--tint-2`, 16 px, level-1 shadow, one per
screen), `list` (hairline container, rows divided by hairlines, 12 px) and `note` (borderless,
muted fill or a 3 px emerald start rule). Sections are grouped by an icon + title header, 24 px
apart, not by font size or a border. Status is carried by a neutral glyph set (○ ● ◐ ⊘ — ? ◷,
plus one glyph per score band) with a `t()` name for screen readers. Actions are icon-first:
the one filled emerald primary carries an icon and a word; row and secondary actions are
`outline` / `ghost` icon buttons with an `aria-label`, 44 px on rows and 36 px only inside dense
editors; text-only buttons are for destructive confirmations. Shapes: buttons 10 px (`--radius`),
cards 16 px (`--radius-card`), chips are pills. A tint ladder `--tint-1/2/3` (primary at
4 / 8 / 14 % light, 10 / 16 / 24 % dark) covers hero, selected and pressed. Manrope, self-hosted
through `next/font`, is the display face for headings, section titles and the 40 px score
numeral (weight ceiling 700 for the numeral, 600 elsewhere); body stays on the system stack.
Empty states get two-tone line illustrations (ink + emerald). Motion is 150–250 ms ease-out; the
numeral counts up once per change and not under `prefers-reduced-motion`. Toasts sit top-centre
under the top bar, the focus ring is 2 px with an offset, skeletons are neutral.

**Why.** Decision 019 adopted `design.md` as-is, and `design.md` is a Supabase marketing token
sheet whose stated character is "quietly technical, near-monochrome, one emerald event, never
pill-shaped, product screenshots instead of illustrations". Both pre-launch reviews and the
owner's walkthrough (improvement-plan.md § 1 root causes 2 and 5, § 2 decisions 8 and 14) reached
the same finding: the pages read as a column of identical white cards with status in grey text,
grouping done by font size, and icons only on utility buttons — a B2B console, text-heavy. The
token architecture underneath is sound, so the fix is what the tokens are allowed to express,
not a new palette or a second component kit.

**Consequences.** `src/app/globals.css` gains `--radius` 10 px, `--radius-card`, `--tint-1/2/3`,
`--elevation-1/2` (utilities `shadow-1` / `shadow-2`), `--toast-top`, `text-numeral` and the
`font-display` utility. The kit changes its defaults: buttons are 44 px with a 10 px radius and
a 2 px offset focus ring (`icon` 44 px, `icon-sm` 36 px), cards are 16 px with the level-1
shadow, badges are pills, inputs and selects use the same ring and 44 px height, skeletons are
`bg-muted`, dialogs and bottom sheets take the card radius, the toaster is top-centre. New
primitives under `src/components/product/` — `Surface`, `SectionHeader`, `StatusGlyph` /
`BandGlyph`, `IconAction`, `Illustration`, `ScoreNumeral` — are shown on `/components`
("Product UI"), which stays the visual regression surface for both themes (019), and the axe
spec checks that block in both themes. Screens adopt them in D1–D3 of the improvement plan; until
then the old card recipe and the new primitives coexist. The rules 019 fixed remain: emerald once
per viewport as the filled primary, status never colour-only, 44 px targets, tokens as CSS
variables, both themes.
