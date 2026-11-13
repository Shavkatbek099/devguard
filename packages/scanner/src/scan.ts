import { promises as fs } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import type { Issue } from '@shavkat2006/devguard-core';
import { globToRegExp, matchesAny } from './glob.js';
import { DEFAULT_PATTERNS } from './patterns.js';
import { compileCustomPattern, scanText, type CustomPattern } from './text.js';
export type { CustomPattern };

export const DEFAULT_EXCLUDES = [
  'node_modules/',
  '.git/',
  'dist/',
  'build/',
  'out/',
  'coverage/',
  '.next/',
  '.nuxt/',
  '.turbo/',
  '.cache/',
  '.venv/',
  'vendor/',
  '*.min.js',
  '*.map',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
];

export interface ScanOptions {
  /** Directories or files to scan, relative to `cwd`. Default: ['.']. */
  include?: string[];
  /** Extra glob excludes (added to the defaults). */
  exclude?: string[];
  /** Set false to drop the built-in excludes (node_modules, dist, ...). */
  defaultExcludes?: boolean;
  customPatterns?: CustomPattern[];
  /** Disable some built-in rule ids. */
  disableRules?: string[];
  /** Fingerprints (from earlier reports) to treat as accepted. */
  baseline?: string[];
  cwd?: string;
  maxFileSize?: number;
}

export interface ScanResult {
  issues: Issue[];
  filesScanned: number;
  filesSkipped: number;
}

function toPosix(p: string): string {
  return sep === '/' ? p : p.split(sep).join('/');
}

async function* walk(root: string, base: string, excludes: RegExp[]): AsyncGenerator<{ abs: string; rel: string }> {
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const abs = join(root, e.name);
    const rel = toPosix(relative(base, abs));
    if (matchesAny(rel, excludes)) continue;
    if (e.isSymbolicLink()) continue; // never follow symlinks (avoids loops and escaping the project)
    if (e.isDirectory()) yield* walk(abs, base, excludes);
    else if (e.isFile()) yield { abs, rel };
  }
}

function isBinary(buf: Buffer): boolean {
  return buf.subarray(0, 8000).includes(0);
}

export async function scanDirectory(opts: ScanOptions = {}): Promise<ScanResult> {
  const cwd = resolve(opts.cwd ?? process.cwd());
  const maxSize = opts.maxFileSize ?? 1_000_000;
  const excludes = [...(opts.defaultExcludes === false ? [] : DEFAULT_EXCLUDES), ...(opts.exclude ?? [])].map(globToRegExp);
  const disabled = new Set(opts.disableRules ?? []);
  const patterns = [...DEFAULT_PATTERNS.filter((p) => !disabled.has(p.id)), ...(opts.customPatterns ?? []).map(compileCustomPattern)];
  const baseline = new Set(opts.baseline ?? []);

  const issues: Issue[] = [];
  let filesScanned = 0;
  let filesSkipped = 0;

  for (const inc of opts.include?.length ? opts.include : ['.']) {
    const start = resolve(cwd, inc);
    const relStart = relative(cwd, start);
    if (relStart.startsWith('..') || resolve(relStart) === relStart) {
      throw new Error(`Refusing to scan path outside the project directory: ${inc}`);
    }
    let st;
    try {
      st = await fs.lstat(start);
    } catch {
      throw new Error(`Path not found: ${inc}`);
    }
    const files = st.isFile() ? [{ abs: start, rel: toPosix(relStart) }] : walk(start, cwd, excludes);
    for await (const f of files as AsyncIterable<{ abs: string; rel: string }> | Iterable<{ abs: string; rel: string }>) {
      try {
        const fst = await fs.stat(f.abs);
        if (fst.size > maxSize) {
          filesSkipped++;
          continue;
        }
        const buf = await fs.readFile(f.abs);
        if (isBinary(buf)) {
          filesSkipped++;
          continue;
        }
        filesScanned++;
        for (const issue of scanText(buf.toString('utf8'), f.rel, patterns)) {
          if (!issue.fingerprint || !baseline.has(issue.fingerprint)) issues.push(issue);
        }
      } catch {
        filesSkipped++;
      }
    }
  }
  return { issues, filesScanned, filesSkipped };
}
