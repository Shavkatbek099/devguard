# Migration guides

DevGuard is at 0.1.0: no previous releases, so there is nothing to migrate _from_ yet. Breaking changes before 1.0 will be listed here and in the changelog.

## Coming from `dotenv` + hand-written checks

Keep loading `.env` with your loader of choice (or pass `--env-file` to the CLI), then replace `process.env.X` usage with the object returned by `createEnv`.

## Coming from `envalid` / `zod` env parsing

`env.string/number/boolean/url/enum` map directly to the same concepts. Differences: DevGuard treats empty strings as unset, never echoes values in errors, and reports every problem at once. Zod/Standard-Schema interop is on the roadmap.

## Coming from `gitleaks` / `trufflehog`

DevGuard's scanner is intentionally simpler (working-tree only, no history, fewer rules). Use it alongside, not instead of, those tools if you need history scanning today.
