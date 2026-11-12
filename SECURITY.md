# Security Policy

## Supported versions

Only the latest minor release line receives security fixes while the project is pre-1.0.

## Reporting a vulnerability

Please **do not** open a public issue. Use GitHub's private vulnerability reporting
(**Security → Report a vulnerability** on the repository). Include affected version, reproduction steps and impact.

Targets (best effort, maintained by volunteers): acknowledge within 5 business days; fix or mitigation plan within 30 days for confirmed issues; credit in the advisory if you wish.

## Scope & design guarantees

In scope: secret values appearing in any output, path traversal / reading outside the project, command or workflow-command injection through reports, ReDoS in built-in patterns, prototype pollution, supply-chain issues in published artifacts.

DevGuard is designed to:

- never print or serialise detected secret values (only a truncated SHA-256 fingerprint),
- make **no network requests** and send **no telemetry**,
- refuse scan/validate paths outside the project and never follow symlinks,
- escape all data placed in GitHub Actions workflow commands.

Out of scope: missed detections (false negatives) are bugs but not vulnerabilities; please file them as detection-rule issues with _synthetic_ examples.

## Release integrity

Releases are published from CI with npm provenance. Verify with `npm audit signatures`.
