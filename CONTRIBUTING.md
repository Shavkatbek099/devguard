# Contributing to DevGuard

Thanks for helping! Small, focused PRs are easiest to review.

## Setup

```bash
git clone https://github.com/Shavkatbek099/devguard && cd devguard
npm ci
npm run verify   # build + typecheck + lint + format check + tests
```

Development tooling requires Node ≥ 22.12 (the published packages support Node ≥ 18.17; CI smoke-tests the built output on 18 and 20). Useful scripts: `npm test`, `npm run build`, `npm run format`.

## Ground rules

1. **Never commit real credentials**, not even revoked ones. Test fixtures must build fake tokens at runtime
   (see `packages/scanner/test/scanner.test.ts`, e.g. `'gh' + 'p_' + '…'`).
2. **Reports must never contain secret values.** Any change touching output needs a test proving it.
3. Keep runtime dependencies at zero where possible; justify any new one in the PR.
4. Add tests for every behaviour change, including at least one failure/edge case.
5. User-facing change? Run `npx changeset` and describe it.

## Adding a detection rule (great first contribution)

1. Find the provider's **documented** token format (link it in the PR).
2. Add an entry to `DEFAULT_PATTERNS` in `packages/scanner/src/patterns.ts`. Prefer distinctive prefixes over entropy heuristics.
3. Add a positive test and at least one near-miss/false-positive test.
4. Update `docs/api.md` if it changes the rule list.

## Pull requests

Fill in the PR template. CI runs on Linux, macOS and Windows with Node 18/20/22. A maintainer will review; please be patient and kind.

## Reporting bugs / proposing features

Use the issue templates. Security problems: see [SECURITY.md](SECURITY.md), **do not** open a public issue.

## Conduct

Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
