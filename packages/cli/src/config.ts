import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { UsageError, isSeverity, type Severity } from '@devguard/core';
import { env, parseDotenv, type EnvSchema, type Field, type Schema } from '@devguard/validator';
import type { CustomPattern } from '@devguard/scanner';

export interface EnvFieldConfig {
  type: 'string' | 'number' | 'port' | 'boolean' | 'url' | 'email' | 'enum';
  required?: boolean;
  default?: string | number | boolean;
  description?: string;
  min?: number;
  max?: number;
  integer?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  values?: string[];
  protocols?: string[];
}

export interface ValidateTarget {
  file: string;
  /** Path to a JSON schema file, or an inline schema. */
  schema?: string | Schema;
  /** Simple consistency rules: property paths that must be present together. */
  requireTogether?: string[][];
}

export interface DevGuardConfig {
  failOn?: Severity;
  env?: Record<string, EnvFieldConfig>;
  envFile?: string;
  scan?: {
    include?: string[];
    exclude?: string[];
    customPatterns?: Array<Omit<CustomPattern, 'pattern'> & { pattern: string }>;
    disableRules?: string[];
    baseline?: string[];
  };
  validate?: ValidateTarget[];
}

export const CONFIG_FILE = 'devguard.config.json';

export async function loadConfig(cwd: string, explicit?: string): Promise<{ config: DevGuardConfig; path?: string }> {
  const path = resolve(cwd, explicit ?? CONFIG_FILE);
  let text: string;
  try {
    text = await fs.readFile(path, 'utf8');
  } catch {
    if (explicit) throw new UsageError(`Config file not found: ${explicit}`);
    return { config: {} };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new UsageError(`Could not parse ${explicit ?? CONFIG_FILE}: ${(e as Error).message}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new UsageError(`${explicit ?? CONFIG_FILE} must contain a JSON object`);
  const cfg = parsed as DevGuardConfig;
  if (cfg.failOn !== undefined && !isSeverity(cfg.failOn))
    throw new UsageError(`"failOn" must be one of: info, low, medium, high, critical`);
  return { config: cfg, path };
}

export function buildEnvSchema(fields: Record<string, EnvFieldConfig>): EnvSchema {
  const schema: EnvSchema = {};
  for (const [key, f] of Object.entries(fields)) {
    const base = { optional: f.required === false, description: f.description } as const;
    let field: Field<any>;
    switch (f.type) {
      case 'string':
        field = env.string({
          ...base,
          default: f.default as string | undefined,
          minLength: f.minLength,
          maxLength: f.maxLength,
          pattern: f.pattern ? new RegExp(f.pattern) : undefined,
        });
        break;
      case 'number':
        field = env.number({ ...base, default: f.default as number | undefined, min: f.min, max: f.max, integer: f.integer });
        break;
      case 'port':
        field = env.port({ ...base, default: f.default as number | undefined });
        break;
      case 'boolean':
        field = env.boolean({ ...base, default: f.default as boolean | undefined });
        break;
      case 'url':
        field = env.url({ ...base, default: f.default as string | undefined, protocols: f.protocols });
        break;
      case 'email':
        field = env.email({ ...base, default: f.default as string | undefined });
        break;
      case 'enum':
        if (!f.values?.length) throw new UsageError(`env.${key}: "values" is required for type "enum"`);
        field = env.enum(f.values as readonly string[], { ...base, default: f.default as string | undefined });
        break;
      default:
        throw new UsageError(`env.${key}: unknown type "${String((f as { type: unknown }).type)}"`);
    }
    schema[key] = field;
  }
  return schema;
}

export async function loadEnvSource(cwd: string, envFile?: string): Promise<Record<string, string | undefined>> {
  const source: Record<string, string | undefined> = { ...process.env };
  if (envFile) {
    let text: string;
    try {
      text = await fs.readFile(resolve(cwd, envFile), 'utf8');
    } catch {
      throw new UsageError(`Env file not found: ${envFile}`);
    }
    // Real environment wins over the file, like most dotenv loaders.
    for (const [k, v] of Object.entries(parseDotenv(text))) {
      if (source[k] === undefined && typeof v === 'string') {
        source[k] = v;
      }
    }
  }
  return source;
}
