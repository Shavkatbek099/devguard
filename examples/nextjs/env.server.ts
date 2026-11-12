// Illustrative only: not installed or executed by this repo's CI.
// Import this file from server code only. NEXT_PUBLIC_* values are exposed to the browser.
import { createEnv, env } from '@devguard/validator';

export const serverEnv = createEnv({
  DATABASE_URL: env.url({ protocols: ['postgres'] }),
  SESSION_SECRET: env.string({ minLength: 32 }),
  NEXT_PUBLIC_SITE_URL: env.url({ protocols: ['https'] }),
});
