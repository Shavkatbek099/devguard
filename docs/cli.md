# CLI reference

```
devguard <command> [paths...] [options]
```

| Command    | What it does                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------ |
| `init`     | Create `devguard.config.json`; `--workflow` also creates a GitHub workflow; `--force` overwrites |
| `check`    | env validation + config file validation + secret scan                                            |
| `scan`     | secret scan only. Optional `paths` restrict what is scanned                                      |
| `validate` | env validation + config file validation                                                          |
| `report`   | like `check`, but writes JSON to `devguard-report.json` (or `-o <file>`)                         |
| `doctor`   | project hygiene: Node version, missing config, `.env` tracked/un-ignored in git, YAML adapter    |

## Options

| Option                                                  | Description                                            |
| ------------------------------------------------------- | ------------------------------------------------------ |
| `--format text\|json\|github`                           | Output format (default `text`). `--json` is shorthand. |
| `--fail-on <severity>`                                  | `info`, `low`, `medium`, `high` (default), `critical`  |
| `-c, --config <file>`                                   | Config path (default `devguard.config.json`)           |
| `--env-file <file>`                                     | Load a `.env` file; **real environment variables win** |
| `-o, --output <file>`                                   | Report destination (`report`)                          |
| `--no-color`, `-q`, `--force`, `--workflow`, `-h`, `-v` | as named                                               |

## Exit codes

| Code | Meaning                                                                |
| ---- | ---------------------------------------------------------------------- |
| 0    | No issues at or above `--fail-on`                                      |
| 1    | At least one issue at or above `--fail-on`                             |
| 2    | Usage error (bad flag, unreadable config, path outside the project, …) |

## JSON report shape

```json
{
  "tool": "devguard",
  "version": "0.1.0",
  "generatedAt": "…",
  "ok": false,
  "failOn": "high",
  "summary": { "total": 1, "bySeverity": { "info": 0, "low": 0, "medium": 0, "high": 0, "critical": 1 } },
  "issues": [
    {
      "rule": "secret/github-token",
      "severity": "critical",
      "source": "scan",
      "message": "Possible GitHub token detected",
      "file": "src/a.ts",
      "line": 3,
      "column": 12,
      "fingerprint": "d4906974497e",
      "remediation": "…"
    }
  ]
}
```

## Severities

Scanner rules: provider keys/private keys = `critical`/`high`; JWTs and generic assignments = `medium`.
Env/config problems = `high` (unknown properties and unsafe keys = `medium`). Doctor findings vary.
