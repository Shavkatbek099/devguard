import { createEnv, env } from '@shavkat2006/devguard-validator';

const config = createEnv({
  PORT: env.port({ default: 3000 }),
  GREETING: env.string({ default: 'hello' }),
});

console.log(`${config.GREETING} on port ${config.PORT}`);
