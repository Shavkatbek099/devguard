// Plain-Node smoke test of the BUILT packages (no dev tooling). Runs on Node 18/20 in CI.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const esm = (p) => import(new URL(`../packages/${p}/dist/esm/index.js`, import.meta.url).href);

const cjs = require(join(root, 'packages/validator/dist/cjs/index.js'));
assert.deepEqual(cjs.createEnv({ PORT: cjs.env.port({ default: 3000 }) }, {}), { PORT: 3000 });
const { env, validateEnv } = await esm('validator');
assert.equal(validateEnv({ A: env.number() }, { A: 'x' }).ok, false);
const { scanText, DEFAULT_PATTERNS } = await esm('scanner');
const fake = 'AK' + 'IA' + 'ABCDEFGHIJKLMNOP';
const found = scanText(`k="${fake}"`, 'f.js', DEFAULT_PATTERNS);
assert.equal(found.length, 1);
assert.ok(!JSON.stringify(found).includes(fake), 'secret value must never appear in findings');

const dir = mkdtempSync(join(tmpdir(), 'dg-smoke-'));
try {
  writeFileSync(join(dir, 'a.js'), `k="${fake}"\n`);
  const r = spawnSync(process.execPath, [join(root, 'packages/cli/dist/esm/bin.js'), 'scan', '--json'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stdout).summary.total, 1);
  assert.ok(!r.stdout.includes(fake));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`smoke OK on Node ${process.versions.node}`);
