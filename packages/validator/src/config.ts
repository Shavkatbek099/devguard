import type { Issue } from '@devguard/core';
import { validateSchema, type Schema } from './schema.js';

export type YamlParser = (text: string) => unknown;

export interface ConsistencyRule {
  id: string;
  message: string;
  /** Return true when the config is consistent. */
  test: (data: any) => boolean;
  severity?: Issue['severity'];
}

export interface ValidateConfigOptions {
  schema?: Schema;
  rules?: ConsistencyRule[];
  file?: string;
}

const BAD_KEYS = new Set(['__proto__']);

export function parseJson(text: string, file?: string): { data?: unknown; issues: Issue[] } {
  try {
    const data: unknown = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
    return { data, issues: detectUnsafeKeys(data, file) };
  } catch (e) {
    return {
      issues: [{ rule: 'config/syntax', severity: 'high', source: 'config', message: `Invalid JSON: ${(e as Error).message}`, file }],
    };
  }
}

function detectUnsafeKeys(data: unknown, file?: string, depth = 0): Issue[] {
  if (depth > 64 || data === null || typeof data !== 'object') return [];
  const issues: Issue[] = [];
  for (const k of Object.keys(data)) {
    if (BAD_KEYS.has(k)) {
      issues.push({
        rule: 'config/unsafe-key',
        severity: 'medium',
        source: 'config',
        message: `Object key "${k}" can enable prototype pollution when merged unsafely`,
        file,
      });
    }
    issues.push(...detectUnsafeKeys((data as Record<string, unknown>)[k], file, depth + 1));
  }
  return issues;
}

/** Parse YAML using an adapter you supply (e.g. `yaml.parse`). YAML support is optional by design. */
export function parseYaml(text: string, adapter: YamlParser | undefined, file?: string): { data?: unknown; issues: Issue[] } {
  if (!adapter) {
    return {
      issues: [
        {
          rule: 'config/yaml-adapter-missing',
          severity: 'medium',
          source: 'config',
          message: 'YAML validation requires an adapter',
          file,
          remediation: 'Install the optional "yaml" package (npm i -D yaml) or pass a parser function',
        },
      ],
    };
  }
  try {
    return { data: adapter(text), issues: [] };
  } catch (e) {
    return {
      issues: [{ rule: 'config/syntax', severity: 'high', source: 'config', message: `Invalid YAML: ${(e as Error).message}`, file }],
    };
  }
}

/** Try to load a YAML parser from the optional `yaml` or `js-yaml` packages. */
export async function loadYamlAdapter(): Promise<YamlParser | undefined> {
  for (const name of ['yaml', 'js-yaml']) {
    try {
      const mod = (await import(/* @vite-ignore */ name)) as Record<string, any>;
      const fn = mod.parse ?? mod.load ?? mod.default?.parse ?? mod.default?.load;
      if (typeof fn === 'function') return (t: string) => fn(t) as unknown;
    } catch {
      /* not installed */
    }
  }
  return undefined;
}

export function validateConfig(data: unknown, opts: ValidateConfigOptions = {}): Issue[] {
  const issues: Issue[] = [];
  if (opts.schema) issues.push(...validateSchema(data, opts.schema, opts.file));
  for (const rule of opts.rules ?? []) {
    let pass = false;
    try {
      pass = rule.test(data);
    } catch {
      pass = false;
    }
    if (!pass) {
      issues.push({
        rule: `config/consistency/${rule.id}`,
        severity: rule.severity ?? 'high',
        source: 'config',
        message: rule.message,
        file: opts.file,
      });
    }
  }
  return issues;
}
