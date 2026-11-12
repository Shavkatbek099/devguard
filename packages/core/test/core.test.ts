import { describe, expect, it } from 'vitest';
import { createReport, exitCodeFor, formatGithubAnnotations, formatJson, formatText, meetsThreshold, type Issue } from '../src/index.js';

const issue = (o: Partial<Issue> = {}): Issue => ({ rule: 'r/x', severity: 'high', source: 'scan', message: 'm', ...o });

describe('report', () => {
  it('summarises and sorts by severity', () => {
    const r = createReport([issue({ severity: 'low' }), issue({ severity: 'critical' })], 'high');
    expect(r.summary.bySeverity).toMatchObject({ low: 1, critical: 1, high: 0 });
    expect(r.issues[0]!.severity).toBe('critical');
    expect(r.ok).toBe(false);
  });
  it('honours the fail-on threshold', () => {
    expect(createReport([issue({ severity: 'medium' })], 'high').ok).toBe(true);
    expect(createReport([issue({ severity: 'medium' })], 'medium').ok).toBe(false);
    expect(exitCodeFor(createReport([], 'high'))).toBe(0);
    expect(meetsThreshold(issue({ severity: 'info' }), 'info')).toBe(true);
  });
  it('JSON is valid and stable in shape', () => {
    const j = JSON.parse(formatJson(createReport([issue()]))) as Record<string, unknown>;
    expect(Object.keys(j)).toEqual(['tool', 'version', 'generatedAt', 'ok', 'failOn', 'summary', 'issues']);
  });
  it('text output has OK message and optional colours', () => {
    expect(formatText(createReport([]))).toContain('no issues');
    expect(formatText(createReport([issue()]), { color: true })).toContain('\u001b[');
    expect(formatText(createReport([issue()]))).not.toContain('\u001b[');
  });
  it('escapes GitHub annotation payloads (no workflow-command injection)', () => {
    const out = formatGithubAnnotations(createReport([issue({ message: 'bad\n::error::injected 100%', file: 'a,b:c.ts', line: 3 })]));
    expect(out.split('\n')).toHaveLength(1);
    expect(out).toContain('%0A');
    expect(out).toContain('%25');
    expect(out).toContain('file=a%2Cb%3Ac.ts');
    expect(out.startsWith('::error ')).toBe(true);
  });
  it('maps severities to annotation levels', () => {
    const out = formatGithubAnnotations(createReport([issue({ severity: 'medium' }), issue({ severity: 'info' })]));
    expect(out).toContain('::warning');
    expect(out).toContain('::notice');
  });
});
