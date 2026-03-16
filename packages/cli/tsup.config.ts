import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    cli: 'src/cli.ts',
    api: 'src/api.ts',
  },
  format: ['esm'],
  dts: false,
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
