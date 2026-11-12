// Illustrative only: not installed or executed by this repo's CI. Requires `npm i express`.
import express from 'express';
import { createEnv, env } from '@devguard/validator';

const config = createEnv({ PORT: env.port({ default: 3000 }), DATABASE_URL: env.url() });

express()
  .get('/health', (_req, res) => res.json({ ok: true }))
  .listen(config.PORT, () => console.log(`listening on ${config.PORT}`));
