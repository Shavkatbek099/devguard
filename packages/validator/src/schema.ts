import type { Issue } from '@devguard/core';

/** A deliberately small, dependency-free subset of JSON Schema. */
export interface Schema {
  type?: SchemaType | SchemaType[];
  required?: string[];
  properties?: Record<string, Schema>;
  additionalProperties?: boolean | Schema;
  items?: Schema;
  enum?: unknown[];
  const?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  anyOf?: Schema[];
  allOf?: Schema[];
}
export type SchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

function typeOf(v: unknown): SchemaType {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v as SchemaType;
}

function matchesType(v: unknown, t: SchemaType): boolean {
  const actual = typeOf(v);
  return actual === t || (t === 'number' && actual === 'integer');
}

const MAX_DEPTH = 64;

/** Validate data against a schema. Issues never include the offending values. */
export function validateSchema(data: unknown, schema: Schema, file?: string, path = '$', depth = 0): Issue[] {
  const issues: Issue[] = [];
  const add = (rule: string, message: string) =>
    issues.push({ rule: `config/${rule}`, severity: 'high', source: 'config', message: `${path}: ${message}`, file });
  if (depth > MAX_DEPTH) {
    add('depth', 'maximum nesting depth exceeded');
    return issues;
  }

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(data, t))) {
      add('type', `expected ${types.join(' | ')}, got ${typeOf(data)}`);
      return issues; // further checks would be noise
    }
  }
  if (schema.const !== undefined && JSON.stringify(data) !== JSON.stringify(schema.const))
    add('const', 'does not equal the required constant');
  if (schema.enum && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(data))) add('enum', 'is not one of the allowed values');

  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) add('minimum', `must be >= ${schema.minimum}`);
    if (schema.maximum !== undefined && data > schema.maximum) add('maximum', `must be <= ${schema.maximum}`);
  }
  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength)
      add('minLength', `must have at least ${schema.minLength} characters`);
    if (schema.maxLength !== undefined && data.length > schema.maxLength)
      add('maxLength', `must have at most ${schema.maxLength} characters`);
    if (schema.pattern !== undefined) {
      try {
        if (!new RegExp(schema.pattern).test(data)) add('pattern', 'does not match the required pattern');
      } catch {
        add('schema', 'schema contains an invalid pattern');
      }
    }
  }
  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) add('minItems', `must have at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && data.length > schema.maxItems) add('maxItems', `must have at most ${schema.maxItems} items`);
    if (schema.items) data.forEach((item, i) => issues.push(...validateSchema(item, schema.items!, file, `${path}[${i}]`, depth + 1)));
  }
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!has(obj, key)) add('missing', `missing required property "${key}"`);
    }
    const props = schema.properties ?? {};
    for (const key of Object.keys(obj)) {
      const childPath = `${path}.${key}`;
      if (has(props, key)) {
        issues.push(...validateSchema(obj[key], props[key]!, file, childPath, depth + 1));
      } else if (schema.additionalProperties === false) {
        issues.push({
          rule: 'config/unknown-property',
          severity: 'medium',
          source: 'config',
          message: `${childPath}: unknown property`,
          file,
        });
      } else if (typeof schema.additionalProperties === 'object') {
        issues.push(...validateSchema(obj[key], schema.additionalProperties, file, childPath, depth + 1));
      }
    }
  }
  if (schema.allOf) for (const s of schema.allOf) issues.push(...validateSchema(data, s, file, path, depth + 1));
  if (schema.anyOf && !schema.anyOf.some((s) => validateSchema(data, s, file, path, depth + 1).length === 0)) {
    add('anyOf', 'does not match any of the allowed shapes');
  }
  return issues;
}
