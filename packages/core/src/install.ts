/**
 * Install-related types for @codemcp/skills-core.
 *
 * These types are intentionally kept separate from the main entry point because
 * they reflect CLI/installer concerns (Vercel subtree logic) rather than the
 * core parsing, validation, and registry APIs.
 *
 * Import via: import type { InstallResult } from "@codemcp/skills-core/install"
 */
export type {
  InstallErrorCode,
  InstallError,
  SkillManifest,
  InstallSuccess,
  InstallFailure,
  InstallResult,
  InstallAllResult
} from "./types.js";
