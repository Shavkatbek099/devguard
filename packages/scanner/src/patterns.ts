import type { Severity } from '@shavkat2006/devguard-core';

export interface SecretPattern {
  id: string;
  description: string;
  pattern: RegExp;
  severity: Severity;
  /** Capture group holding the secret (0 = whole match). */
  group?: number;
  /** Minimum Shannon entropy (bits/char) of the captured value, to reduce false positives. */
  minEntropy?: number;
}

export const DEFAULT_PATTERNS: SecretPattern[] = [
  {
    id: 'aws-access-key-id',
    description: 'AWS access key ID',
    pattern: /\b(?:AKIA|ASIA|AGPA|AIDA|AROA)[0-9A-Z]{16}\b/g,
    severity: 'critical',
  },
  {
    id: 'github-token',
    description: 'GitHub token',
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/g,
    severity: 'critical',
  },
  { id: 'slack-token', description: 'Slack token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, severity: 'high' },
  { id: 'stripe-live-key', description: 'Stripe live secret key', pattern: /\b[sr]k_live_[A-Za-z0-9]{16,}\b/g, severity: 'critical' },
  { id: 'google-api-key', description: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g, severity: 'high' },
  { id: 'npm-token', description: 'npm access token', pattern: /\bnpm_[A-Za-z0-9]{36}\b/g, severity: 'critical' },
  {
    id: 'private-key',
    description: 'Private key block',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/g,
    severity: 'critical',
  },
  {
    id: 'jwt',
    description: 'JSON Web Token',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    severity: 'medium',
  },
  {
    id: 'generic-secret-assignment',
    description: 'Hard-coded credential assignment',
    pattern:
      /(?:secret|passw(?:or)?d|passwd|api[_-]?key|auth[_-]?token|access[_-]?token|private[_-]?key)\w*["']?\s*[:=]\s*["']([^"'\s]{12,})["']/gi,
    group: 1,
    severity: 'medium',
    minEntropy: 3.2,
  },
];

const PLACEHOLDER =
  /(?:example|sample|changeme|change[_-]?me|placeholder|your[_-]|<[^>]+>|\$\{|\{\{|process\.env|xxxx|\*{4,}|redacted|dummy|fake|test[_-]?(?:key|secret|token))/i;

export function looksLikePlaceholder(value: string): boolean {
  return PLACEHOLDER.test(value) || /^(.)\1+$/.test(value);
}

export function shannonEntropy(s: string): number {
  if (!s) return 0;
  const freq = new Map<string, number>();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of freq.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

export const REMEDIATION =
  'Revoke/rotate this credential now, remove it from the code and git history, and load it from an environment variable or secret manager instead.';
