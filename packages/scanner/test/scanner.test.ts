import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { globToRegExp, scanDirectory, scanText, DEFAULT_PATTERNS, compileCustomPattern } from '../src/index.js';

// Fake credentials are assembled at runtime so no realistic secret literal lives in the repo.
const AWS = 'AK' + 'IA' + 'ABCDEFGHIJKLMNOP';
const GH = 'gh' + 'p_' + 'aB3dE6gH9jK2mN5pQ8sT1vW4yZ7bC0eF3hJ6';
const STRIPE = 'sk' + '_live_' + 'abcdEFGH1234ijklMNOP5678';
const PEM = '-----BEGIN ' + 'RSA PRIVATE KEY-----';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'devguard-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));
const put = (rel: string, content: string | Buffer) => {
  const p = join(dir, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, content);
};

describe('scanText', () => {
  it.each([
    ['aws-access-key-id', `const k = "${AWS}";`],
    ['github-token', `token: ${GH}`],
    ['stripe-live-key', `key=${STRIPE}`],
    ['private-key', PEM],
    ['jwt', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop'],
    ['generic-secret-assignment', 'const password = "Zx9!qL2mVb7#Rt4w";'],
  ])('detects %s', (id, line) => {
    const issues = scanText(line, 'f.ts', DEFAULT_PATTERNS);
    expect(issues.map((i) => i.rule)).toContain(`secret/${id}`);
  });

  it('never includes the secret value in the issue', () => {
    const issues = scanText(`a = "${AWS}"\nb = ${GH}`, 'f.ts', DEFAULT_PATTERNS);
    const out = JSON.stringify(issues);
    expect(out).not.toContain(AWS);
    expect(out).not.toContain(GH);
    expect(issues.every((i) => /^[0-9a-f]{12}$/.test(i.fingerprint!))).toBe(true);
  });

  it('reports line and column', () => {
    const [i] = scanText(`\n\n   x = ${AWS}`, 'f.ts', DEFAULT_PATTERNS);
    expect(i).toMatchObject({ line: 3, column: 8 });
  });

  describe('false positives', () => {
    it.each([
      'password = "changeme-changeme"',
      'const apiKey = "your_api_key_here_please"',
      'secret: "${SECRET_FROM_ENV_VAR}"',
      'const token = "aaaaaaaaaaaaaaaaaaaa"',
      'password: process.env.DB_PASSWORD',
      'api_key = "<insert-your-api-key>"',
      'const key = "AKIA_EXAMPLE"',
      'password = "short"',
    ])('ignores %s', (line) => {
      expect(scanText(line, 'f.ts', DEFAULT_PATTERNS)).toEqual([]);
    });
  });

  it('honours inline ignore comments', () => {
    expect(scanText(`x = "${AWS}" // devguard-ignore`, 'f', DEFAULT_PATTERNS)).toEqual([]);
    expect(scanText(`// devguard-ignore-next-line\nx = "${AWS}"\ny = "${AWS}"`, 'f', DEFAULT_PATTERNS)).toHaveLength(1);
  });

  it('skips absurdly long lines (minified bundles) and does not hang', () => {
    const t0 = Date.now();
    scanText('a'.repeat(200_000) + AWS, 'f', DEFAULT_PATTERNS);
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  it('supports custom patterns with groups', () => {
    const p = compileCustomPattern({ id: 'internal', pattern: 'ACME-([0-9]{8})', severity: 'high' });
    const i = scanText('id ACME-12345678', 'f', [p]);
    expect(i[0]).toMatchObject({ rule: 'secret/custom/internal', severity: 'high' });
    expect(() => compileCustomPattern({ id: 'bad', pattern: '(' })).toThrow(/Invalid custom pattern/);
  });
});

describe('scanDirectory', () => {
  it('scans files and excludes defaults (node_modules, dist, .git)', async () => {
    put('src/a.ts', `const k = "${AWS}"`);
    put('node_modules/pkg/index.js', `const k = "${AWS}"`);
    put('dist/bundle.js', `const k = "${AWS}"`);
    put('.git/config', `k=${AWS}`);
    put('build/out.js', `k=${AWS}`);
    const r = await scanDirectory({ cwd: dir });
    expect(r.issues.map((i) => i.file)).toEqual(['src/a.ts']);
    expect(r.filesScanned).toBe(1);
  });

  it('honours configured excludes and include paths', async () => {
    put('src/a.ts', `k=${AWS}`);
    put('fixtures/b.ts', `k=${AWS}`);
    put('docs/c.md', `k=${AWS}`);
    expect((await scanDirectory({ cwd: dir, exclude: ['fixtures/'] })).issues.map((i) => i.file).sort()).toEqual(['docs/c.md', 'src/a.ts']);
    expect((await scanDirectory({ cwd: dir, include: ['src'] })).issues.map((i) => i.file)).toEqual(['src/a.ts']);
    expect((await scanDirectory({ cwd: dir, exclude: ['**/*.md'] })).issues.map((i) => i.file)).not.toContain('docs/c.md');
  });

  it('skips binary and oversized files', async () => {
    put('bin.dat', Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(AWS)]));
    put('big.txt', 'x'.repeat(2000) + AWS);
    const r = await scanDirectory({ cwd: dir, maxFileSize: 1000 });
    expect(r.issues).toEqual([]);
    expect(r.filesSkipped).toBe(2);
  });

  it('does not follow symlinks', async () => {
    put('real/a.ts', `k=${AWS}`);
    try {
      symlinkSync(join(dir, 'real'), join(dir, 'link'), 'dir');
    } catch {
      return; // symlinks unsupported (e.g. Windows without privileges)
    }
    const r = await scanDirectory({ cwd: dir });
    expect(r.issues.map((i) => i.file)).toEqual(['real/a.ts']);
  });

  it('refuses paths outside the project and reports missing paths', async () => {
    await expect(scanDirectory({ cwd: dir, include: ['..'] })).rejects.toThrow(/outside/);
    await expect(scanDirectory({ cwd: dir, include: ['nope'] })).rejects.toThrow(/not found/);
  });

  it('supports baselines by fingerprint and disabling rules', async () => {
    put('a.ts', `k=${AWS}`);
    const first = await scanDirectory({ cwd: dir });
    const fp = first.issues[0]!.fingerprint!;
    expect((await scanDirectory({ cwd: dir, baseline: [fp] })).issues).toEqual([]);
    expect((await scanDirectory({ cwd: dir, disableRules: ['aws-access-key-id'] })).issues).toEqual([]);
  });

  it('handles CRLF files and uses POSIX paths', async () => {
    put('a/b/c.ts', `x\r\ny = ${AWS}\r\n`);
    const r = await scanDirectory({ cwd: dir });
    expect(r.issues[0]).toMatchObject({ file: 'a/b/c.ts', line: 2 });
  });
});

describe('globToRegExp', () => {
  it.each([
    ['node_modules/', 'a/node_modules/x/y.js', true],
    ['*.min.js', 'a/b/app.min.js', true],
    ['**/*.snap', '__tests__/a/x.snap', true],
    ['src/*.ts', 'src/a.ts', true],
    ['src/*.ts', 'src/deep/a.ts', false],
    ['docs/**', 'docs/a/b.md', true],
    ['*.js', 'a.jsx', false],
  ])('%s vs %s', (g, p, expected) => {
    expect(globToRegExp(g).test(p)).toBe(expected);
  });
});

import { createHash } from 'node:crypto';
import { sha256Hex } from '../src/index.js';
describe('sha256Hex (browser-safe implementation)', () => {
  it('matches node:crypto for many inputs, incl. block boundaries and unicode', () => {
    const inputs = [
      '',
      'abc',
      'a'.repeat(55),
      'a'.repeat(56),
      'a'.repeat(63),
      'a'.repeat(64),
      'a'.repeat(65),
      'a'.repeat(1000),
      'héllo wörld ✓ 日本語',
      '\u0000\u0001',
    ];
    for (let i = 0; i < 200; i++)
      inputs.push(
        Math.random()
          .toString(36)
          .repeat(1 + (i % 20)),
      );
    for (const s of inputs) expect(sha256Hex(s)).toBe(createHash('sha256').update(s).digest('hex'));
  });
  it('scanText reports endColumn spanning the match', () => {
    const [i] = scanText(`x = ${AWS};`, 'f', DEFAULT_PATTERNS);
    expect(i!.endColumn! - i!.column!).toBe(AWS.length);
  });
});
