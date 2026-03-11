/**
 * SkillRegistry Component
 *
 * Responsibility: In-memory skill storage with Map-based O(1) lookups.
 * Load skills from a single directory with strict fail-fast behavior.
 *
 * Expected structure: <skillsDir>/<skill-name>/SKILL.md (exactly 2 levels deep)
 * Throws errors on any misconfiguration (no partial failures).
 */

import { promises as fs } from "fs";
import { join, basename } from "path";
import { parseSkill } from "./parser.js";
import { validateSkill } from "./validator.js";
import type {
  Skill,
  SkillMetadata,
  LoadResult,
  RegistryState
} from "./types.js";

/**
 * Create a placeholder skill for an invalid/unloadable SKILL.md.
 * The placeholder instructs the agent to inform the user of the problem.
 */
function makeInvalidSkillPlaceholder(
  dirName: string,
  sourcePath: string,
  errors: string
): Skill {
  return Object.freeze({
    metadata: Object.freeze({
      name: dirName,
      description:
        "[INVALID] This skill failed validation and cannot be applied"
    } as SkillMetadata),
    body: `This skill is invalid and cannot be applied.\n\nValidation errors:\n${errors}\n\nPlease inform the user that the skill at \`${sourcePath}\` is invalid and needs to be fixed before it can be used.`
  });
}

/**
 * In-memory registry for managing agent skills
 *
 * Features:
 * - O(1) skill lookups using Map
 * - Load skills from single or multiple directories
 * - Expected structure: <skillsDir>/<skill-name>/SKILL.md
 * - Validates directory name matches skill name
 * - Immutable skill objects
 * - Support for merging skills from local and global directories
 */
export class SkillRegistry {
  private skills: Map<string, { skill: Skill; sourcePath: string }> = new Map();
  private skillsDir: string = "";
  private skillsDirs: string[] = [];
  private lastLoaded?: Date;

  /**
   * Load skills from multiple directories with optional filtering
   *
   * Loads skills from each directory in order, with later directories
   * overriding skills from earlier ones. Supports optional filtering
   * to only include skills specified in an allow list.
   *
   * Expected structure: <skillsDir>/<skill-name>/SKILL.md (exactly 2 levels deep)
   * - Throws on first required directory error (fail fast)
   * - Skips non-existent optional directories (2nd onwards)
   * - Ignores hidden directories (.git/, etc.)
   * - Ignores non-directory files
   * - Validates directory name matches skill name in SKILL.md
   *
   * @param skillsDirs - Array of directories containing skill subdirectories
   * @param allowedSkills - Optional set of skill names to include. If provided, only these skills are loaded.
   * @param requiredLabels - Optional set of labels. If provided, only skills that have at least one matching label are loaded.
   * @returns Load result with count, directories, and timestamp
   * @throws Error if first directory is invalid or any skill is invalid
   */
  async loadSkillsFromMultiple(
    skillsDirs: string[],
    allowedSkills?: Set<string>,
    requiredLabels?: Set<string>
  ): Promise<LoadResult> {
    // Clear existing skills
    this.skills.clear();
    this.skillsDir = "";
    this.skillsDirs = [];

    let totalLoaded = 0;

    // Load skills from each directory
    for (let i = 0; i < skillsDirs.length; i++) {
      const skillsDir = skillsDirs[i];
      const isRequired = i === 0; // First directory is always required
      totalLoaded += await this.loadSkillsFromDirectory(
        skillsDir,
        allowedSkills,
        isRequired,
        requiredLabels
      );
    }

    // Update state
    this.skillsDirs = skillsDirs;
    this.skillsDir = skillsDirs[0] || "";
    this.lastLoaded = new Date();

    return {
      loaded: totalLoaded,
      skillsDir: this.skillsDirs.join(":"),
      timestamp: this.lastLoaded
    };
  }

