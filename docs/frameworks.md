# Framework integration

DevGuard is framework-agnostic: validate once at startup, export the typed object.

## Express / Node

```ts
// src/config.ts
import { createEnv, env } from '@devguard/validator';
export const config = createEnv({ PORT: env.port({ default: 3000 }), DATABASE_URL: env.url() });
```

Import `config` before creating the server so the process fails fast with a complete list of problems.

## Next.js

Validate server-only variables in a server module (e.g. `src/env.server.ts`) and never import it from client components.
Variables prefixed `NEXT_PUBLIC_` are inlined into the browser bundle: do not put secrets in them. To fail the build early, import the module from `next.config.js` (ESM) or run `npx devguard validate` before `next build`.

## Vite / other bundlers

Use `import.meta.env` as the source: `createEnv(schema, import.meta.env as Record<string, string>)`.

> The `examples/` folder holds minimal samples. `basic` and `typescript` are executed by the repo's checks; `express` and `nextjs` are illustrative and are **not** installed or run in CI yet.
