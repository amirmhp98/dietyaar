# CLAUDE.md — Dietyaar

@AGENTS.md

The file above holds the architecture, layering, database, locale and style rules.
This file adds the workflow Claude Code follows and the tooling it should reach for.

## Workflow

- The product is specified in `docs/`: `product-spec.md` (behaviour), `design-scope.md` (screens and
  journeys), `design.md` (visual), `tech-spec.md` (construction). Before building a feature, read the
  spec sections it implements and check `AGENTS.md` › "What ships, what does not" and
  `tech-spec.md` § 4 (module boundaries) for where the code goes. Where the tech spec deviates from
  a boilerplate rule, a decision record under `docs/decisions/` (008+) says so.
- Keep changes scoped to what was asked. If you discover related work, mention it rather than doing it.
- Before reporting done: `npm run lint:all`, `npm run test`, `npm run build`; exercise the change in the
  browser (Playwright MCP) or add an e2e spec. Say what you tested.
- `docs/PRD.md` is the short reference of what exists today. When a change adds a route, module,
  or user-visible behaviour, update it in a sentence or two. It is a living reference, not a
  changelog; the full specs stay authoritative for what is planned.

### Optional: issue tracking with beads

If the project uses [beads](https://github.com/steveyegge/beads) (a `.beads/` directory exists), track work there:

```bash
bd ready                      # work with no blockers
bd create --title="..." --description="..." --type=task --priority=2
bd update <id> --claim        # mark in_progress
bd close <id> --reason="..."  # only after the user confirms
```

Do not use `bd edit` (opens an interactive editor). If there is no `.beads/` directory, skip this section.

## Tooling

Reach for these proactively when the context matches; skip them for trivial edits.

### MCP servers (configured in `.mcp.json`)

| MCP            | Use when                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Playwright** | Verifying or debugging the running app at `localhost:3000`: screenshots, form flows, console errors.                |
| **Prisma**     | Introspecting the schema, relations, or generating queries before editing `schema.prisma`.                          |
| **Context7**   | Fetching current docs for a third-party npm library. For Next.js itself, read `node_modules/next/dist/docs/` first. |

### Skills (`.claude/skills/`, invoke with `/name` or the Skill tool)

| Skill                                | Use when                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **next-best-practices**              | Creating or changing pages, layouts, route handlers, metadata, loading/error states, RSC boundaries.              |
| **shadcn**                           | Adding, composing, or fixing UI components. Read its "In this repo" section: imports go through the local barrel. |
| **ui-ux-pro-max**                    | Design decisions: palette, spacing, layout, dark mode, RTL. Run its search script from the repo root.             |
| **playwright-best-practices**        | Writing or fixing e2e specs, flaky tests, CI config.                                                              |
| **webapp-testing**                   | One-off visual verification with Python Playwright scripts (the Playwright MCP is usually quicker).               |
| **supabase-postgres-best-practices** | Schema design, indexes, query performance. Skip the RLS/Supabase-only parts.                                      |
| **simplify**                         | After a non-trivial implementation, review the diff for reuse and simplification.                                 |

Each vendored skill has a `SOURCE.md` with upstream repo, commit and license, and an "In this repo" section at the end of `SKILL.md`.

### Decision flow

```
Which spec section is this?        → docs/product-spec.md for behaviour, docs/tech-spec.md for construction
Spec mentions something new?       → AGENTS.md "What ships, what does not" — is it here, and where would it go
New feature?                       → npm run new:module <name>, then follow AGENTS.md "How a feature is built"
Touching a route or layout?        → next-best-practices, then bundled Next docs
Touching the schema or a query?    → Prisma MCP, supabase-postgres-best-practices
Building or changing UI?           → shadcn (barrel!), ui-ux-pro-max for design calls
Done implementing?                 → simplify, then Playwright MCP to verify in the browser
```

## Permissions

`.claude/settings.json` allows the npm/prisma/bd commands the workflow needs and denies
destructive Prisma commands. Put personal overrides in `.claude/settings.local.json` (git-ignored).
