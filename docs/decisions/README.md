# Decision records

Short notes on the choices that shape this codebase, so adopters and agents do not re-litigate
them. One file per decision, a paragraph or two each. Add a new one when you change a rule.

| #                                               | Decision                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| [001](001-services-layer.md)                    | Business logic lives in a framework-free services layer          |
| [002](002-cookie-sessions.md)                   | Custom cookie sessions with hashed tokens instead of an auth lib |
| [003](003-locale-profile.md)                    | One locale profile per deployment, strings through `t()`         |
| [004](004-local-ui-kit.md)                      | Locally owned shadcn components behind one barrel                |
| [005](005-lint-enforced-layering.md)            | Architecture rules are ESLint rules, not prose                   |
| [006](006-agent-config-in-repo.md)              | Agent configuration and skills are committed                     |
| [007](007-first-session-defines-the-product.md) | The first agent session defines the product before building      |
