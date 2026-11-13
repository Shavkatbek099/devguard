// Static site generator: node website/build.mjs  ->  website/dist
// Requires the packages to be built first (`npm run build`).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'website/dist');
const pkg = JSON.parse(readFileSync(join(root, 'packages/cli/package.json'), 'utf8'));
const version = 'v' + pkg.version.split('.').slice(0, 2).join('.');
const REPO = 'https://github.com/Shavkatbek099/devguard';
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Keep previously built doc versions; rebuild everything else.
for (const d of ['assets', 'vendor']) rmSync(join(out, d), { recursive: true, force: true });
for (const f of ['index.html', 'search-index.json', 'versions.json']) rmSync(join(out, f), { force: true });
rmSync(join(out, 'docs', version), { recursive: true, force: true });
mkdirSync(join(out, 'assets'), { recursive: true });
mkdirSync(join(out, 'vendor'), { recursive: true });
for (const f of ['site.css', 'shared.js', 'playground.js']) cpSync(join(root, 'website', f), join(out, 'assets', f));
for (const p of ['core', 'validator', 'scanner']) {
  const src = join(root, 'packages', p, 'dist/esm');
  if (!existsSync(src)) throw new Error(`Build the packages first: ${src} is missing`);
  cpSync(src, join(out, 'vendor', p), { recursive: true, filter: (s) => !/\.(map|d\.ts)$/.test(s) });
}

