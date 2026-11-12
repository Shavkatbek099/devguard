export const SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];
export type IssueSource = 'env' | 'config' | 'scan' | 'doctor';

/** A single finding. Never contains raw secret values. */
export interface Issue {
  rule: string;
  severity: Severity;
  source: IssueSource;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  /** Exclusive end column on the same line (when known). */
  endColumn?: number;
  /** Stable, non-reversible identifier useful for baselines. */
  fingerprint?: string;
  remediation?: string;
}

export interface Report {
  tool: 'devguard';
  version: string;
  generatedAt: string;
  ok: boolean;
  failOn: Severity;
  summary: { total: number; bySeverity: Record<Severity, number> };
  issues: Issue[];
}

export type OutputFormat = 'text' | 'json' | 'github';
