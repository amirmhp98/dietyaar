# 007 — The first agent session defines the product before building

**Decision.** After `setup.sh`, three placeholders stay on purpose: `docs/PRD.md` › _What it is_, the
intro paragraph of `README.md` and `APP_DESCRIPTION` in `src/lib/app-config.ts`. `AGENTS.md` ›
"Before the first feature" tells any agent that while the PRD placeholder exists the product is
undefined: gather requirements, match them against "What ships, what does not", write the product
into those three places, remove what will not be used, then delete that section. Everything else
that described the template (README intro, quick start, adoption notes, the second locale in CI,
`setup.sh` itself) is rewritten or removed by `setup.sh`.

**Why.** An agent given an empty PRD and a README that calls itself a boilerplate will build features
against the template's description, not the product's, and will either assume infrastructure that is
not here (email, uploads, jobs, permissions) or rebuild what is. Making the product definition a
gate, and the scope map explicit, turns the first session into requirements work instead of guessing.

**Consequences.** The first session produces docs, not code. `setup.sh` carries more rewriting
(README markers, CI matrix) and the CI smoke job asserts that no template prose survives. The scope
table in `AGENTS.md` must be kept honest when something generic is added (a mailer, a queue).
