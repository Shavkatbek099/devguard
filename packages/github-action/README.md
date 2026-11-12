# DevGuard GitHub Action

```yaml
# .github/workflows/devguard.yml
name: DevGuard
on: [pull_request]
permissions: { contents: read }
jobs:
  devguard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: OWNER/devguard/packages/github-action@v0
        with:
          fail-on: high
```

Findings appear as annotations on the PR diff. Secret **values are never printed**.
Inputs: `command`, `fail-on`, `working-directory`, `version`, `config`.
Prefer pinning `version` and the action ref to a commit SHA in security-sensitive repos.
