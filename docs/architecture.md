# Architecture

```
core        types, errors, reporters           (no deps)
validator   env + config validation  ──► core
scanner     secret scanning          ──► core
cli         commands, config loading ──► core, validator, scanner
```

- **Single report model** (`Issue`/`Report`) shared by every module → one exit-code contract and one output pipeline.
- **No secrets in output** by construction: `Issue` has no field for the matched value; scanner only emits a SHA-256 fingerprint (12 hex chars).
- **Dependency-free** runtime. `yaml` is an optional peer, loaded dynamically.
- **Dual build**: `tsc` emits ESM (`dist/esm`) and CJS (`dist/cjs`); `package.json#exports` maps both with types. The CLI is ESM-only.
- **Safety**: no symlink traversal, project-root confinement, file-size/line-length caps (bounds ReDoS exposure), escaped workflow commands.
- **Testing**: Vitest unit tests against source via aliases; one test spawns the built binary.