  /**
   * Load skills from a single directory (internal helper)
   *
   * @param skillsDir - Directory containing skill subdirectories
   * @param allowedSkills - Optional set of skill names to include
   * @param isRequired - Whether this directory is required (first directory always is)
   * @param requiredLabels - Optional set of labels. If provided, only skills with at least one matching label are loaded.
   * @returns Number of skills loaded from this directory
   * @throws Error if directory is invalid and required
   */
  private async loadSkillsFromDirectory(
    skillsDir: string,
    allowedSkills?: Set<string>,
    isRequired: boolean = true,
    requiredLabels?: Set<string>
  ): Promise<number> {
    // 1. Check if skillsDir exists
    let stat;
    try {
      stat = await fs.stat(skillsDir);
    } catch {
      // If required, always throw
      if (isRequired) {
        throw new Error(`Skills directory does not exist: ${skillsDir}`);
      }
      // Optional directory - just skip it (silently)
      return 0;
    }

    // 2. Check if it's a directory
    if (!stat.isDirectory()) {
      throw new Error(`Skills directory is not a directory: ${skillsDir}`);
    }

    // 3. Read immediate subdirectories (depth 1 only)
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });

    let loadedCount = 0;

    // 4. Process each subdirectory
    for (const entry of entries) {
      // Skip non-directories
      if (!entry.isDirectory()) {
        continue;
      }

      // Skip hidden directories
      if (entry.name.startsWith(".")) {
        continue;
      }

      // Skip if not in allowed list
      if (allowedSkills && !allowedSkills.has(entry.name)) {
        continue;
      }

      const skillDir = join(skillsDir, entry.name);
      const skillPath = join(skillDir, "SKILL.md");

      // Check for SKILL.md
      let skillStat;
      try {
        skillStat = await fs.stat(skillPath);
      } catch {
        throw new Error(`Missing SKILL.md in: ${skillDir}`);
      }

      // Verify SKILL.md is a file
      if (!skillStat.isFile()) {
        throw new Error(`Missing SKILL.md in: ${skillDir}`);
      }

      // Parse SKILL.md
      const parseResult = await parseSkill(skillPath);

      if (!parseResult.success) {
        throw new Error(
          `Failed to parse SKILL.md in ${skillDir}: ${parseResult.error.message}`
        );
      }

      const { skill } = parseResult;

      // Validate the skill
      const validationResult = validateSkill(skill);

      if (!validationResult.valid) {
        const errorMessages = validationResult.errors
          .map((e) => e.message)
          .join(", ");
        const dirName = basename(skillDir);
        const placeholder = makeInvalidSkillPlaceholder(
          dirName,
          skillPath,
          errorMessages
        );
        this.skills.set(dirName, { skill: placeholder, sourcePath: skillPath });
        loadedCount++;
        continue;
      }

      // Verify directory name matches skill name
      const dirName = basename(skillDir);
      if (skill.metadata.name !== dirName) {
        throw new Error(
          `Directory name '${dirName}' does not match skill name '${skill.metadata.name}' in ${skillPath}`
        );
      }

      // Filter by required labels: skip skills that don't have at least one matching label
      if (requiredLabels && requiredLabels.size > 0) {
        const skillLabels = skill.metadata.labels;
        if (
          !skillLabels ||
          !skillLabels.some((label) => requiredLabels.has(label))
        ) {
          continue;
        }
      }

      // Store the skill (later directories override earlier ones)
      this.skills.set(skill.metadata.name, { skill, sourcePath: skillPath });
      loadedCount++;
    }

    return loadedCount;
  }

  /**
   * Load skills from a single directory with strict error handling
   *
   * Expected structure: <skillsDir>/<skill-name>/SKILL.md (exactly 2 levels deep)
   * - Throws on any error (fail fast)
   * - Ignores hidden directories (.git/, etc.)
   * - Ignores non-directory files
   * - Validates directory name matches skill name in SKILL.md
   *
   * @param skillsDir - Directory containing skill subdirectories
   * @returns Load result with count, directory, and timestamp
   * @throws Error if directory doesn't exist, isn't a directory, or any skill is invalid
   */
  async loadSkills(skillsDir: string): Promise<LoadResult> {
    // Clear existing skills
    this.skills.clear();
    this.skillsDir = "";
    this.skillsDirs = [];

    // 1. Check if skillsDir exists
    let stat;
    try {
      stat = await fs.stat(skillsDir);
    } catch {
      throw new Error(`Skills directory does not exist: ${skillsDir}`);
    }

    // 2. Check if it's a directory
    if (!stat.isDirectory()) {
      throw new Error(`Skills directory is not a directory: ${skillsDir}`);
    }

    // 3. Read immediate subdirectories (depth 1 only)
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });

    let loadedCount = 0;

    // 4. Process each subdirectory
    for (const entry of entries) {
      // Skip non-directories
      if (!entry.isDirectory()) {
        continue;
      }

      // Skip hidden directories
      if (entry.name.startsWith(".")) {
        continue;
      }

      const skillDir = join(skillsDir, entry.name);
      const skillPath = join(skillDir, "SKILL.md");

      // Check for SKILL.md
      let skillStat;
      try {
        skillStat = await fs.stat(skillPath);
      } catch {
        throw new Error(`Missing SKILL.md in: ${skillDir}`);
      }

      // Verify SKILL.md is a file
      if (!skillStat.isFile()) {
        throw new Error(`Missing SKILL.md in: ${skillDir}`);
      }

      // Parse SKILL.md
      const parseResult = await parseSkill(skillPath);

      if (!parseResult.success) {
        throw new Error(
          `Failed to parse SKILL.md in ${skillDir}: ${parseResult.error.message}`
        );
      }

      const { skill } = parseResult;

      // Validate the skill
      const validationResult = validateSkill(skill);

      if (!validationResult.valid) {
        const errorMessages = validationResult.errors
          .map((e) => e.message)
          .join(", ");
        const dirName = basename(skillDir);
        const placeholder = makeInvalidSkillPlaceholder(
          dirName,
          skillPath,
          errorMessages
        );
        this.skills.set(dirName, { skill: placeholder, sourcePath: skillPath });
        loadedCount++;
        continue;
      }

      // Verify directory name matches skill name
      const dirName = basename(skillDir);
      if (skill.metadata.name !== dirName) {
        throw new Error(
          `Directory name '${dirName}' does not match skill name '${skill.metadata.name}' in ${skillPath}`
        );
      }

      // Store the skill
      this.skills.set(skill.metadata.name, { skill, sourcePath: skillPath });
      loadedCount++;
    }

    // Update state
    this.skillsDir = skillsDir;
    this.skillsDirs = [skillsDir];
    this.lastLoaded = new Date();

    return {
      loaded: loadedCount,
      skillsDir: skillsDir,
      timestamp: this.lastLoaded
    };
  }

  /**
   * Get a skill by name
   *
   * @param name - The skill name
   * @returns The skill or undefined if not found
   */
  getSkill(name: string): Skill | undefined {
    const entry = this.skills.get(name);
    if (!entry) {
      return undefined;
    }

    // Return a deep copy to maintain immutability
    return {
      metadata: { ...entry.skill.metadata },
      body: entry.skill.body
    };
  }

  /**
   * Get all loaded skills
   *
   * @returns Array of all skills
   */
  getAllSkills(): Skill[] {
    return Array.from(this.skills.values()).map((entry) => ({
      metadata: { ...entry.skill.metadata },
      body: entry.skill.body
    }));
  }

  /**
   * Get skill metadata without body content
   *
   * @param name - The skill name
   * @returns The skill metadata or undefined if not found
   */
  getSkillMetadata(name: string): SkillMetadata | undefined {
    const entry = this.skills.get(name);
    if (!entry) {
      return undefined;
    }

    return { ...entry.skill.metadata };
  }

  /**
   * Get all skill metadata without body content
   *
   * @returns Array of all skill metadata
   */
  getAllMetadata(): SkillMetadata[] {
    return Array.from(this.skills.values()).map((entry) => ({
      ...entry.skill.metadata
    }));
  }

  /**
   * Get current registry state
   *
   * @returns Current state with counts and source info
   */
  getState(): RegistryState {
    return {
      skillCount: this.skills.size,
      skillsDir: this.skillsDir,
      lastLoaded: this.lastLoaded
    };
  }

  /**
   * Get the skills directory (base path for resolving relative references)
   *
   * @returns Absolute path to the skills directory, or empty string if no skills loaded
   */
  getSkillsDirectory(): string {
    return this.skillsDir;
  }
}
