import type { Issue } from './types.js';

export class DevGuardError extends Error {
  readonly code: string;
  constructor(message: string, code = 'DEVGUARD_ERROR', options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DevGuardError';
    this.code = code;
  }
}

/** Thrown for invalid user input / configuration of DevGuard itself (CLI exit code 2). */
export class UsageError extends DevGuardError {
  constructor(message: string) {
    super(message, 'DEVGUARD_USAGE');
    this.name = 'UsageError';
  }
}

export class ValidationError extends DevGuardError {
  readonly issues: Issue[];
  constructor(message: string, issues: Issue[]) {
    super(message, 'DEVGUARD_VALIDATION');
    this.name = 'ValidationError';
    this.issues = issues;
  }
}
