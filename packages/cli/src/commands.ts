import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { UsageError, type Issue } from '@shavkat2006/devguard-core';
import {
  loadYamlAdapter,
  parseJson,
  parseYaml,
  validateConfig,
  validateEnv,
  type ConsistencyRule,
  type Schema,
} from '@shavkat2006/devguard-validator';
import { scanDirectory } from '@shavkat2006/devguard-scanner';
import { CONFIG_FILE, buildEnvSchema, loadEnvSource, type DevGuardConfig } from './config.js';

export interface Ctx {
  cwd: string;
  config: DevGuardConfig;
  envFile?: string;
  paths: string[];
}

export async function runEnv(ctx: Ctx): Promise<Issue[]> {
  if (!ctx.config.env) return [];
  const schema = buildEnvSchema(ctx.config.env);
  const source = await loadEnvSource(ctx.cwd, ctx.envFile ?? ctx.config.envFile);
  return validateEnv(schema, source).issues;
}

export async function runConfigFiles(ctx: Ctx): Promise<Issue[]> {
  const issues: Issue[] = [];
  let yamlAdapter: Awaited<ReturnType<typeof loadYamlAdapter>>;
  for (const target of ctx.config.validate ?? []) {
    const abs = resolve(ctx.cwd, target.file);
    if (!abs.startsWith(resolve(ctx.cwd))) throw new UsageError(`validate.file must be inside the project: ${target.file}`);
    let text: string;
    try {
      text = await fs.readFile(abs, 'utf8');
    } catch {
      issues.push({ rule: 'config/not-found', severity: 'high', source: 'config', message: 'File not found', file: target.file });
      continue;
    }
    const ext = extname(abs).toLowerCase();
    let parsed;
    if (ext === '.yaml' || ext === '.yml') {
      yamlAdapter ??= await loadYamlAdapter();
      parsed = parseYaml(text, yamlAdapter, target.file);
    } else parsed = parseJson(text, target.file);
    issues.push(...parsed.issues);
    if (parsed.data === undefined) continue;

    let schema: Schema | undefined;
    if (typeof target.schema === 'string') {
      try {
        schema = JSON.parse(await fs.readFile(resolve(ctx.cwd, target.schema), 'utf8')) as Schema;
      } catch (e) {
        throw new UsageError(`Could not load schema "${target.schema}": ${(e as Error).message}`);
      }
    } else schema = target.schema;

    const rules: ConsistencyRule[] = (target.requireTogether ?? []).map((group, i) => ({
      id: `require-together-${i + 1}`,
      message: `Properties must be set together: ${group.join(', ')}`,
      test: (d) => {
        const present = group.map((p) => getPath(d, p) !== undefined);
        return present.every(Boolean) || present.every((x) => !x);
      },
    }));
    issues.push(...validateConfig(parsed.data, { schema, rules, file: target.file }));
  }
  return issues;
}

function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (cur === null || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, part)) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export async function runScan(ctx: Ctx): Promise<{ issues: Issue[]; filesScanned: number }> {
  const s = ctx.config.scan ?? {};
  try {
    const r = await scanDirectory({
      cwd: ctx.cwd,
      include: ctx.paths.length ? ctx.paths : s.include,
      exclude: s.exclude,
      customPatterns: s.customPatterns,
      disableRules: s.disableRules,
      baseline: s.baseline,
    });
    return { issues: r.issues, filesScanned: r.filesScanned };
  } catch (e) {
    throw new UsageError((e as Error).message);
  }
}

export async function runDoctor(ctx: Ctx): Promise<Issue[]> {
  const issues: Issue[] = [];
  const add = (rule: string, severity: Issue['severity'], message: string, remediation?: string, file?: string) =>
    issues.push({ rule: `doctor/${rule}`, severity, source: 'doctor', message, remediation, file });

  const major = Number(process.versions.node.split('.')[0]);
  if (major < 18) add('node-version', 'high', `Node.js ${process.versions.node} is unsupported`, 'Use Node.js 18.17 or newer');
  else if (major < 20)
    add('node-version', 'info', `Node.js ${process.versions.node} is nearing end of life`, 'Consider upgrading to an active LTS release');

  try {
    await fs.access(resolve(ctx.cwd, CONFIG_FILE));
  } catch {
    add('no-config', 'low', `No ${CONFIG_FILE} found`, 'Run "devguard init" to create one');
  }

  let inGit = true;
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: ctx.cwd, stdio: 'ignore' });
  } catch {
    inGit = false;
    add('not-a-git-repo', 'info', 'Not inside a git repository (or git is not installed)');
  }
  if (inGit) {
    for (const f of ['.env', '.env.local']) {
      let exists = true;
      try {
        await fs.access(resolve(ctx.cwd, f));
      } catch {
        exists = false;
      }
      if (!exists) continue;
      try {
        const tracked = execFileSync('git', ['ls-files', '--', f], { cwd: ctx.cwd, encoding: 'utf8' }).trim();
        if (tracked)
          add(
            'env-tracked',
            'critical',
            `${f} is tracked by git`,
            `Run "git rm --cached ${f}", add it to .gitignore, and rotate any secrets it contained`,
            f,
          );
        else {
          const ignored = (() => {
            try {
              execFileSync('git', ['check-ignore', '-q', '--', f], { cwd: ctx.cwd });
              return true;
            } catch {
              return false;
            }
          })();
          if (!ignored) add('env-not-ignored', 'high', `${f} exists but is not in .gitignore`, `Add ${f} to .gitignore`, f);
        }
      } catch {
        /* ignore */
      }
    }
  }
  if ((ctx.config.validate ?? []).some((t) => /\.ya?ml$/i.test(t.file)) && !(await loadYamlAdapter())) {
    add('yaml-adapter', 'medium', 'YAML files are configured but no YAML adapter is installed', 'npm i -D yaml');
  }
  return issues;
}

export const INIT_CONFIG: DevGuardConfig & { $schema?: string } = {
  failOn: 'high',
  env: {
    NODE_ENV: { type: 'enum', values: ['development', 'test', 'production'], default: 'development' },
    PORT: { type: 'port', default: 3000 },
    DATABASE_URL: { type: 'url', protocols: ['postgres', 'postgresql'], required: false, description: 'example: remove or adjust' },
  },
  scan: { include: ['.'], exclude: ['**/*.snap'], customPatterns: [] },
  validate: [],
};

export const INIT_WORKFLOW = `name: DevGuard
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  devguard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npx --yes devguard@latest check --format github
`;

export async function runInit(cwd: string, opts: { force: boolean; workflow: boolean }): Promise<string[]> {
  const written: string[] = [];
  const target = resolve(cwd, CONFIG_FILE);
  const write = async (path: string, content: string) => {
    try {
      await fs.mkdir(dirname(path), { recursive: true });
      await fs.writeFile(path, content, { flag: opts.force ? 'w' : 'wx' });
      written.push(path.slice(resolve(cwd).length + 1).replace(/\\/g, '/'));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EEXIST')
        throw new UsageError(`${path.slice(resolve(cwd).length + 1)} already exists (use --force to overwrite)`);
      throw e;
    }
  };
  await write(target, JSON.stringify(INIT_CONFIG, null, 2) + '\n');
  if (opts.workflow) await write(resolve(cwd, '.github/workflows/devguard.yml'), INIT_WORKFLOW);
  return written;
}
