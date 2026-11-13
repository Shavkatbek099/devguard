import type { Issue, Severity } from '@shavkat2006/devguard-core';
import { REMEDIATION, looksLikePlaceholder, shannonEntropy, type SecretPattern } from './patterns.js';
import { sha256Hex } from './sha256.js';

/** Browser-safe building blocks (no Node built-ins). */
export interface CustomPattern {
  id: string;
  description?: string;
  /** Regex source (string) or RegExp. Use a capture group + `group` to target the secret. */
  pattern: string | RegExp;
  severity?: Severity;
  group?: number;
}

const MAX_LINE = 5000;

export function compileCustomPattern(c: CustomPattern): SecretPattern {
  const src = typeof c.pattern === 'string' ? c.pattern : c.pattern.source;
  const flags = typeof c.pattern === 'string' ? '' : c.pattern.flags;
  let re: RegExp;
  try {
    re = new RegExp(src, flags.includes('g') ? flags : flags + 'g');
  } catch (e) {
    throw new Error(`Invalid custom pattern "${c.id}": ${(e as Error).message}`);
  }
  return { id: `custom/${c.id}`, description: c.description ?? c.id, pattern: re, severity: c.severity ?? 'high', group: c.group };
}

export function scanText(text: string, file: string, patterns: SecretPattern[]): Issue[] {
  const issues: Issue[] = [];
  const lines = text.split(/\r?\n/);
  let ignoreNext = false;
  lines.forEach((line, idx) => {
    const skip = ignoreNext;
    ignoreNext = line.includes('devguard-ignore-next-line');
    if (skip || (line.includes('devguard-ignore') && !line.includes('devguard-ignore-next-line')) || line.length > MAX_LINE) return;
    for (const p of patterns) {
      const re = new RegExp(p.pattern.source, p.pattern.flags.includes('g') ? p.pattern.flags : p.pattern.flags + 'g');
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) {
        if (m[0].length === 0) {
          re.lastIndex++;
          continue;
        }
        const value = m[p.group ?? 0] ?? m[0];
        if (p.minEntropy !== undefined && shannonEntropy(value) < p.minEntropy) continue;
        if (p.group !== undefined && looksLikePlaceholder(value)) continue;
        const fingerprint = sha256Hex(`${p.id}:${value}`).slice(0, 12);
        issues.push({
          rule: `secret/${p.id}`,
          severity: p.severity,
          source: 'scan',
          // Deliberately does NOT include the value.
          message: `Possible ${p.description} detected`,
          file,
          line: idx + 1,
          column: m.index + 1,
          endColumn: m.index + 1 + m[0].length,
          fingerprint,
          remediation: REMEDIATION,
        });
      }
    }
  });
  return issues;
}
