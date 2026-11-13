import { ValidationError, type Issue } from '@shavkat2006/devguard-core';

export type ParseResult<T> = { ok: true; value: T } | { ok: false; message: string };

export interface Field<T> {
  readonly kind: string;
  readonly optional: boolean;
  readonly hasDefault: boolean;
  readonly defaultValue: T | undefined;
  readonly description: string | undefined;
  /** Phantom type used only for inference. */
  readonly _type?: T;
  parse(raw: string): ParseResult<T>;
  check?(value: T): true | string;
}

interface BaseOpts<T> {
  optional?: boolean;
  default?: T;
  description?: string;
  /** Custom rule: return true if valid, false or an error message string otherwise. */
  validate?: (value: T) => boolean | string;
}

type Out<T, O> = O extends { default: unknown } ? T : O extends { optional: true } ? T | undefined : T;

function make<T>(kind: string, opts: BaseOpts<T>, parse: (raw: string) => ParseResult<T>): Field<T> {
  return {
    kind,
    optional: opts.optional === true,
    hasDefault: opts.default !== undefined,
    defaultValue: opts.default,
    description: opts.description,
    parse,
    check: opts.validate
      ? (v: T) => {
          const r = opts.validate!(v);
          return r === true ? true : typeof r === 'string' ? r : 'failed custom validation';
        }
      : undefined,
  };
}

const ok = <T>(value: T): ParseResult<T> => ({ ok: true, value });
const fail = (message: string): ParseResult<never> => ({ ok: false, message });

export interface StringOpts extends BaseOpts<string> {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
}
export interface NumberOpts extends BaseOpts<number> {
  min?: number;
  max?: number;
  integer?: boolean;
}
export interface UrlOpts extends BaseOpts<string> {
  protocols?: string[];
}

export const env = {
  string<const O extends StringOpts>(opts: O = {} as O): Field<Out<string, O>> {
    return make<string>('string', opts, (raw) => {
      if (opts.minLength !== undefined && raw.length < opts.minLength) return fail(`must be at least ${opts.minLength} characters`);
      if (opts.maxLength !== undefined && raw.length > opts.maxLength) return fail(`must be at most ${opts.maxLength} characters`);
      if (opts.pattern) {
        const re = new RegExp(opts.pattern.source, opts.pattern.flags.replace(/[gy]/g, ''));
        if (!re.test(raw)) return fail('does not match the required pattern');
      }
      return ok(raw);
    }) as Field<Out<string, O>>;
  },
  number<const O extends NumberOpts>(opts: O = {} as O): Field<Out<number, O>> {
    return make<number>('number', opts, (raw) => {
      const t = raw.trim();
      const n = t === '' ? NaN : Number(t);
      if (!Number.isFinite(n)) return fail('must be a number');
      if (opts.integer && !Number.isInteger(n)) return fail('must be an integer');
      if (opts.min !== undefined && n < opts.min) return fail(`must be >= ${opts.min}`);
      if (opts.max !== undefined && n > opts.max) return fail(`must be <= ${opts.max}`);
      return ok(n);
    }) as Field<Out<number, O>>;
  },
  port<const O extends BaseOpts<number>>(opts: O = {} as O): Field<Out<number, O>> {
    return env.number({ ...opts, integer: true, min: 1, max: 65535 }) as Field<Out<number, O>>;
  },
  boolean<const O extends BaseOpts<boolean>>(opts: O = {} as O): Field<Out<boolean, O>> {
    return make<boolean>('boolean', opts, (raw) => {
      const v = raw.trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(v)) return ok(true);
      if (['false', '0', 'no', 'off'].includes(v)) return ok(false);
      return fail('must be a boolean (true/false, 1/0, yes/no, on/off)');
    }) as Field<Out<boolean, O>>;
  },
  url<const O extends UrlOpts>(opts: O = {} as O): Field<Out<string, O>> {
    return make<string>('url', opts, (raw) => {
      let u: URL;
      try {
        u = new URL(raw);
      } catch {
        return fail('must be a valid URL');
      }
      if (opts.protocols && !opts.protocols.includes(u.protocol.replace(/:$/, ''))) {
        return fail(`must use one of the protocols: ${opts.protocols.join(', ')}`);
      }
      return ok(raw);
    }) as Field<Out<string, O>>;
  },
  email<const O extends BaseOpts<string>>(opts: O = {} as O): Field<Out<string, O>> {
    return make<string>('email', opts, (raw) =>
      raw.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(raw) ? ok(raw) : fail('must be a valid email address'),
    ) as Field<Out<string, O>>;
  },
  enum<const V extends readonly string[], const O extends BaseOpts<V[number]> = BaseOpts<V[number]>>(
    values: V,
    opts: O = {} as O,
  ): Field<Out<V[number], O>> {
    return make<V[number]>('enum', opts, (raw) =>
      (values as readonly string[]).includes(raw) ? ok(raw as V[number]) : fail(`must be one of: ${values.join(', ')}`),
    ) as Field<Out<V[number], O>>;
  },
};

