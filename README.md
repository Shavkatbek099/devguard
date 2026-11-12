# DevGuard

**Fail fast on bad config. Never commit a secret.** DevGuard is a small, dependency-light toolkit that
validates environment variables and config files, scans for accidentally committed secrets, and wires both
into your terminal and your pull requests.

> **Status: 0.1.0, pre-release.** Not yet published to npm. See [ROADMAP.md](ROADMAP.md).
> Package names and the `OWNER` placeholders in URLs must be finalised before publishing ([docs/releasing.md](docs/releasing.md)).

## Why DevGuard?

- **Type-safe env access.** `createEnv()` validates `process.env` once at startup and returns a fully typed object (`port: number`, `NODE_ENV: 'development' | 'production'`, …) instead of `string | undefined` everywhere.
- **Secrets never leak through the tool.** Reports contain rule, file, line, column and a non-reversible fingerprint, never the secret itself, in text, JSON, or CI annotations.
- **One tool, three jobs.** Env validation, config/schema validation (JSON, YAML via optional adapter), and secret scanning share one report format, one exit-code contract and one CI integration.
- **Tiny and auditable.** Runtime dependencies: only DevGuard's own packages. No telemetry, no network calls.
- **Works everywhere.** ESM + CommonJS, Node ≥ 18.17, Windows/macOS/Linux, full `.d.ts`.

## Quick start

```bash
npm i -D devguard           # CLI
npm i @devguard/validator   # typed env validation in your app
npx devguard init --workflow
npx devguard check
```

### Typed environment

```ts
import { createEnv, env } from '@devguard/validator';

export const config = createEnv({
  NODE_ENV: env.enum(['development', 'test', 'production'] as const, { default: 'development' }),
  PORT: env.port({ default: 3000 }),
  DATABASE_URL: env.url({ protocols: ['postgres', 'postgresql'] }),
  ADMIN_EMAIL: env.email({ optional: true }),
});

config.PORT; // number
config.NODE_ENV; // 'development' | 'test' | 'production'
config.ADMIN_EMAIL; // string | undefined
```

Missing or invalid variables throw one `ValidationError` listing **every** problem. Error messages never echo the offending value.

### Secret scanning

```bash
$ npx devguard scan
CRITICAL secret/github-token src/api.ts:12:18
         Possible GitHub token detected
         -> Revoke/rotate this credential now, remove it from the code and git history, ...

1 issue (1 critical). Failing (fail-on: high)
```

Exit codes: `0` pass · `1` findings at/above `--fail-on` · `2` usage/runtime error.
Formats: `--format text|json|github` (GitHub format creates PR annotations).

### GitHub Actions

```yaml
- uses: OWNER/devguard/packages/github-action@v0
  with: { fail-on: high }
```

## Packages

| Package               | Purpose                                                       |
| --------------------- | ------------------------------------------------------------- |
| `@devguard/core`      | Issue/report types, errors, text/JSON/GitHub reporters        |
| `@devguard/validator` | `createEnv`, `.env` parsing, JSON-Schema-subset config checks |
| `@devguard/scanner`   | Secret scanner API (`scanDirectory`, `scanText`)              |
| `devguard`            | CLI: `init`, `check`, `scan`, `validate`, `report`, `doctor`  |

## Documentation

[Getting started](docs/getting-started.md) · [CLI](docs/cli.md) · [API](docs/api.md) · [Configuration](docs/configuration.md) ·
[Frameworks](docs/frameworks.md) · [GitHub Actions](docs/github-actions.md) · [Troubleshooting](docs/troubleshooting.md) ·
[Migration](docs/migration.md) · [Architecture](docs/architecture.md)

## Limitations (read this)

- The scanner is **pattern + entropy based**. It will miss some secrets and flag some non-secrets. It complements, not replaces, provider-side secret scanning (e.g. GitHub push protection).
- The schema validator implements a **subset** of JSON Schema (see [docs/api.md](docs/api.md)); it is not a full draft-2020-12 implementation.
- DevGuard does not scan git history yet (see roadmap).

## Contributing

Contributions are welcome, especially new detection rules and false-positive reports. Read [CONTRIBUTING.md](CONTRIBUTING.md).
Look for the `good first issue` label.

## License

MIT
