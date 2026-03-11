import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { SkillRegistry } from "../registry.js";
import type {
  LoadResult,
  RegistryState,
  Skill,
  SkillMetadata
} from "../types.js";

/**
 * Test suite for simplified SkillRegistry (TDD RED phase)
 *
 * New simplified model:
 * - Single directory path (not SkillSource array)
 * - Expects <skill-name>/SKILL.md structure (exactly 2 levels deep)
 * - STRICT: Throws errors on misconfiguration (fail fast)
 * - No multi-source, no priority, no partial failures
 *
 * Test coverage (~22 tests):
 * 1. Basic Loading (5 tests)
 * 2. Strict Error Handling (8 tests)
 * 3. Directory Structure (4 tests)
 * 4. Edge Cases (3 tests)
 * 5. State Management (2 tests)
 */

/**
 * Helper: Create a temp directory for test isolation
 */
async function createTempDir(): Promise<string> {
  const tempPath = join(
    tmpdir(),
    `skill-registry-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await fs.mkdir(tempPath, { recursive: true });
  return tempPath;
}

/**
 * Helper: Clean up temp directory
 */
async function cleanupTempDir(path: string): Promise<void> {
  try {
    await fs.rm(path, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Helper: Create a skill with SKILL.md in subdirectory
 */
async function createSkill(
  baseDir: string,
  skillName: string,
  content: string
): Promise<string> {
  const skillDir = join(baseDir, skillName);
  await fs.mkdir(skillDir, { recursive: true });
  const skillPath = join(skillDir, "SKILL.md");
  await fs.writeFile(skillPath, content, "utf-8");
  return skillPath;
}

/**
 * Helper: Create nested directories (scripts/, references/)
 */
async function createNestedDir(
  skillDir: string,
  nestedDirName: string
): Promise<string> {
  const nestedPath = join(skillDir, nestedDirName);
  await fs.mkdir(nestedPath, { recursive: true });
  return nestedPath;
}

/**
 * Helper: Get basic skill content
 */
function getBasicSkillContent(name: string, description: string): string {
  return `---
name: ${name}
description: ${description}
---

# ${name}

This is a test skill.
`;
}

/**
 * Helper: Get invalid skill content (missing required field)
 */
function getInvalidSkillContent(missingField: "name" | "description"): string {
  if (missingField === "name") {
    return `---
description: A skill without a name
---

# Invalid Skill

This skill is missing the name field.
`;
  } else {
    return `---
name: invalid-skill
---

# Invalid Skill

This skill is missing the description field.
`;
  }
}

describe("SkillRegistry - Simplified Model", () => {
  let tempDirs: string[] = [];

  /**
   * Clean up all temp directories after each test
   */
  afterEach(async () => {
    for (const dir of tempDirs) {
      await cleanupTempDir(dir);
    }
    tempDirs = [];
  });

  describe("Basic Loading", () => {
    it("should load skills from valid directory structure", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkill(
        tempDir,
        "test-skill-1",
        getBasicSkillContent("test-skill-1", "First test skill")
      );
      await createSkill(
        tempDir,
        "test-skill-2",
        getBasicSkillContent("test-skill-2", "Second test skill")
      );

      // Act
      const result = await registry.loadSkills(tempDir);

      // Assert
      expect(result.loaded).toBe(2);
      expect(result.skillsDir).toBe(tempDir);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should get skill by name", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkill(
        tempDir,
        "test-skill-1",
        getBasicSkillContent("test-skill-1", "First test skill")
      );

      await registry.loadSkills(tempDir);

      // Act
      const skill = registry.getSkill("test-skill-1");

      // Assert
      expect(skill).toBeDefined();
      expect(skill?.metadata.name).toBe("test-skill-1");
      expect(skill?.metadata.description).toBe("First test skill");
      expect(skill?.body).toContain("# test-skill-1");
    });

    it("should get all skills", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkill(
        tempDir,
        "test-skill-1",
        getBasicSkillContent("test-skill-1", "First test skill")
      );
      await createSkill(
        tempDir,
        "test-skill-2",
        getBasicSkillContent("test-skill-2", "Second test skill")
      );

      await registry.loadSkills(tempDir);

      // Act
      const skills = registry.getAllSkills();

      // Assert
      expect(skills).toHaveLength(2);
      const names = skills.map((s: Skill) => s.metadata.name);
      expect(names).toContain("test-skill-1");
      expect(names).toContain("test-skill-2");
    });

    it("should get skill metadata", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkill(
        tempDir,
        "test-skill-1",
        getBasicSkillContent("test-skill-1", "First test skill")
      );

      await registry.loadSkills(tempDir);

      // Act
      const metadata = registry.getSkillMetadata("test-skill-1");

      // Assert
      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe("test-skill-1");
      expect(metadata?.description).toBe("First test skill");
    });

    it("should get registry state", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkill(
        tempDir,
        "test-skill-1",
        getBasicSkillContent("test-skill-1", "First test skill")
      );
      await createSkill(
        tempDir,
        "test-skill-2",
        getBasicSkillContent("test-skill-2", "Second test skill")
      );

      // Act
      await registry.loadSkills(tempDir);
      const state = registry.getState();

      // Assert
      expect(state.skillCount).toBe(2);
      expect(state.skillsDir).toBe(tempDir);
      expect(state.lastLoaded).toBeInstanceOf(Date);
    });
  });

  describe("Strict Error Handling", () => {
    it("should throw if skillsDir does not exist", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const nonExistentPath = join(tmpdir(), "non-existent-dir-" + Date.now());

      // Act & Assert
      await expect(registry.loadSkills(nonExistentPath)).rejects.toThrow();
    });

    it("should throw if skillsDir is a file (not directory)", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      const filePath = join(tempDir, "not-a-directory.txt");
      await fs.writeFile(filePath, "This is a file", "utf-8");

      // Act & Assert
      await expect(registry.loadSkills(filePath)).rejects.toThrow();
    });

    it("should throw if subdirectory missing SKILL.md", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      // Create subdirectory without SKILL.md
      const skillDir = join(tempDir, "incomplete-skill");
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(join(skillDir, "README.md"), "# README", "utf-8");

      // Act & Assert
      await expect(registry.loadSkills(tempDir)).rejects.toThrow();
    });

    it("should throw if SKILL.md has invalid frontmatter", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      const skillDir = join(tempDir, "invalid-skill");
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        join(skillDir, "SKILL.md"),
        "---\ninvalid: yaml: content:\n---\n\n# Invalid",
        "utf-8"
      );

      // Act & Assert
      await expect(registry.loadSkills(tempDir)).rejects.toThrow();
    });

    it("should throw if SKILL.md missing required fields", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkill(
        tempDir,
        "invalid-skill",
        getInvalidSkillContent("name")
      );

      // Act & Assert
      await expect(registry.loadSkills(tempDir)).rejects.toThrow();
    });

    it("should register a placeholder skill if validation fails (invalid name format)", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkill(
        tempDir,
        "invalid-skill",
        getBasicSkillContent(
          "Invalid Skill!",
          "Invalid name with spaces and exclamation"
        )
      );

      // Act — should NOT throw; instead registers a placeholder
      const result = await registry.loadSkills(tempDir);

      // Assert: placeholder is registered under the directory name
      expect(result.loaded).toBe(1);
      const placeholder = registry.getSkill("invalid-skill");
      expect(placeholder).toBeDefined();
      expect(placeholder?.metadata.description).toContain("[INVALID]");
      expect(placeholder?.body).toContain("invalid");
      expect(placeholder?.body).toContain("inform the user");
    });

    it("should throw if subdirectory is empty", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      // Create empty subdirectory
      const emptyDir = join(tempDir, "empty-skill");
      await fs.mkdir(emptyDir, { recursive: true });

      // Act & Assert
      await expect(registry.loadSkills(tempDir)).rejects.toThrow();
    });

    it("should throw if SKILL.md is empty", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      const skillDir = join(tempDir, "empty-skill");
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(join(skillDir, "SKILL.md"), "", "utf-8");

      // Act & Assert
      await expect(registry.loadSkills(tempDir)).rejects.toThrow();
    });
  });

  describe("Directory Structure", () => {
    it("should load from skill-name/SKILL.md pattern", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkill(
        tempDir,
        "my-skill",
        getBasicSkillContent("my-skill", "A test skill")
      );

      // Act
      const result = await registry.loadSkills(tempDir);

      // Assert
      expect(result.loaded).toBe(1);
      const skill = registry.getSkill("my-skill");
      expect(skill).toBeDefined();
    });

    it("should ignore nested directories (scripts/, references/)", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      // Create valid skill
      const skillDir = join(tempDir, "my-skill");
      await createSkill(
        tempDir,
        "my-skill",
        getBasicSkillContent("my-skill", "A test skill")
      );

      // Create nested directories with files
      await createNestedDir(skillDir, "scripts");
      await fs.writeFile(
        join(skillDir, "scripts", "helper.sh"),
        "#!/bin/bash",
        "utf-8"
      );

      await createNestedDir(skillDir, "references");
      await fs.writeFile(
        join(skillDir, "references", "doc.md"),
        "# Documentation",
        "utf-8"
      );

      // Act
      const result = await registry.loadSkills(tempDir);

      // Assert
      expect(result.loaded).toBe(1);
      const skills = registry.getAllSkills();
      expect(skills).toHaveLength(1);
    });

    it("should handle multiple skills in separate subdirectories", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkill(
        tempDir,
        "skill-one",
        getBasicSkillContent("skill-one", "First skill")
      );
      await createSkill(
        tempDir,
        "skill-two",
        getBasicSkillContent("skill-two", "Second skill")
      );
      await createSkill(
        tempDir,
        "skill-three",
        getBasicSkillContent("skill-three", "Third skill")
      );

      // Act
      const result = await registry.loadSkills(tempDir);

      // Assert
      expect(result.loaded).toBe(3);
      expect(registry.getSkill("skill-one")).toBeDefined();
      expect(registry.getSkill("skill-two")).toBeDefined();
      expect(registry.getSkill("skill-three")).toBeDefined();
    });

    it("should return empty registry for empty skillsDir (no subdirectories)", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      // Act
      const result = await registry.loadSkills(tempDir);

      // Assert
      expect(result.loaded).toBe(0);
      expect(result.skillsDir).toBe(tempDir);
      expect(registry.getAllSkills()).toEqual([]);
    });
  });

  describe("Edge Cases", () => {
    it("should ignore hidden subdirectories (.git/)", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      // Create valid skill
      await createSkill(
        tempDir,
        "my-skill",
        getBasicSkillContent("my-skill", "A test skill")
      );

      // Create hidden directory with SKILL.md
      const hiddenDir = join(tempDir, ".git");
      await fs.mkdir(hiddenDir, { recursive: true });
      await fs.writeFile(
        join(hiddenDir, "SKILL.md"),
        getBasicSkillContent("hidden-skill", "Hidden skill"),
        "utf-8"
      );

      // Act
      const result = await registry.loadSkills(tempDir);

      // Assert
      expect(result.loaded).toBe(1);
      expect(registry.getSkill("my-skill")).toBeDefined();
      expect(registry.getSkill("hidden-skill")).toBeUndefined();
    });

    it("should ignore non-directory files in skillsDir", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      // Create valid skill
      await createSkill(
        tempDir,
        "my-skill",
        getBasicSkillContent("my-skill", "A test skill")
      );

      // Create files in root skillsDir
      await fs.writeFile(join(tempDir, "README.md"), "# README", "utf-8");
      await fs.writeFile(join(tempDir, "notes.txt"), "Notes", "utf-8");

      // Act
      const result = await registry.loadSkills(tempDir);

      // Assert
      expect(result.loaded).toBe(1);
      expect(registry.getSkill("my-skill")).toBeDefined();
    });

    it("should verify skill name from directory name matches SKILL.md name", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      // Create skill with mismatched directory and metadata name
      const skillDir = join(tempDir, "directory-name");
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        join(skillDir, "SKILL.md"),
        getBasicSkillContent("different-name", "Mismatched name"),
        "utf-8"
      );

      // Act & Assert
      // Should throw because directory name doesn't match skill name
      await expect(registry.loadSkills(tempDir)).rejects.toThrow();
    });
  });

  describe("State Management", () => {
    it("should record timestamp on load", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkill(
        tempDir,
        "test-skill",
        getBasicSkillContent("test-skill", "Test skill")
      );

      const beforeLoad = new Date();

      // Act
      const result = await registry.loadSkills(tempDir);
      const state = registry.getState();

      const afterLoad = new Date();

      // Assert
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(state.lastLoaded).toBeInstanceOf(Date);
      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(
        beforeLoad.getTime()
      );
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(
        afterLoad.getTime()
      );
    });

    it("should reflect loaded skills count and directory in state", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkill(
        tempDir,
        "skill-1",
        getBasicSkillContent("skill-1", "First skill")
      );
      await createSkill(
        tempDir,
        "skill-2",
        getBasicSkillContent("skill-2", "Second skill")
      );
      await createSkill(
        tempDir,
        "skill-3",
        getBasicSkillContent("skill-3", "Third skill")
      );

      // Act
      await registry.loadSkills(tempDir);
      const state = registry.getState();

      // Assert
      expect(state.skillCount).toBe(3);
      expect(state.skillsDir).toBe(tempDir);
      expect(state.lastLoaded).toBeInstanceOf(Date);
    });

    it("should expose skills directory via getSkillsDirectory()", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkill(
        tempDir,
        "test-skill",
        getBasicSkillContent("test-skill", "Test skill")
      );

      // Act
      await registry.loadSkills(tempDir);
      const skillsDir = registry.getSkillsDirectory();

      // Assert
      expect(skillsDir).toBe(tempDir);
    });

    it("should return empty string when no skills loaded", async () => {
      // Arrange
      const registry = new SkillRegistry();

      // Act
      const skillsDir = registry.getSkillsDirectory();

      // Assert
      expect(skillsDir).toBe("");
    });
  });

  describe("loadSkillsFromMultiple", () => {
    let tempDir1: string;
    let tempDir2: string;

    beforeEach(async () => {
      tempDir1 = await createTempDir();
      tempDir2 = await createTempDir();
    });

    afterEach(async () => {
      await cleanupTempDir(tempDir1);
      await cleanupTempDir(tempDir2);
    });

    it("should load skills from multiple directories", async () => {
      // Arrange
      const registry = new SkillRegistry();

      // Create skills in first directory
      await createSkill(
        tempDir1,
        "skill-1",
        getBasicSkillContent("skill-1", "First skill")
      );

      // Create skills in second directory
      await createSkill(
        tempDir2,
        "skill-2",
        getBasicSkillContent("skill-2", "Second skill")
      );

      // Act
      const result = await registry.loadSkillsFromMultiple([
        tempDir1,
        tempDir2
      ]);

      // Assert
      expect(result.loaded).toBe(2);
      expect(registry.getSkill("skill-1")).toBeDefined();
      expect(registry.getSkill("skill-2")).toBeDefined();
      expect(registry.getAllMetadata()).toHaveLength(2);
    });

    it("should allow later directories to override earlier ones", async () => {
      // Arrange
      const registry = new SkillRegistry();

      // Create skill with same name in both directories
      const skillContent1 = `---
name: shared-skill
description: First version
---

First version of skill`;

      const skillContent2 = `---
name: shared-skill
description: Second version
---

Second version of skill`;

      await createSkill(tempDir1, "shared-skill", skillContent1);
      await createSkill(tempDir2, "shared-skill", skillContent2);

      // Act
      const result = await registry.loadSkillsFromMultiple([
        tempDir1,
        tempDir2
      ]);

      // Assert
      expect(result.loaded).toBe(2); // Loaded from both directories
      expect(registry.getAllMetadata()).toHaveLength(1); // But only one unique skill
      const skill = registry.getSkill("shared-skill");
      expect(skill?.metadata.description).toBe("Second version");
      expect(skill?.body).toContain("Second version of skill");
    });

    it("should filter skills based on allowed set", async () => {
      // Arrange
      const registry = new SkillRegistry();

      await createSkill(
        tempDir1,
        "skill-1",
        getBasicSkillContent("skill-1", "First skill")
      );
      await createSkill(
        tempDir1,
        "skill-2",
        getBasicSkillContent("skill-2", "Second skill")
      );

      // Act
      const result = await registry.loadSkillsFromMultiple(
        [tempDir1],
        new Set(["skill-1"]) // Only allow skill-1
      );

      // Assert
      expect(result.loaded).toBe(1);
      expect(registry.getSkill("skill-1")).toBeDefined();
      expect(registry.getSkill("skill-2")).toBeUndefined();
      expect(registry.getAllMetadata()).toHaveLength(1);
    });

    it("should skip non-existent optional (global) directories", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const nonExistentDir = join(
        tmpdir(),
        `non-existent-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );

      await createSkill(
        tempDir1,
        "skill-1",
        getBasicSkillContent("skill-1", "First skill")
      );

      // Act
      const result = await registry.loadSkillsFromMultiple([
        tempDir1,
        nonExistentDir
      ]);

      // Assert
      expect(result.loaded).toBe(1);
      expect(registry.getSkill("skill-1")).toBeDefined();
    });

    it("should throw on missing local directory (first directory)", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const nonExistentDir = join(
        tmpdir(),
        `non-existent-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );

      // Act & Assert
      await expect(
        registry.loadSkillsFromMultiple([nonExistentDir])
      ).rejects.toThrow(/does not exist/);
    });

    it("should combine filtering with multiple directories", async () => {
      // Arrange
      const registry = new SkillRegistry();

      await createSkill(
        tempDir1,
        "skill-1",
        getBasicSkillContent("skill-1", "First skill")
      );
      await createSkill(
        tempDir1,
        "skill-2",
        getBasicSkillContent("skill-2", "Second skill")
      );
      await createSkill(
        tempDir2,
        "skill-3",
        getBasicSkillContent("skill-3", "Third skill")
      );

      // Act
      const result = await registry.loadSkillsFromMultiple(
        [tempDir1, tempDir2],
        new Set(["skill-1", "skill-3"]) // Only allow skill-1 and skill-3
      );

      // Assert
      expect(result.loaded).toBe(2);
      expect(registry.getSkill("skill-1")).toBeDefined();
      expect(registry.getSkill("skill-2")).toBeUndefined();
      expect(registry.getSkill("skill-3")).toBeDefined();
    });
  });

  describe("Label-based filtering", () => {
    let tempDir1: string;
    let tempDir2: string;

    beforeEach(async () => {
      tempDir1 = await createTempDir();
      tempDir2 = await createTempDir();
    });

    afterEach(async () => {
      await cleanupTempDir(tempDir1);
      await cleanupTempDir(tempDir2);
    });

    function getSkillContentWithLabels(
      name: string,
      description: string,
      labels: string[]
    ): string {
      const labelsYaml = labels.map((l) => `  - ${l}`).join("\n");
      return `---
name: ${name}
description: ${description}
labels:
${labelsYaml}
---

# ${name}

This is a test skill.
`;
    }

    it("should load all skills when no requiredLabels are provided", async () => {
      const registry = new SkillRegistry();

      await createSkill(
        tempDir1,
        "skill-a",
        getSkillContentWithLabels("skill-a", "Skill A", ["frontend", "react"])
      );
      await createSkill(
        tempDir1,
        "skill-b",
        getSkillContentWithLabels("skill-b", "Skill B", ["backend"])
      );

      const result = await registry.loadSkillsFromMultiple([tempDir1]);

      expect(result.loaded).toBe(2);
      expect(registry.getSkill("skill-a")).toBeDefined();
      expect(registry.getSkill("skill-b")).toBeDefined();
    });

    it("should filter skills by required labels", async () => {
      const registry = new SkillRegistry();

      await createSkill(
        tempDir1,
        "skill-a",
        getSkillContentWithLabels("skill-a", "Skill A", ["frontend", "react"])
      );
      await createSkill(
        tempDir1,
        "skill-b",
        getSkillContentWithLabels("skill-b", "Skill B", ["backend"])
      );
      await createSkill(
        tempDir1,
        "skill-c",
        getBasicSkillContent("skill-c", "Skill C without labels")
      );

      const result = await registry.loadSkillsFromMultiple(
        [tempDir1],
        undefined,
        new Set(["frontend"])
      );

      expect(result.loaded).toBe(1);
      expect(registry.getSkill("skill-a")).toBeDefined();
      expect(registry.getSkill("skill-b")).toBeUndefined();
      expect(registry.getSkill("skill-c")).toBeUndefined();
    });

    it("should include skills matching any of the required labels (OR logic)", async () => {
      const registry = new SkillRegistry();

      await createSkill(
        tempDir1,
        "skill-a",
        getSkillContentWithLabels("skill-a", "Skill A", ["frontend"])
      );
      await createSkill(
        tempDir1,
        "skill-b",
        getSkillContentWithLabels("skill-b", "Skill B", ["backend"])
      );
      await createSkill(
        tempDir1,
        "skill-c",
        getSkillContentWithLabels("skill-c", "Skill C", ["devops"])
      );

      const result = await registry.loadSkillsFromMultiple(
        [tempDir1],
        undefined,
        new Set(["frontend", "backend"])
      );

      expect(result.loaded).toBe(2);
      expect(registry.getSkill("skill-a")).toBeDefined();
      expect(registry.getSkill("skill-b")).toBeDefined();
      expect(registry.getSkill("skill-c")).toBeUndefined();
    });

    it("should exclude skills without labels when requiredLabels is set", async () => {
      const registry = new SkillRegistry();

      await createSkill(
        tempDir1,
        "skill-a",
        getSkillContentWithLabels("skill-a", "Skill A", ["frontend"])
      );
      await createSkill(
        tempDir1,
        "skill-b",
        getBasicSkillContent("skill-b", "Skill B without labels")
      );

      const result = await registry.loadSkillsFromMultiple(
        [tempDir1],
        undefined,
        new Set(["frontend"])
      );

      expect(result.loaded).toBe(1);
      expect(registry.getSkill("skill-a")).toBeDefined();
      expect(registry.getSkill("skill-b")).toBeUndefined();
    });

    it("should combine allowedSkills and requiredLabels filtering", async () => {
      const registry = new SkillRegistry();

      await createSkill(
        tempDir1,
        "skill-a",
        getSkillContentWithLabels("skill-a", "Skill A", ["frontend"])
      );
      await createSkill(
        tempDir1,
        "skill-b",
        getSkillContentWithLabels("skill-b", "Skill B", ["frontend"])
      );
      await createSkill(
        tempDir1,
        "skill-c",
        getSkillContentWithLabels("skill-c", "Skill C", ["backend"])
      );

      const result = await registry.loadSkillsFromMultiple(
        [tempDir1],
        new Set(["skill-a", "skill-c"]), // only allow a and c
        new Set(["frontend"]) // only frontend label
      );

      // skill-a: allowed + has frontend label -> included
      // skill-b: not allowed -> excluded by allowedSkills
      // skill-c: allowed but has backend label -> excluded by requiredLabels
      expect(result.loaded).toBe(1);
      expect(registry.getSkill("skill-a")).toBeDefined();
      expect(registry.getSkill("skill-b")).toBeUndefined();
      expect(registry.getSkill("skill-c")).toBeUndefined();
    });

    it("should work with label filtering across multiple directories", async () => {
      const registry = new SkillRegistry();

      await createSkill(
        tempDir1,
        "skill-a",
        getSkillContentWithLabels("skill-a", "Skill A", ["frontend"])
      );
      await createSkill(
        tempDir2,
        "skill-b",
        getSkillContentWithLabels("skill-b", "Skill B", ["frontend"])
      );

      const result = await registry.loadSkillsFromMultiple(
        [tempDir1, tempDir2],
        undefined,
        new Set(["frontend"])
      );

      expect(result.loaded).toBe(2);
      expect(registry.getSkill("skill-a")).toBeDefined();
      expect(registry.getSkill("skill-b")).toBeDefined();
    });

    it("should return empty result when no skills match the required labels", async () => {
      const registry = new SkillRegistry();

      await createSkill(
        tempDir1,
        "skill-a",
        getSkillContentWithLabels("skill-a", "Skill A", ["backend"])
      );

      const result = await registry.loadSkillsFromMultiple(
        [tempDir1],
        undefined,
        new Set(["frontend"])
      );

      expect(result.loaded).toBe(0);
      expect(registry.getAllSkills()).toHaveLength(0);
    });

    it("should preserve labels in skill metadata after loading", async () => {
      const registry = new SkillRegistry();

      await createSkill(
        tempDir1,
        "skill-a",
        getSkillContentWithLabels("skill-a", "Skill A", [
          "frontend",
          "react",
          "typescript"
        ])
      );

      await registry.loadSkillsFromMultiple([tempDir1]);

      const skill = registry.getSkill("skill-a");
      expect(skill?.metadata.labels).toEqual([
        "frontend",
        "react",
        "typescript"
      ]);
    });
  });
});
