# Troubleshooting

**`validate` says a variable is invalid but my `.env` is correct.** Real environment variables override `.env` values. Check `printenv NAME`. Tools like Vitest set `MODE`/`NODE_ENV`.

**Exit code 2.** Usage/runtime error: unknown flag, unreadable config, a path outside the project, or a missing schema file. The message is printed to stderr.

**YAML file reported as `config/yaml-adapter-missing`.** `npm i -D yaml`.

**A file I expected is not scanned.** It may match a default exclude, exceed 1 MB, be binary, be a symlink, or contain lines > 5000 chars. `scan` reports no per-file reasons yet (roadmap).

**False positive.** Add `// devguard-ignore` on the line, `scan.exclude` the path, `scan.disableRules` the rule, or add the fingerprint to `scan.baseline`. Please also open a detection-rule issue with a _synthetic_ example.

**`::error` annotations not showing.** Use `--format github` and make sure the `file` paths are relative to the repo root (run from the repository root or set `working-directory`).

**Secrets already committed.** Rotate first (assume compromised), then remove from history with `git filter-repo` or your host's tooling.
