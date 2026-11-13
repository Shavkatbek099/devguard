import { ValidationError } from '@shavkat2006/devguard-core';
import { createEnv, env } from '@shavkat2006/devguard-validator';

export function loadConfig(source: Record<string, string | undefined> = process.env) {
  return createEnv(
    {
      NODE_ENV: env.enum(['development', 'test', 'production'] as const, { default: 'development' }),
      PORT: env.port({ default: 3000 }),
      DATABASE_URL: env.url({ protocols: ['postgres', 'postgresql'] }),
      ADMIN_EMAIL: env.email({ optional: true }),
    },
    source,
  );
}

export type AppConfig = ReturnType<typeof loadConfig>;

try {
  const cfg = loadConfig({ DATABASE_URL: 'postgres://localhost/app' });
  const port: number = cfg.PORT; // inferred as number
  const mode: 'development' | 'test' | 'production' = cfg.NODE_ENV; // inferred union
  const admin: string | undefined = cfg.ADMIN_EMAIL; // optional -> string | undefined
  console.log({ port, mode, admin });
} catch (e) {
  if (e instanceof ValidationError) console.error(e.message);
}
