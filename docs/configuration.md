# Configuration (`devguard.config.json`)

```jsonc
{
  "failOn": "high",
  "envFile": ".env", // optional default for --env-file
  "env": { "PORT": { "type": "port", "default": 3000 } },
  "scan": {
    "include": ["."],
    "exclude": ["**/*.snap", "fixtures/"], // added to built-in excludes
    "disableRules": ["jwt"],
    "baseline": ["d4906974497e"], // accepted fingerprints
    "customPatterns": [{ "id": "internal-token", "pattern": "INT-[0-9]{8}", "severity": "high" }],
  },
  "validate": [{ "file": "app.config.json", "schema": "schemas/app.schema.json", "requireTogether": [["tls.cert", "tls.key"]] }],
}
```

## `env` field types

| type      | options                                                 |
| --------- | ------------------------------------------------------- |
| `string`  | `minLength`, `maxLength`, `pattern`                     |
| `number`  | `min`, `max`, `integer`                                 |
| `port`    | integer 1-65535                                         |
| `boolean` | accepts true/false/1/0/yes/no/on/off (case-insensitive) |
| `url`     | `protocols` (e.g. `["https"]`)                          |
| `email`   |                                                         |
| `enum`    | `values` (required)                                     |

All fields accept `required` (default `true`; set `false` for optional), `default`, `description`. Empty strings count as unset.

## Scanner

- Built-in excludes: `node_modules/ .git/ dist/ build/ out/ coverage/ .next/ .nuxt/ .turbo/ .cache/ .venv/ vendor/ *.min.js *.map` and lockfiles.
- Files > 1 MB, binary files and symlinks are skipped. Lines > 5000 chars are skipped.
- Inline suppression: `// devguard-ignore` on the line, or `// devguard-ignore-next-line`.
- Custom `pattern` is a regex source string; use one capture group plus `"group": 1` to target the secret part.

## Config-file validation

`validate[].schema` is a path to a JSON schema (or an inline object). `.yaml/.yml` targets need the optional `yaml` (or `js-yaml`) package.
`requireTogether` lists dotted property paths that must all be set or all unset.
`validate[].file` must stay inside the project directory.
