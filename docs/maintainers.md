# Maintainer guide

- **Triage**: label new issues within a week (`bug`, `enhancement`, `scanner`, …). Mark approachable ones `good first issue` and add a pointer to the relevant file and test.
- **Reviews**: require green CI on all OSes, tests for behaviour changes, and a changeset for user-facing changes. Check that no output path can include secret values.
- **Detection rules**: require a link to the provider's documented format, a synthetic example, and a near-miss test.
- **Security reports**: handle privately via advisories; see SECURITY.md.
- **Growing the maintainer team**: invite contributors with a sustained record of quality reviews/PRs. Do not hand out access for vanity metrics.
- **Honesty policy**: no purchased stars/downloads, no fake contributors or dependents. Publish only metrics you can verify (npm stats, GitHub dependency graph).
