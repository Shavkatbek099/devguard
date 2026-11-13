// Generates per-package package.json / tsconfig files so they stay consistent.
import { writeFileSync } from 'node:fs';
const common = {
  version: '0.1.0',
  license: 'MIT',
  author: 'DevGuard contributors',
  repository: { type: 'git', url: 'git+https://github.com/Shavkatbek099/devguard.git', directory: '' },
  bugs: 'https://github.com/Shavkatbek099/devguard/issues',
  homepage: 'https://github.com/Shavkatbek099/devguard#readme',
  engines: { node: '>=18.17' },
  publishConfig: { access: 'public', provenance: true },
  sideEffects: false,
  files: ['dist', 'README.md', 'LICENSE'],
};
const libs = {
  core: { name: '@shavkat2006/devguard-core', description: 'Shared types, errors and reporters for DevGuard', deps: {} },
  validator: {
    name: '@shavkat2006/devguard-validator',
    description: 'Type-safe environment variable and config validation',
    deps: { '@shavkat2006/devguard-core': '^0.1.0' },
  },
  scanner: {
    name: '@shavkat2006/devguard-scanner',
    description: 'Dependency-free secret scanner that never prints secret values',
    deps: { '@shavkat2006/devguard-core': '^0.1.0' },
  },
};
for (const [dir, m] of Object.entries(libs)) {
  const pkg = {
    name: m.name,
    version: common.version,
    description: m.description,
    license: common.license,
    author: common.author,
    repository: { ...common.repository, directory: `packages/${dir}` },
    bugs: common.bugs,
    homepage: common.homepage,
    keywords: ['devguard', 'security', 'config', 'env', 'typescript'],
    type: undefined,
    main: './dist/cjs/index.js',
    module: './dist/esm/index.js',
    types: './dist/esm/index.d.ts',
    exports: {
      '.': {
        import: { types: './dist/esm/index.d.ts', default: './dist/esm/index.js' },
        require: { types: './dist/cjs/index.d.ts', default: './dist/cjs/index.js' },
      },
      './package.json': './package.json',
    },
    sideEffects: false,
    files: common.files,
    engines: common.engines,
    publishConfig: common.publishConfig,
    scripts: { build: 'node ../../scripts/build.mjs', clean: "node -e \"require('fs').rmSync('dist',{recursive:true,force:true})\"" },
    dependencies: m.deps,
  };
  writeFileSync(`packages/${dir}/package.json`, JSON.stringify(pkg, null, 2) + '\n');
  writeFileSync(
    `packages/${dir}/tsconfig.esm.json`,
    JSON.stringify(
      {
        extends: '../../tsconfig.base.json',
        compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', outDir: 'dist/esm', rootDir: 'src' },
        include: ['src'],
      },
      null,
      2,
    ) + '\n',
  );
  writeFileSync(
    `packages/${dir}/tsconfig.cjs.json`,
    JSON.stringify(
      {
        extends: '../../tsconfig.base.json',
        compilerOptions: {
          module: 'CommonJS',
          moduleResolution: 'Node10',
          outDir: 'dist/cjs',
          rootDir: 'src',
          declaration: false,
          declarationMap: false,
        },
        include: ['src'],
      },
      null,
      2,
    ) + '\n',
  );
}
// CLI (ESM only, bin)
const cli = {
  name: '@shavkat2006/devguard',
  version: common.version,
  description: 'DevGuard CLI: validate env vars & config, and catch committed secrets',
  license: 'MIT',
  author: common.author,
  repository: { ...common.repository, directory: 'packages/cli' },
  bugs: common.bugs,
  homepage: common.homepage,
  keywords: ['devguard', 'cli', 'secrets', 'env', 'validation', 'security'],
  type: 'module',
  bin: { devguard: './dist/esm/bin.js' },
  main: './dist/esm/index.js',
  types: './dist/esm/index.d.ts',
  exports: { '.': { types: './dist/esm/index.d.ts', default: './dist/esm/index.js' }, './package.json': './package.json' },
  files: common.files,
  engines: common.engines,
  publishConfig: common.publishConfig,
  scripts: { build: 'node ../../scripts/build.mjs --esm-only' },
  dependencies: {
    '@shavkat2006/devguard-core': '^0.1.0',
    '@shavkat2006/devguard-validator': '^0.1.0',
    '@shavkat2006/devguard-scanner': '^0.1.0',
  },
  peerDependencies: { yaml: '^2.0.0' },
  peerDependenciesMeta: { yaml: { optional: true } },
};
writeFileSync('packages/cli/package.json', JSON.stringify(cli, null, 2) + '\n');
writeFileSync(
  'packages/cli/tsconfig.esm.json',
  JSON.stringify(
    {
      extends: '../../tsconfig.base.json',
      compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', outDir: 'dist/esm', rootDir: 'src' },
      include: ['src'],
    },
    null,
    2,
  ) + '\n',
);
