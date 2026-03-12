import js from "@eslint/js";
import { parser, configs } from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default [
  js.configs.recommended,
  ...configs.recommended,
  prettier,
  {
    // Config for TypeScript files
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser,
      parserOptions: {
        project: ["./tsconfig.json"]
      }
    }
  },
  {
    // Relaxed rules for test files
    files: [
      "**/__tests__/**/*.{ts,tsx}",
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}"
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off"
    }
  },
  {
    // Config for JavaScript files - no TypeScript parsing
    files: ["**/*.{js,jsx}"],
    ...js.configs.recommended
  },
  {
    // Ignored files
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      ".pnpm-store/**",
      "pnpm-lock.yaml",
      "**/*.d.ts", // Type definition files don't need runtime linting
      "tsup.config.ts", // Build config, not part of tsconfig project
      "vitest.config.ts" // Test config, not part of tsconfig project
    ]
  }
];
