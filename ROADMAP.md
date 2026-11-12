# Roadmap

Priorities are indicative, not promises. Open an issue to discuss or to claim an item.

## 0.1 (current): foundations

- [x] Typed env validation, config/schema validation, secret scanner, CLI, GitHub Action

## 0.2

- [ ] Scan staged changes only (`devguard scan --staged`) for pre-commit hooks
- [ ] SARIF output for GitHub code scanning
- [ ] More provider rules (help wanted: `good first issue`)
- [ ] `.devguardignore` file support

## 0.3

- [ ] Git history scanning
- [ ] Config-defined baselines (`devguard baseline`)
- [ ] Zod/Standard-Schema interop for `createEnv`
- [ ] Framework presets (Next.js public/server env split)

## 1.0

- [ ] Stable API and rule IDs, semver guarantees documented
- [ ] Complete versioned docs site
