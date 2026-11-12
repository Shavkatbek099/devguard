import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { UsageError, VERSION, createReport, exitCodeFor, format, type Issue, type Report } from '@devguard/core';
import { parseArgs, type Args } from './args.js';
import { loadConfig } from './config.js';
import { runConfigFiles, runDoctor, runEnv, runInit, runScan, type Ctx } from './commands.js';

export const HELP = `devguard ${VERSION} - developer configuration & security toolkit

Usage: devguard <command> [paths...] [options]

Commands:
  init       Create devguard.config.json (and optionally a GitHub workflow)
  check      Run everything: env + config files + secret scan
  scan       Scan files for accidentally committed secrets
  validate   Validate environment variables and config files
  report     Run everything and write a JSON report (default: devguard-report.json)
  doctor     Diagnose common project setup problems

Options:
  --format <text|json|github>  Output format (default: text)
  --json                       Shorthand for --format json
  --fail-on <severity>         info | low | medium | high | critical (default: high)
  -c, --config <file>          Config file (default: devguard.config.json)
  --env-file <file>            Load variables from a .env file for validation
  -o, --output <file>          Write the report to a file (report command)
  --no-color                   Disable colored output
  -q, --quiet                  Print nothing except errors
  --force                      Overwrite files (init)
  --workflow                   Also create .github/workflows/devguard.yml (init)
  -h, --help / -v, --version

Exit codes: 0 = pass, 1 = issues at/above --fail-on, 2 = usage or runtime error`;

export interface IO {
  out: (s: string) => void;
  err: (s: string) => void;
  cwd: string;
}

export async function main(argv: string[], io: IO): Promise<number> {
  try {
    const args = parseArgs(argv);
    if (args.version) return (io.out(VERSION), 0);
    if (args.help || !args.command) return (io.out(HELP), args.help ? 0 : 2);
    return await dispatch(args, io);
  } catch (e) {
    if (e instanceof UsageError) {
      io.err(`devguard: ${e instanceof Error ? e.message : String(e)}`);
      return 2;
    }
    io.err(`devguard: unexpected error: ${(e as Error).message}`);
    return 2;
  }
}

async function dispatch(args: Args, io: IO): Promise<number> {
  const cwd = resolve(io.cwd);
  if (args.command === 'init') {
    const written = await runInit(cwd, { force: args.force, workflow: args.workflow });
    if (!args.quiet) io.out(`Created ${written.join(', ')}\nNext: edit the env schema, then run "devguard check".`);
    return 0;
  }
  const known = ['check', 'scan', 'validate', 'report', 'doctor'];
  if (!known.includes(args.command!)) throw new UsageError(`Unknown command "${args.command}". Run "devguard --help".`);

  const { config } = await loadConfig(cwd, args.config);
  const ctx: Ctx = { cwd, config, envFile: args.envFile, paths: args.paths };
  const issues: Issue[] = [];
  switch (args.command) {
    case 'scan':
      issues.push(...(await runScan(ctx)).issues);
      break;
    case 'validate':
      issues.push(...(await runEnv(ctx)), ...(await runConfigFiles(ctx)));
      break;
    case 'doctor':
      issues.push(...(await runDoctor(ctx)));
      break;
    default: // check, report
      issues.push(...(await runEnv(ctx)), ...(await runConfigFiles(ctx)), ...(await runScan(ctx)).issues);
  }
  const report: Report = createReport(issues, args.failOn ?? config.failOn ?? 'high');

  if (args.command === 'report') {
    const file = resolve(cwd, args.output ?? 'devguard-report.json');
    await fs.writeFile(file, format(report, 'json') + '\n');
    if (!args.quiet)
      io.out(
        args.format === 'json'
          ? format(report, 'json')
          : `${format(report, 'text', { color: args.color })}\nReport written to ${args.output ?? 'devguard-report.json'}`,
      );
  } else if (!args.quiet || !report.ok) {
    io.out(format(report, args.format, { color: args.color }));
  }
  return exitCodeFor(report);
}