export type EnvSchema = Record<string, Field<any>>;
export type InferEnv<S extends EnvSchema> = { [K in keyof S]: S[K] extends Field<infer T> ? T : never };

export type EnvResult<S extends EnvSchema> =
  { ok: true; value: InferEnv<S>; issues: Issue[] } | { ok: false; value?: undefined; issues: Issue[] };

type Source = Record<string, string | undefined>;

/**
 * Validate a source (default `process.env`) against a schema.
 * Messages intentionally never echo the offending value (it may be a secret).
 * Empty strings are treated as "not set".
 */
export function validateEnv<S extends EnvSchema>(schema: S, source: Source = process.env): EnvResult<S> {
  const issues: Issue[] = [];
  const value: Record<string, unknown> = {};
  for (const key of Object.keys(schema)) {
    const field = schema[key]!;
    const raw = Object.prototype.hasOwnProperty.call(source, key) ? source[key] : undefined;
    if (raw === undefined || raw === '') {
      if (field.hasDefault) value[key] = field.defaultValue;
      else if (field.optional) value[key] = undefined;
      else {
        issues.push({
          rule: 'env/missing',
          severity: 'high',
          source: 'env',
          message: `${key} is required but not set${field.description ? ` (${field.description})` : ''}`,
          remediation: `Set ${key} in your environment or .env file`,
        });
      }
      continue;
    }
    const parsed = field.parse(raw);
    if (!parsed.ok) {
      issues.push({ rule: 'env/invalid', severity: 'high', source: 'env', message: `${key} ${parsed.message}` });
      continue;
    }
    const custom = field.check?.(parsed.value);
    if (custom !== undefined && custom !== true) {
      issues.push({ rule: 'env/custom', severity: 'high', source: 'env', message: `${key} ${custom}` });
      continue;
    }
    value[key] = parsed.value;
  }
  return issues.length ? { ok: false, issues } : { ok: true, value: value as InferEnv<S>, issues };
}

/** Like validateEnv but throws a ValidationError listing every problem. */
export function createEnv<S extends EnvSchema>(schema: S, source: Source = process.env): InferEnv<S> {
  const r = validateEnv(schema, source);
  if (!r.ok) {
    throw new ValidationError(`Invalid environment configuration:\n${r.issues.map((i) => `  - ${i.message}`).join('\n')}`, r.issues);
  }
  return r.value;
}

/** Minimal .env parser (KEY=value, quotes, comments, `export` prefix). Does not expand variables. */
export function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1]!;
    let val = m[2]!.trim();
    if ((val.startsWith('"') && val.endsWith('"') && val.length >= 2) || (val.startsWith("'") && val.endsWith("'") && val.length >= 2)) {
      val = val.slice(1, -1);
    } else {
      val = val.replace(/\s+#.*$/, '');
    }
    out[key] = val;
  }
  return { ...out };
}
