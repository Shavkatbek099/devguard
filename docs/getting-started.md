# Getting started

## Install

```bash
npm i -D devguard                 # CLI (Node >= 18.17)
npm i @devguard/validator         # typed env validation in app code
npm i -D yaml                     # optional: enables YAML config validation
```

`@devguard/*` libraries ship ESM and CommonJS builds plus TypeScript declarations.

## 1. Create a config

```bash
npx devguard init --workflow
```

This writes `devguard.config.json` and `.github/workflows/devguard.yml`. Existing files are never overwritten unless you pass `--force`.

## 2. Describe your environment

```json
{
  "failOn": "high",
  "env": {
    "NODE_ENV": { "type": "enum", "values": ["development", "test", "production"], "default": "development" },
    "PORT": { "type": "port", "default": 3000 },
    "DATABASE_URL": { "type": "url", "protocols": ["postgres"] }
  }
}
```

## 3. Run

```bash
npx devguard validate --env-file .env   # env + config files
npx devguard scan                       # secrets
npx devguard check                      # everything
```

## 4. Use the same schema in code

```ts
import { createEnv, env } from '@devguard/validator';
export const config = createEnv({ PORT: env.port({ default: 3000 }) });
```

The CLI validates in CI; `createEnv` validates (and types) at application startup.