const header = (base, extra = '') => `<header class="top"><a class="brand" href="${base}index.html">DevGuard</a><nav>
<a href="${base}docs/${version}/getting-started.html">Docs</a><a href="${REPO}">GitHub</a><a href="https://www.npmjs.com/package/devguard">npm</a>
${extra}<span class="search"><input id="q" type="search" placeholder="Search docs ( / )" aria-label="Search documentation" data-index="${base}search-index.json"><div id="results" class="results" role="listbox"></div></span>
<button id="theme" type="button" aria-label="Toggle light/dark theme">Theme</button></nav></header>
<div class="notice">Pre-release ${pkg.version}: not yet published to npm, and the GitHub/npm links above go live only after release.</div>`;
const shell = (
  title,
  base,
  body,
  extra = '',
  head = '',
) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="Validate env vars and config, and catch committed secrets, without ever printing them.">${head}
<link rel="stylesheet" href="${base}assets/site.css"></head><body>${header(base, extra)}${body}<footer>MIT licensed. No telemetry. <a href="${REPO}">Source</a></footer><script src="${base}assets/shared.js"></script></body></html>`;

// ---- docs
const order = [
  'getting-started',
  'cli',
  'configuration',
  'api',
  'frameworks',
  'github-actions',
  'troubleshooting',
  'migration',
  'architecture',
  'releasing',
  'maintainers',
];
const files = readdirSync(join(root, 'docs'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => f.slice(0, -3))
  .sort((a, b) => ((order.indexOf(a) + 99) % 99) - ((order.indexOf(b) + 99) % 99));
const titleOf = (md) => /^#\s+(.+)$/m.exec(md)?.[1] ?? 'Docs';
const searchIndex = [];
const versions = existsSync(join(out, 'docs')) ? readdirSync(join(out, 'docs')).filter((d) => /^v\d/.test(d)) : [];
if (!versions.includes(version)) versions.push(version);
for (const name of files) {
  const md = readFileSync(join(root, 'docs', `${name}.md`), 'utf8');
  const html = marked.parse(md, { gfm: true });
  const base = '../../';
  const nav = files
    .map(
      (f) =>
        `<a href="${f}.html"${f === name ? ' aria-current="page"' : ''}>${esc(titleOf(readFileSync(join(root, 'docs', `${f}.md`), 'utf8')))}</a>`,
    )
    .join('');
  const sel = `<select aria-label="Documentation version" onchange="location.href='../'+this.value+'/${name}.html'">${versions
    .sort()
    .map((v) => `<option${v === version ? ' selected' : ''}>${v}</option>`)
    .join('')}</select>`;
  mkdirSync(join(out, 'docs', version), { recursive: true });
  writeFileSync(
    join(out, 'docs', version, `${name}.html`),
    shell(
      `${titleOf(md)} | DevGuard`,
      base,
      `<div class="doc"><aside><nav aria-label="Docs">${nav}</nav></aside><article>${html}</article></div>`,
      sel,
    ),
  );
  searchIndex.push({ title: titleOf(md), url: `docs/${version}/${name}.html`, text: md.replace(/[#`*_>|-]/g, ' ').replace(/\s+/g, ' ') });
}
writeFileSync(join(out, 'search-index.json'), JSON.stringify(searchIndex));
writeFileSync(join(out, 'versions.json'), JSON.stringify({ latest: version, versions }));
// ---- landing page
const envSchema = JSON.stringify(
  {
    NODE_ENV: { type: 'enum', values: ['development', 'production'], default: 'development' },
    PORT: { type: 'port', default: 3000 },
    DATABASE_URL: { type: 'url', protocols: ['postgres'] },
  },
  null,
  2,
);
const cfgSchema = JSON.stringify(
  {
    type: 'object',
    required: ['name', 'port'],
    properties: { name: { type: 'string' }, port: { type: 'integer', minimum: 1, maximum: 65535 } },
  },
  null,
  2,
);
const importMap = {
  imports: {
    '@shavkat2006/devguard-core': './vendor/core/index.js',
    '@shavkat2006/devguard-validator': './vendor/validator/index.js',
    '@shavkat2006/devguard-scanner/text': './vendor/scanner/text.js',
    '@shavkat2006/devguard-scanner/patterns': './vendor/scanner/patterns.js',
  },
};
const ta = (id, v, rows = 7) => `<textarea id="${id}" rows="${rows}" spellcheck="false" aria-label="${id}">${esc(v)}</textarea>`;
const landing = `<section class="hero"><div><h1>Config that fails early. Secrets that never leak.</h1>
<p>DevGuard validates environment variables and config files, finds credentials committed to your repo, and reports problems in your terminal and on pull requests, without ever printing the secret.</p>
<div class="install"><code>npm i -D devguard</code><code>npx devguard check</code></div></div>
<pre aria-label="Example report"><span class="sev-critical">CRITICAL</span> secret/github-token src/api.ts:12:18
  Possible GitHub token detected
  <span class="redact">████████████████████████</span>
  (value never printed) fingerprint 3f9a1c0b7e22

1 issue (1 critical). <span class="sev-high">Failing</span></pre></section>
<main class="wrap"><h2 id="try" style="font-family:var(--serif)">Try it: this runs the real library in your browser</h2>
<div class="lab"><div class="tabs" role="tablist"><button role="tab" data-tool="env" aria-selected="true">Environment</button><button role="tab" data-tool="scan" aria-selected="false">Secret scan</button><button role="tab" data-tool="config" aria-selected="false">Config schema</button></div>
<div class="panes"><div>
<div data-for="env"><label for="env-schema">Schema (devguard.config.json "env")</label>${ta('env-schema', envSchema, 10)}<label for="env-text">.env</label>${ta('env-text', 'PORT=99999\nNODE_ENV=staging', 4)}</div>
<div data-for="scan" hidden><label for="scan-text">Text to scan (nothing leaves your browser)</label>${ta('scan-text', '', 10)}</div>
<div data-for="config" hidden><label for="cfg-data">config.json</label>${ta('cfg-data', '{ "name": 5 }', 5)}<label for="cfg-schema">Schema</label>${ta('cfg-schema', cfgSchema, 9)}</div>
<button id="run" class="primary" type="button">Validate</button></div><div><label>Result</label><div id="out" class="out" aria-live="polite"></div></div></div></div>
<div class="features"><div><h3>Typed environment</h3><p><code>createEnv()</code> returns an object typed from your schema (<code>port: number</code>, enum unions, optional fields) and reports every problem at once.</p></div>
<div><h3>Secret scanner</h3><p>Pattern and entropy based, with excludes, custom rules, inline ignores and baselines. Reports hold a rule, a location and a fingerprint, never the value.</p></div>
<div><h3>CI that annotates PRs</h3><p>A composite action and reusable workflow turn findings into annotations on the diff and fail the job at the severity you choose.</p></div></div>
<h2 style="font-family:var(--serif)">Install</h2><pre>npm i -D devguard           # CLI
npm i @shavkat2006/devguard-validator   # typed env in your app
npx devguard init --workflow</pre><p><a href="docs/${version}/getting-started.html">Read the docs</a>. Limits are stated up front in the <a href="${REPO}#limitations-read-this">README</a>.</p></main>
<script type="module" src="assets/playground.js"></script>`;
writeFileSync(
  join(out, 'index.html'),
  shell(
    'DevGuard: config validation and secret scanning',
    './',
    landing,
    '',
    `<script type="importmap">${JSON.stringify(importMap)}</script>`,
  ),
);
console.log(`Built ${files.length} doc pages (${version}) + landing page -> website/dist`);
