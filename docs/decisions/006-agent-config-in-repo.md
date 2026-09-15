# 006 — Agent configuration and skills are committed

**Decision.** `.claude/settings.json` (permission allow/deny lists) and `.claude/skills/*` (vendored
skills with `SOURCE.md` attribution and an "In this repo" section) are committed. `AGENTS.md` carries
the tool-agnostic rules; `CLAUDE.md` imports it and adds the Claude-specific workflow. Only
`.claude/settings.local.json` is ignored.

**Why.** This boilerplate is meant to be driven by coding agents. Configuration that lives on one
developer's machine does not help the next adopter, and a `CLAUDE.md` that references skills nobody has
installed is worse than none. Vendoring pins the skill content the rules were written against;
`SOURCE.md` says where to refresh it from.

**Consequences.** The repo is a few megabytes larger (`ui-ux-pro-max` ships CSV data and Python
scripts). Skills are updated deliberately, not automatically; each `SOURCE.md` records the upstream
commit. Beads issue tracking is optional and only used when a `.beads/` directory exists.
