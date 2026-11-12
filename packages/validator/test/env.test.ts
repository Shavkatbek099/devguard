import { describe, expect, expectTypeOf, it } from 'vitest';
import { ValidationError } from '@devguard/core';
import { createEnv, env, parseDotenv, validateEnv } from '../src/index.js';

describe('validateEnv', () => {
  const schema = {
    PORT: env.port({ default: 3000 }),
    NODE_ENV: env.enum(['development', 'test', 'production'] as const, { default: 'development' }),
    DATABASE_URL: env.url({ protocols: ['postgres'] }),
    ADMIN_EMAIL: env.email({ optional: true }),
    DEBUG: env.boolean({ default: false }),
    API_KEY: env.string({ minLength: 8 }),
    WORKERS: env.number({ integer: true, min: 1, max: 16, default: 2 }),
  };
  const good = { DATABASE_URL: 'postgres://u:p@localhost:5432/db', API_KEY: 'abcdefgh' };

  it('accepts valid input and applies defaults', () => {
    const r = validateEnv(schema, good);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ PORT: 3000, NODE_ENV: 'development', DEBUG: false, WORKERS: 2, ADMIN_EMAIL: undefined });
  });

  it('parses and coerces values', () => {
    const r = validateEnv(schema, { ...good, PORT: '8080', DEBUG: 'YES', WORKERS: '4', NODE_ENV: 'production', ADMIN_EMAIL: 'a@b.co' });
    expect(r.ok && r.value).toMatchObject({ PORT: 8080, DEBUG: true, WORKERS: 4, NODE_ENV: 'production', ADMIN_EMAIL: 'a@b.co' });
  });

  it('reports missing required variables', () => {
    const r = validateEnv(schema, {});
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.rule)).toEqual(['env/missing', 'env/missing']);
    expect(r.issues[0]!.message).toContain('DATABASE_URL');
  });

  it('treats empty strings as missing', () => {
    const r = validateEnv(schema, { ...good, API_KEY: '' });
    expect(r.ok).toBe(false);
  });

  it.each([
    ['PORT', 'abc'],
    ['PORT', '70000'],
    ['PORT', '80.5'],
    ['PORT', ' '],
    ['NODE_ENV', 'staging'],
    ['DEBUG', 'maybe'],
    ['ADMIN_EMAIL', 'nope'],
    ['WORKERS', '0'],
    ['WORKERS', '17'],
    ['DATABASE_URL', 'not a url'],
    ['DATABASE_URL', 'https://x.test'],
    ['API_KEY', 'short'],
    ['PORT', 'Infinity'],
    ['PORT', 'NaN'],
  ])('rejects invalid %s=%s', (key, value) => {
    const r = validateEnv(schema, { ...good, [key]: value });
    expect(r.ok).toBe(false);
  });

  it('never echoes the offending value in messages', () => {
    const secret = 'super-secret-value-123';
    const r = validateEnv({ PORT: env.port() }, { PORT: secret });
    expect(JSON.stringify(r.issues)).not.toContain(secret);
  });

  it('supports custom validation rules', () => {
    const s = { TOKEN: env.string({ validate: (v) => v.startsWith('tok_') || 'must start with tok_' }) };
    expect(validateEnv(s, { TOKEN: 'abc' }).issues[0]!.message).toBe('TOKEN must start with tok_');
    expect(validateEnv(s, { TOKEN: 'tok_abc' }).ok).toBe(true);
    const s2 = { N: env.number({ validate: (n) => n % 2 === 0 }) };
    expect(validateEnv(s2, { N: '3' }).ok).toBe(false);
  });

  it('is not fooled by prototype keys in the source', () => {
    const s = { toString: env.string({ optional: true }) };
    expect(validateEnv(s, {}).ok).toBe(true);
  });

  it('string patterns are not stateful across calls (global flag stripped)', () => {
    const s = { ID: env.string({ pattern: /^[a-z]+$/g }) };
    expect(validateEnv(s, { ID: 'abc' }).ok).toBe(true);
    expect(validateEnv(s, { ID: 'abc' }).ok).toBe(true);
  });
});

describe('createEnv', () => {
  it('throws ValidationError listing all problems', () => {
    expect(() => createEnv({ A: env.string(), B: env.number() }, {})).toThrow(ValidationError);
    try {
      createEnv({ A: env.string(), B: env.number() }, {});
    } catch (e) {
      expect((e as ValidationError).issues).toHaveLength(2);
      expect((e as Error).message).toContain('A is required');
    }
  });

  it('infers precise types', () => {
    const cfg = createEnv(
      {
        PORT: env.port({ default: 1 }),
        MODE: env.enum(['a', 'b'] as const),
        OPT: env.string({ optional: true }),
        FLAG: env.boolean({ default: true }),
        N: env.number(),
      },
      { MODE: 'a', N: '1' },
    );
    expectTypeOf(cfg.PORT).toEqualTypeOf<number>();
    expectTypeOf(cfg.MODE).toEqualTypeOf<'a' | 'b'>();
    expectTypeOf(cfg.OPT).toEqualTypeOf<string | undefined>();
    expectTypeOf(cfg.FLAG).toEqualTypeOf<boolean>();
    expectTypeOf(cfg.N).toEqualTypeOf<number>();
  });
});

describe('parseDotenv', () => {
  it('parses quotes, comments and export', () => {
    expect(parseDotenv('# c\nA=1\nexport B="two words"\nC=\'x\' \nD=val # trailing\n\nbad line\n__proto__=x')).toMatchObject({
      A: '1',
      B: 'two words',
      C: 'x',
      D: 'val',
    });
  });
  it('does not pollute Object.prototype', () => {
    parseDotenv('__proto__=polluted');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
