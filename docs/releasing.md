# Releasing (maintainers)

**Nothing is published automatically until a maintainer completes the one-time setup below.**

## One-time setup

1. Replace every `OWNER` placeholder (`grep -rn OWNER .`) with the real GitHub org/user; set real URLs in `scripts/gen-packages.mjs` then run it.
2. **Check npm name availability** for `devguard`, `@devguard/core`, `@devguard/validator`, `@devguard/scanner` (`npm view <name>`). The unscoped `devguard` name may be taken; if so rename the CLI (e.g. `@your-scope/devguard`) and update docs. Scoped packages require creating the `@devguard` org (or switching scope).
3. Create an npm automation token → repository secret `NPM_TOKEN`. Enable 2FA on the npm account.
4. Replace the Code-of-Conduct contact address; enable private vulnerability reporting.
5. Create labels: `gh label create` from `.github/labels.yml`.

## Each release

1. Contributors add changesets (`npx changeset`) in PRs.
2. On merge to `main`, the Release workflow opens a **"chore: version packages"** PR (bumps versions + changelogs).
3. A maintainer reviews and merges it → CI builds, tests, and runs `changeset publish` with **npm provenance** (`id-token: write`, `publishConfig.provenance`). GitHub Releases/tags are created by changesets.
4. Verify: `npm view devguard version`, `npm audit signatures`.

## Manual dry run

```bash
npm run verify
npm pack --dry-run --workspaces
```

Semantic Versioning applies; pre-1.0, minor versions may contain breaking changes (documented in the changelog).
