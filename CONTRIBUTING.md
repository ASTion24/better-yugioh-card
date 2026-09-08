# Contributing

Better YGO accepts focused bug fixes and features that improve real card,
deck-building, playtesting, tournament, or print workflows.

## Principles

- Keep the application local-first and lightweight.
- Do not add a bundled full card database, account system, cloud sync, or a
  large state-management framework.
- Prefer existing browser APIs and project utilities over new dependencies.
- Preserve `.ygoproject` compatibility or provide an explicit migration.
- Keep unrelated refactors out of feature changes.
- Do not commit card images or other assets unless their source and usage terms
  are documented.

## Development

Requirements: Node.js 22+, pnpm 10+, and Python 3.10+ for browser tests.

```bash
pnpm install
pnpm test:e2e:setup
pnpm dev
```

Before submitting a pull request:

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

## Pull requests

Describe the player problem, the behavior change, compatibility impact, and
verification performed. Include desktop and mobile screenshots for visible UI
changes.

Keep pull requests small enough to review. New external data sources must be
on-demand, have explicit failure behavior, and avoid silently persisting a full
remote database.
