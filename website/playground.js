// Runs the REAL @devguard/validator and @devguard/scanner code in the browser (see import map in index.html).
import { env, validateEnv, parseDotenv, validateSchema } from '@devguard/validator';
import { scanText } from '@devguard/scanner/text';
import { DEFAULT_PATTERNS } from '@devguard/scanner/patterns';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const issueRow = (i) => {
  const r = el('div', 'row');
  r.append(
    el('span', `sev-${i.severity}`, `${i.severity.toUpperCase()} ${i.rule}${i.line ? ` (${i.line}:${i.column})` : ''}`),
    el('div', '', i.message),
  );
  return r;
};

// Same field mapping as the CLI's config loader.
function buildSchema(fields) {
  const s = {};
  for (const [k, f] of Object.entries(fields)) {
    const base = { optional: f.required === false, description: f.description, default: f.default };
    const b = {
      string: () => env.string({ ...base, minLength: f.minLength, maxLength: f.maxLength, pattern: f.pattern && new RegExp(f.pattern) }),
      number: () => env.number({ ...base, min: f.min, max: f.max, integer: f.integer }),
      port: () => env.port(base),
      boolean: () => env.boolean(base),
      url: () => env.url({ ...base, protocols: f.protocols }),
      email: () => env.email(base),
      enum: () => env.enum(f.values ?? [], base),
    }[f.type];
    if (!b) throw new Error(`${k}: unknown type "${f.type}"`);
    s[k] = b();
  }
  return s;
}
const jsonOrThrow = (id) => {
  try {
    return JSON.parse($(id).value);
  } catch (e) {
    throw new Error(`${id}: ${e.message}`);
  }
};

const tools = {
  env() {
    const r = validateEnv(buildSchema(jsonOrThrow('env-schema')), parseDotenv($('env-text').value));
    return r.ok ? [el('div', 'pass', 'OK: typed result'), el('pre', '', JSON.stringify(r.value, null, 2))] : r.issues.map(issueRow);
  },
  scan() {
    const text = $('scan-text').value,
      lines = text.split(/\r?\n/);
    const issues = scanText(text, 'input', DEFAULT_PATTERNS);
    if (!issues.length) return [el('div', 'pass', 'OK: no secrets detected')];
    const pre = el('pre');
    lines.forEach((ln, n) => {
      const spans = issues.filter((i) => i.line === n + 1).sort((a, b) => a.column - b.column);
      let pos = 0;
      // Placeholder glyphs: the secret itself never enters the output DOM.
      for (const i of spans) {
        pre.append(ln.slice(pos, i.column - 1));
        const bar = el('span', 'redact', '\u2588'.repeat(i.endColumn - i.column));
        bar.setAttribute('aria-label', 'redacted secret');
        pre.append(bar);
        pos = i.endColumn - 1;
      }
      pre.append(ln.slice(pos) + '\n');
    });
    return [
      pre,
      ...issues.map((i) => {
        const r = issueRow(i);
        r.append(el('div', '', `fingerprint ${i.fingerprint}; the value is never included in the report`));
        return r;
      }),
    ];
  },
  config() {
    const issues = validateSchema(jsonOrThrow('cfg-data'), jsonOrThrow('cfg-schema'), 'config.json');
    return issues.length ? issues.map(issueRow) : [el('div', 'pass', 'OK: valid')];
  },
};
// Demo credential is assembled at runtime and is not a real token.
const fake = 'gh' + 'p_' + 'aB3dE6gH9jK2mN5pQ8sT1vW4yZ7bC0eF3hJ6';
$('scan-text').value = `const octokit = new Octokit({ auth: "${fake}" });\nconst port = process.env.PORT; // fine`;
let current = 'env';
const run = () => {
  const out = $('out');
  try {
    out.replaceChildren(...tools[current]());
  } catch (e) {
    out.replaceChildren(el('div', 'sev-high', e.message));
  }
};
document.querySelectorAll('[role=tab]').forEach((t) =>
  t.addEventListener('click', () => {
    current = t.dataset.tool;
    document.querySelectorAll('[role=tab]').forEach((x) => x.setAttribute('aria-selected', String(x === t)));
    document.querySelectorAll('[data-for]').forEach((p) => (p.hidden = p.dataset.for !== current));
    run();
  }),
);
$('run').addEventListener('click', run);
run();
