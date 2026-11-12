import { SEVERITIES, type Issue, type Report, type Severity } from './types.js';

export const VERSION = '0.1.0';

export function severityRank(s: Severity): number {
  return SEVERITIES.indexOf(s);
}

export function isSeverity(v: unknown): v is Severity {
  return typeof v === 'string' && (SEVERITIES as readonly string[]).includes(v);
}

export function meetsThreshold(issue: Issue, failOn: Severity): boolean {
  return severityRank(issue.severity) >= severityRank(failOn);
}

export function createReport(issues: Issue[], failOn: Severity = 'high', now: Date = new Date()): Report {
  const bySeverity = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<Severity, number>;
  for (const i of issues) bySeverity[i.severity]++;
  const sorted = [...issues].sort(
    (a, b) =>
      severityRank(b.severity) - severityRank(a.severity) || (a.file ?? '').localeCompare(b.file ?? '') || (a.line ?? 0) - (b.line ?? 0),
  );
  return {
    tool: 'devguard',
    version: VERSION,
    generatedAt: now.toISOString(),
    ok: !issues.some((i) => meetsThreshold(i, failOn)),
    failOn,
    summary: { total: issues.length, bySeverity },
    issues: sorted,
  };
}

/** 0 = pass, 1 = issues at/above threshold. (2 is reserved for usage errors by the CLI.) */
export function exitCodeFor(report: Report): 0 | 1 {
  return report.ok ? 0 : 1;
}

const COLORS: Record<Severity, string> = {
  info: '36',
  low: '34',
  medium: '33',
  high: '31',
  critical: '1;31',
};

export function formatText(report: Report, opts: { color?: boolean } = {}): string {
  const c = (code: string, s: string) => (opts.color ? `\u001b[${code}m${s}\u001b[0m` : s);
  const lines: string[] = [];
  for (const i of report.issues) {
    const loc = i.file ? ` ${i.file}${i.line ? `:${i.line}${i.column ? `:${i.column}` : ''}` : ''}` : '';
    lines.push(`${c(COLORS[i.severity], i.severity.toUpperCase().padEnd(8))} ${i.rule}${loc}`);
    lines.push(`         ${i.message}`);
    if (i.remediation) lines.push(`         -> ${i.remediation}`);
  }
  const s = report.summary;
  const parts = SEVERITIES.filter((k) => s.bySeverity[k] > 0)
    .reverse()
    .map((k) => `${s.bySeverity[k]} ${k}`);
  lines.push('');
  lines.push(
    s.total === 0
      ? c('32', 'OK: no issues found.')
      : `${s.total} issue${s.total === 1 ? '' : 's'} (${parts.join(', ')}). ` +
          (report.ok ? c('32', 'Passing') : c('31', 'Failing')) +
          ` (fail-on: ${report.failOn})`,
  );
  return lines.join('\n');
}

export function formatJson(report: Report): string {
  return JSON.stringify(report, null, 2);
}

function escapeData(s: string): string {
  return s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}
function escapeProp(s: string): string {
  return escapeData(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
}

/** GitHub Actions workflow-command annotations (::error / ::warning / ::notice). */
export function formatGithubAnnotations(report: Report): string {
  return report.issues
    .map((i) => {
      const rank = severityRank(i.severity);
      const level = rank >= severityRank('high') ? 'error' : rank >= severityRank('medium') ? 'warning' : 'notice';
      const props = [
        i.file ? `file=${escapeProp(i.file)}` : '',
        i.line ? `line=${i.line}` : '',
        i.column ? `col=${i.column}` : '',
        i.endColumn ? `endColumn=${i.endColumn}` : '',
        `title=${escapeProp(`DevGuard: ${i.rule}`)}`,
      ].filter(Boolean);
      const msg = i.remediation ? `${i.message} - ${i.remediation}` : i.message;
      return `::${level} ${props.join(',')}::${escapeData(msg)}`;
    })
    .join('\n');
}

export function format(report: Report, fmt: 'text' | 'json' | 'github', opts: { color?: boolean } = {}): string {
  if (fmt === 'json') return formatJson(report);
  if (fmt === 'github') return formatGithubAnnotations(report);
  return formatText(report, opts);
}
