/**
 * Programmatic API for @codemcp/skills.
 *
 * Exposes the core install/add functionality for integration into other tools,
 * without going through the interactive CLI. Import from "@codemcp/skills/api".
 *
 * This file only re-exports from existing modules — no logic lives here.
 * On Vercel CLI upgrades, this file is unaffected by merge conflicts.
 */

// Add a skill and write it to skills-lock.json
export { runAdd, parseAddOptions, type AddOptions } from './add.ts';

// Install all skills declared in skills-lock.json
export { runInstallFromLock } from './install.ts';

// Read/write the project-level skills-lock.json directly
export {
  readLocalLock,
  writeLocalLock,
  getLocalLockPath,
  addSkillToLocalLock,
  removeSkillFromLocalLock,
  computeSkillFolderHash,
  type LocalSkillLockFile,
  type LocalSkillLockEntry,
} from './local-lock.ts';

// Core skill parsing, validation, and registry — re-exported so consumers
// only need to install @codemcp/skills (not @codemcp/skills-core separately).
export {
  parseSkill,
  parseSkillContent,
  validateSkill,
  SkillRegistry,
  loadSkillsLock,
  getAllowedSkills,
  getAllowedSkillsFromProject,
  getAllowedSkillsFromAgentskills,
} from '@codemcp/skills-core';
export type {
  Skill,
  SkillMetadata,
  ParseResult,
  ParseSuccess,
  ParseFailure,
  ParseError,
  ParseErrorCode,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  LoadResult,
  RegistryState,
} from '@codemcp/skills-core';
export type {
  InstallResult,
  InstallSuccess,
  InstallFailure,
  InstallError,
  InstallErrorCode,
  InstallAllResult,
  SkillManifest,
} from '@codemcp/skills-core/install';
