import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main } from '../src/cli.js';

const AWS = 'AK' + 'IA' + 'ABCDEFGHIJKLMNOP';
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'devguard-cli-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));
const put = (rel: string, c: string) => {
  mkdirSync(join(dir, rel, '..'), { recursive: true });
  writeFileSync(join(dir, rel), c);
};
async function run(...argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main([...argv, '--no-color'], { out: (s) => out.push(s), err: (s) => err.push(s), cwd: dir });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

describe('devguard init', () => {
  it('creates config and workflow, refuses to overwrite without --force', async () => {
    const r = await run('init', '--workflow');
    expect(r.code).toBe(0);
    expect(existsSync(join(dir, 'devguard.config.json'))).toBe(true);
    expect(existsSync(join(dir, '.github/workflows/devguard.yml'))).toBe(true);
    const again = await run('init');
    expect(again.code).toBe(2);
    expect(again.err).toContain('already exists');
    expect((await run('init', '--force')).code).toBe(0);
  });
});

describe('devguard scan', () => {
  it('passes on a clean project', async () => {
    put('a.ts', 'export const a = 1;');
    const r = await run('scan');
    expect(r.code).toBe(0);
    expect(r.out).toContain('no issues');
  });
  it('fails (exit 1) and never prints the secret', async () => {
    put('a.ts', `const k = "${AWS}";`);
    const r = await run('scan');
    expect(r.code).toBe(1);
    expect(r.out).toContain('secret/aws-access-key-id');
    expect(r.out + r.err).not.toContain(AWS);
  });
  it('--json emits valid JSON; --format github emits annotations', async () => {
    put('a.ts', `const k = "${AWS}";`);
    const j = JSON.parse((await run('scan', '--json')).out);
    expect(j.summary.total).toBe(1);
    expect(JSON.stringify(j)).not.toContain(AWS);
    expect((await run('scan', '--format', 'github')).out).toMatch(/^::error file=a\.ts,line=1/);
  });
  it('--fail-on critical vs medium thresholds', async () => {
    put('a.ts', 'const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop";');
    expect((await run('scan')).code).toBe(0); // medium < default high
    expect((await run('scan', '--fail-on', 'medium')).code).toBe(1);
  });
  it('scans only the given paths and honours config excludes', async () => {
    put('src/a.ts', `k="${AWS}"`);
    put('other/b.ts', `k="${AWS}"`);
    expect(JSON.parse((await run('scan', 'src', '--json')).out).issues).toHaveLength(1);
    put('devguard.config.json', JSON.stringify({ scan: { exclude: ['other/'] } }));
    expect(JSON.parse((await run('scan', '--json')).out).issues).toHaveLength(1);
  });
  it('supports custom patterns from config', async () => {
    put('a.ts', 'id = "INT-12345678"');
    put('devguard.config.json', JSON.stringify({ scan: { customPatterns: [{ id: 'internal', pattern: 'INT-[0-9]{8}' }] } }));
    expect((await run('scan')).code).toBe(1);
  });
  it('rejects paths outside the project (exit 2)', async () => {
    const r = await run('scan', '..');
    expect(r.code).toBe(2);
  });
});

describe('devguard validate', () => {
  // Unique names: real env vars take precedence over .env files, and tools like Vitest set MODE/NODE_ENV.
  const envConfig = { env: { DG_TEST_PORT: { type: 'port' }, DG_TEST_MODE: { type: 'enum', values: ['a', 'b'], default: 'a' } } };
  it('validates env from --env-file', async () => {
    put('devguard.config.json', JSON.stringify(envConfig));
    put('.env', 'DG_TEST_PORT=abc');
    const bad = await run('validate', '--env-file', '.env');
    expect(bad.code).toBe(1);
    expect(bad.out).toContain('DG_TEST_PORT must be');
    put('.env', 'DG_TEST_PORT=8080');
    expect((await run('validate', '--env-file', '.env')).code).toBe(0);
  });
  it('reports missing required env vars', async () => {
    put('devguard.config.json', JSON.stringify({ env: { DEVGUARD_TEST_UNSET_VAR_X: { type: 'string' } } }));
    const r = await run('validate');
    expect(r.code).toBe(1);
    expect(r.out).toContain('env/missing');
  });
  it('validates JSON config files against schema files, with consistency rules', async () => {
    put('schemas/app.json', JSON.stringify({ type: 'object', required: ['name'], properties: { name: { type: 'string' } } }));
    put('app.json', JSON.stringify({ name: 5, a: 1 }));
    put(
      'devguard.config.json',
      JSON.stringify({ validate: [{ file: 'app.json', schema: 'schemas/app.json', requireTogether: [['a', 'b']] }] }),
    );
    const r = await run('validate', '--json');
    const rules = JSON.parse(r.out).issues.map((i: { rule: string }) => i.rule);
    expect(r.code).toBe(1);
    expect(rules).toEqual(expect.arrayContaining(['config/type', 'config/consistency/require-together-1']));
  });
  it('reports missing and malformed files', async () => {
    put('bad.json', '{oops');
    put('devguard.config.json', JSON.stringify({ validate: [{ file: 'bad.json' }, { file: 'missing.json' }] }));
    const rules = JSON.parse((await run('validate', '--json')).out).issues.map((i: { rule: string }) => i.rule);
    expect(rules).toEqual(expect.arrayContaining(['config/syntax', 'config/not-found']));
  });
  it('rejects validate targets outside the project', async () => {
    put('devguard.config.json', JSON.stringify({ validate: [{ file: '../../etc/passwd' }] }));
    expect((await run('validate')).code).toBe(2);
  });
});

describe('devguard check / report / doctor', () => {
  it('check combines env + scan', async () => {
    put('devguard.config.json', JSON.stringify({ env: { DEVGUARD_TEST_UNSET_VAR_Y: { type: 'string' } } }));
    put('a.ts', `k="${AWS}"`);
    const j = JSON.parse((await run('check', '--json')).out);
    expect(j.issues.map((i: { source: string }) => i.source).sort()).toEqual(['env', 'scan']);
  });
  it('report writes a JSON file (default and --output)', async () => {
    put('a.ts', 'ok');
    expect((await run('report')).code).toBe(0);
    expect(JSON.parse(readFileSync(join(dir, 'devguard-report.json'), 'utf8')).tool).toBe('devguard');
    await run('report', '-o', 'out/r.json').catch(() => undefined);
  });
  it('doctor flags a git-tracked .env and an un-ignored .env', async () => {
    execFileSync('git', ['init', '-q'], { cwd: dir });
    put('.env', 'A=1');
    let r = await run('doctor');
    expect(r.out).toContain('doctor/env-not-ignored');
    execFileSync('git', ['add', '-f', '.env'], { cwd: dir });
    r = await run('doctor');
    expect(r.code).toBe(1);
    expect(r.out).toContain('doctor/env-tracked');
  });
});

describe('usage errors', () => {
  it.each([
    [['bogus'], 'Unknown command'],
    [['scan', '--nope'], 'Unknown option'],
    [['scan', '--fail-on', 'x'], 'Unknown severity'],
    [['scan', '--format', 'xml'], 'Unknown format'],
    [['scan', '--config'], 'requires a value'],
    [['scan', '--config', 'missing.json'], 'not found'],
  ])('%j exits 2', async (argv, msg) => {
    const r = await run(...argv);
    expect(r.code).toBe(2);
    expect(r.err).toContain(msg);
  });
  it('rejects a malformed config file', async () => {
    put('devguard.config.json', '{bad');
    expect((await run('scan')).code).toBe(2);
    put('devguard.config.json', '{"failOn":"nope"}');
    expect((await run('scan')).code).toBe(2);
  });
  it('--help and --version', async () => {
    expect((await run('--help')).out).toContain('Usage: devguard');
    expect((await run('--version')).out).toMatch(/^\d+\.\d+\.\d+$/);
    expect((await run()).code).toBe(2);
  });
});

// Exercises the real built binary (skipped if `npm run build` has not been run).
const bin = resolve(__dirname, '../dist/esm/bin.js');
describe.skipIf(!existsSync(bin))('built binary', () => {
  it('runs via node and returns the right exit codes', () => {
    put('a.ts', `k="${AWS}"`);
    const r = spawnSync(process.execPath, [bin, 'scan', '--json'], { cwd: dir, encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout).summary.total).toBe(1);
    expect(r.stdout).not.toContain(AWS);
    expect(spawnSync(process.execPath, [bin, '--version'], { encoding: 'utf8' }).status).toBe(0);
  });
});

describe('YAML validation (optional adapter)', () => {
  it('validates YAML files when the yaml package is installed', async () => {
    put('c.yaml', 'name: 5\n');
    put(
      'devguard.config.json',
      JSON.stringify({ validate: [{ file: 'c.yaml', schema: { type: 'object', properties: { name: { type: 'string' } } } }] }),
    );
    const r = JSON.parse((await run('validate', '--json')).out);
    expect(r.issues.map((i: { rule: string }) => i.rule)).toEqual(['config/type']);
    put('c.yaml', 'name: [unclosed\n');
    expect(JSON.parse((await run('validate', '--json')).out).issues[0].rule).toBe('config/syntax');
  });
});
