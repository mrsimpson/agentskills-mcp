import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    bin: "src/bin.ts",
    index: "src/index.ts"
  },
  format: ["esm"],
  dts: false,
  clean: true,
  bundle: true,
  // Keep MCP SDK external as it's a runtime dependency
  // Keep CommonJS modules external that don't bundle well with ESM
  external: [
    "@modelcontextprotocol/sdk",
    "gray-matter",
    "js-yaml",
    "ajv",
    "pacote"
  ],
  noExternal: ["@codemcp/skills-core"],
  target: "node20",
  sourcemap: false
});
