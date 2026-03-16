import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    cli: 'src/cli.ts',
    api: 'src/api.ts',
  },
  format: ['esm'],
  dts: {
    // Only generate type declarations for the API (not the CLI binary)
    entry: { api: 'src/api.ts' },
    // @codemcp/skills-core is a published dependency of @codemcp/skills,
    // so its types are available to consumers as a transitive dep.
    resolve: false,
    compilerOptions: {
      allowImportingTsExtensions: true,
      types: ['node'],
    },
  },
  clean: true,
  bundle: true,
  // Keep CommonJS modules external that don't bundle well with ESM
  external: [
    'gray-matter',
    'js-yaml',
    'ajv',
    'pacote',
    'simple-git', // Uses @kwsites/file-exists which has dynamic require('fs')
  ],
  noExternal: ['@codemcp/skills-core'],
  target: 'node20',
  sourcemap: false,
});
