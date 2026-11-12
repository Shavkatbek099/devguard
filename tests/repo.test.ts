import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const root = resolve(__dirname, '..');

describe('repository files', () => {
  const ymls = [
    ...readdirSync(join(root, '.github/workflows')).map((f) => `.github/workflows/${f}`),
    ...readdirSync(join(root, '.github/ISSUE_TEMPLATE')).map((f) => `.github/ISSUE_TEMPLATE/${f}`),
    '.github/dependabot.yml',
    '.github/labels.yml',
    'packages/github-action/action.yml',
  ];
  it.each(ymls)('%s is valid YAML', (f) => {
    expect(() => parse(readFileSync(join(root, f), 'utf8'))).not.toThrow();
  });

  it('workflows follow least-privilege and avoid script injection', () => {
    for (const f of readdirSync(join(root, '.github/workflows'))) {
      const text = readFileSync(join(root, '.github/workflows', f), 'utf8');
      expect(parse(text).permissions, `${f} must declare permissions`).toBeDefined();
      // untrusted contexts must never be interpolated directly into `run:` scripts
      expect(text).not.toMatch(/run:.*\$\{\{\s*(github\.event\.(issue|pull_request|comment|head_commit)|inputs\.)/);
    }
  });

  it('every package has consistent versions and required fields', () => {
    for (const p of ['core', 'validator', 'scanner', 'cli']) {
      const pkg = JSON.parse(readFileSync(join(root, 'packages', p, 'package.json'), 'utf8'));
      expect(pkg.version).toBe('0.1.0');
      expect(pkg.license).toBe('MIT');
      expect(pkg.publishConfig).toMatchObject({ access: 'public', provenance: true });
      expect(pkg.files).toContain('dist');
    }
  });

  it('community files exist', () => {
    for (const f of [
      'README.md',
      'LICENSE',
      'CONTRIBUTING.md',
      'CODE_OF_CONDUCT.md',
      'SECURITY.md',
      'ROADMAP.md',
      '.github/PULL_REQUEST_TEMPLATE.md',
    ]) {
      expect(existsSync(join(root, f)), f).toBe(true);
    }
  });
});

import { spawnSync } from 'node:child_process';
describe('examples', () => {
  const built = existsSync(join(root, 'packages/validator/dist/cjs/index.js'));
  it.skipIf(!built)('basic example runs with defaults and with overrides', () => {
    const run = (env: Record<string, string>) =>
      spawnSync(process.execPath, ['examples/basic/index.js'], {
        cwd: root,
        encoding: 'utf8',
        env: { PATH: process.env.PATH ?? '', ...env },
      });
    expect(run({}).stdout.trim()).toBe('hello on port 3000');
    expect(run({ PORT: '8080', GREETING: 'hi' }).stdout.trim()).toBe('hi on port 8080');
    const bad = run({ PORT: 'nope' });
    expect(bad.status).not.toBe(0);
    expect(bad.stderr).toContain('PORT must be');
  });
});
