// Per-package build: ESM (+ optional CJS) via tsc, then mark module types.
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const tsc = require.resolve('typescript/bin/tsc');
const esmOnly = process.argv.includes('--esm-only');
rmSync('dist', { recursive: true, force: true });
execFileSync(process.execPath, [tsc, '-p', 'tsconfig.esm.json'], { stdio: 'inherit' });
writeFileSync('dist/esm/package.json', '{"type":"module"}\n');
if (!esmOnly) {
  execFileSync(process.execPath, [tsc, '-p', 'tsconfig.cjs.json'], { stdio: 'inherit' });
  mkdirSync('dist/cjs', { recursive: true });
  writeFileSync('dist/cjs/package.json', '{"type":"commonjs"}\n');
  // CJS consumers use the ESM-emitted .d.ts (identical shapes); copy for the "require" types condition.
  execFileSync(process.execPath, [
    '-e',
    "require('fs').cpSync('dist/esm','dist/cjs',{recursive:true,filter:(s)=>!s.endsWith('package.json')&&(require('fs').statSync(s).isDirectory()||s.endsWith('.d.ts')||s.endsWith('.d.ts.map'))})",
  ]);
}
if (existsSync('dist/esm/bin.js')) chmodSync('dist/esm/bin.js', 0o755);
