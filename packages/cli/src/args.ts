import { UsageError, isSeverity, type OutputFormat, type Severity } from '@shavkat2006/devguard-core';

export interface Args {
  command: string | undefined;
  paths: string[];
  format: OutputFormat;
  failOn?: Severity;
  config?: string;
  envFile?: string;
  output?: string;
  color: boolean;
  quiet: boolean;
  force: boolean;
  workflow: boolean;
  help: boolean;
  version: boolean;
}

export function parseArgs(argv: string[]): Args {
  const a: Args = {
    command: undefined,
    paths: [],
    format: 'text',
    color: !process.env.NO_COLOR && !!process.stdout.isTTY,
    quiet: false,
    force: false,
    workflow: false,
    help: false,
    version: false,
  };
  const takeValue = (i: number, flag: string): string => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) throw new UsageError(`Option ${flag} requires a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const [flag, inline] =
      arg.startsWith('--') && arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined];
    const val = (): string => {
      if (inline !== undefined) return inline;
      const v = takeValue(i, flag);
      i++;
      return v;
    };
    switch (flag) {
      case '--help':
      case '-h':
        a.help = true;
        break;
      case '--version':
      case '-v':
        a.version = true;
        break;
      case '--json':
        a.format = 'json';
        break;
      case '--format': {
        const f = val();
        if (f !== 'text' && f !== 'json' && f !== 'github') throw new UsageError(`Unknown format "${f}" (use text, json or github)`);
        a.format = f;
        break;
      }
      case '--fail-on': {
        const s = val();
        if (!isSeverity(s)) throw new UsageError(`Unknown severity "${s}" (use info, low, medium, high or critical)`);
        a.failOn = s;
        break;
      }
      case '--config':
      case '-c':
        a.config = val();
        break;
      case '--env-file':
        a.envFile = val();
        break;
      case '--output':
      case '-o':
        a.output = val();
        break;
      case '--no-color':
        a.color = false;
        break;
      case '--quiet':
      case '-q':
        a.quiet = true;
        break;
      case '--force':
        a.force = true;
        break;
      case '--workflow':
        a.workflow = true;
        break;
      default:
        if (arg.startsWith('-')) throw new UsageError(`Unknown option: ${arg}`);
        if (a.command === undefined) a.command = arg;
        else a.paths.push(arg);
    }
  }
  return a;
}
