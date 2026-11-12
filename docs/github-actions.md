# GitHub Actions

Three ways to run DevGuard in CI:

1. **Composite action**: `uses: OWNER/devguard/packages/github-action@v0` (inputs: `command`, `fail-on`, `working-directory`, `version`, `config`).
2. **Reusable workflow**: `uses: OWNER/devguard/.github/workflows/devguard-reusable.yml@v0`.
3. **Plain npx**: `npx --yes devguard@<version> check --format github`.

`--format github` emits `::error`/`::warning`/`::notice` workflow commands, shown as annotations on the PR diff.
`high`/`critical` → error, `medium` → warning, others → notice. The job fails when any issue meets `--fail-on`.

Hardening tips: pin `version` and pin actions to commit SHAs; use `permissions: contents: read`; use `actions/checkout` with `fetch-depth: 1` (history scanning is not implemented yet).
Secret values are never written to the log; fingerprints can be copied into `scan.baseline` to accept a known finding.
