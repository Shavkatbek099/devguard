# API reference

## `@shavkat2006/devguard-validator`

### `env` builders

`env.string | number | port | boolean | url | email | enum(values, opts)`. Common options: `optional`, `default`, `description`, `validate(value) => true | false | string`.

Type inference: required or defaulted → `T`; `optional: true` without default → `T | undefined`. Use `as const` on enum value arrays.

### `validateEnv(schema, source = process.env)`

Returns `{ ok: true, value, issues: [] }` or `{ ok: false, issues }`. Never throws, never echoes values.

### `createEnv(schema, source = process.env)`

Returns the typed object or throws `ValidationError` (`.issues` has every problem).

### `parseDotenv(text)`

Minimal `.env` parser (`KEY=value`, quotes, `export`, trailing comments). No variable expansion; safe against `__proto__` keys.

### `validateSchema(data, schema, file?)` / `validateConfig(data, { schema, rules, file })`

Supported JSON Schema subset: `type` (incl. arrays), `required`, `properties`, `additionalProperties` (boolean | schema), `items`, `enum`, `const`, `minimum`, `maximum`, `minLength`, `maxLength`, `pattern`, `minItems`, `maxItems`, `anyOf`, `allOf`. Not supported: `$ref`, `oneOf`, `not`, `format`, `if/then/else`, `patternProperties`.
`rules` are consistency checks: `{ id, message, test(data) => boolean, severity? }`.

### `parseJson(text, file?)`, `parseYaml(text, adapter, file?)`, `loadYamlAdapter()`

YAML needs an adapter function (e.g. `yaml.parse`), or `loadYamlAdapter()` finds `yaml`/`js-yaml` if installed.

## `@shavkat2006/devguard-scanner`

```ts
import { scanDirectory, scanText, DEFAULT_PATTERNS } from '@shavkat2006/devguard-scanner';
const { issues, filesScanned, filesSkipped } = await scanDirectory({
  cwd: process.cwd(),
  include: ['src'],
  exclude: ['fixtures/'],
  customPatterns: [{ id: 'internal', pattern: 'INT-[0-9]{8}' }],
});
```

Built-in rule ids: `aws-access-key-id`, `github-token`, `slack-token`, `stripe-live-key`, `google-api-key`, `npm-token`, `private-key`, `jwt`, `generic-secret-assignment`. Reported as `secret/<id>`; custom rules as `secret/custom/<id>`.

## `@shavkat2006/devguard-core`

`Issue`, `Report`, `Severity`, `createReport(issues, failOn)`, `format(report, 'text'|'json'|'github')`, `exitCodeFor(report)`, `DevGuardError`, `UsageError`, `ValidationError`, `VERSION`.
