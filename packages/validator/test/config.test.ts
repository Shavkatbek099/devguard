import { describe, expect, it } from 'vitest';
import { parseJson, parseYaml, validateConfig, validateSchema, type Schema } from '../src/index.js';

const schema: Schema = {
  type: 'object',
  required: ['name', 'port'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1 },
    port: { type: 'integer', minimum: 1, maximum: 65535 },
    mode: { enum: ['dev', 'prod'] },
    tags: { type: 'array', items: { type: 'string' }, maxItems: 2 },
    contact: { type: 'object', properties: { email: { type: 'string', pattern: '^.+@.+$' } } },
  },
};

describe('validateSchema', () => {
  it('passes valid data', () => {
    expect(validateSchema({ name: 'x', port: 80, mode: 'dev', tags: ['a'] }, schema)).toEqual([]);
  });
  it('detects missing properties', () => {
    const i = validateSchema({ name: 'x' }, schema);
    expect(i).toHaveLength(1);
    expect(i[0]!.rule).toBe('config/missing');
    expect(i[0]!.message).toContain('"port"');
  });
  it('detects invalid types with paths', () => {
    const i = validateSchema({ name: 1, port: '80', tags: [1] }, schema);
    expect(i.map((x) => x.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('$.name: expected string'),
        expect.stringContaining('$.port: expected integer'),
        expect.stringContaining('$.tags[0]'),
      ]),
    );
  });
  it('checks ranges, enums, patterns, arrays, unknown props', () => {
    const i = validateSchema({ name: 'x', port: 0, mode: 'qa', tags: ['a', 'b', 'c'], contact: { email: 'bad' }, extra: true }, schema);
    const rules = i.map((x) => x.rule);
    expect(rules).toEqual(
      expect.arrayContaining(['config/minimum', 'config/enum', 'config/maxItems', 'config/pattern', 'config/unknown-property']),
    );
  });
  it('does not echo values in messages', () => {
    const i = validateSchema({ name: 'x', port: 1, mode: 'hunter2-secret' }, schema);
    expect(JSON.stringify(i)).not.toContain('hunter2-secret');
  });
  it('supports anyOf/allOf and nullable types', () => {
    expect(validateSchema(null, { type: ['string', 'null'] })).toEqual([]);
    expect(validateSchema(5, { anyOf: [{ type: 'string' }, { type: 'number' }] })).toEqual([]);
    expect(validateSchema(true, { anyOf: [{ type: 'string' }, { type: 'number' }] })).toHaveLength(1);
  });
  it('survives invalid regex in schema and deep nesting', () => {
    expect(validateSchema('a', { pattern: '(' })[0]!.rule).toBe('config/schema');
    let deep: unknown = 1;
    let s: Schema = { type: 'integer' };
    for (let i = 0; i < 100; i++) {
      deep = [deep];
      s = { type: 'array', items: s };
    }
    expect(validateSchema(deep, s).some((x) => x.rule === 'config/depth')).toBe(true);
  });
});

describe('parseJson', () => {
  it('reports syntax errors', () => {
    expect(parseJson('{ nope', 'a.json').issues[0]!.rule).toBe('config/syntax');
  });
  it('handles BOM', () => {
    expect(parseJson('\ufeff{"a":1}').data).toEqual({ a: 1 });
  });
  it('flags __proto__ keys', () => {
    expect(parseJson('{"__proto__":{"admin":true}}').issues[0]!.rule).toBe('config/unsafe-key');
  });
});

describe('parseYaml', () => {
  it('requires an adapter', () => {
    expect(parseYaml('a: 1', undefined).issues[0]!.rule).toBe('config/yaml-adapter-missing');
  });
  it('uses the supplied adapter and reports parse errors', () => {
    expect(parseYaml('x', () => ({ ok: 1 })).data).toEqual({ ok: 1 });
    expect(
      parseYaml('x', () => {
        throw new Error('boom');
      }).issues[0]!.message,
    ).toContain('boom');
  });
});

describe('consistency rules', () => {
  it('reports failing and throwing rules', () => {
    const issues = validateConfig(
      { min: 5, max: 1 },
      {
        rules: [
          { id: 'min-le-max', message: 'min must be <= max', test: (d) => d.min <= d.max },
          {
            id: 'throws',
            message: 'broken',
            test: () => {
              throw new Error('x');
            },
          },
          { id: 'ok', message: 'never', test: () => true },
        ],
      },
    );
    expect(issues.map((i) => i.rule)).toEqual(['config/consistency/min-le-max', 'config/consistency/throws']);
  });
});
