/**
 * SkillParser Component
 *
 * Responsibility: Parse SKILL.md files into structured Skill objects
 * following the Agent Skills standard and Claude Code extensions.
 *
 * This module provides two main functions:
 * - parseSkillContent: Parse skill content string directly
 * - parseSkill: Read and parse a skill file from the filesystem
 */

import matter from "gray-matter";
import { promises as fs } from "fs";
import type {
  ParseResult,
  ParseFailure,
  SkillMetadata,
  Skill,
  ParseErrorCode
} from "./types.js";

/**
 * Field name mapping from kebab-case (YAML) to camelCase (TypeScript)
 */
const FIELD_MAP: Record<string, string> = {
  name: "name",
  description: "description",
  license: "license",
  compatibility: "compatibility",
  metadata: "metadata",
  "allowed-tools": "allowedTools",
  "disable-model-invocation": "disableModelInvocation",
  "user-invocable": "userInvocable",
  "argument-hint": "argumentHint",
  context: "context",
  agent: "agent",
  model: "model",
  hooks: "hooks",
  labels: "labels",
  "requires-mcp-servers": "requiresMcpServers"
};

/**
 * Required fields that must be present in skill metadata
 */
const REQUIRED_FIELDS = ["name", "description"] as const;

/**
 * Helper function to create error result
 */
function createError(
  code: ParseErrorCode,
  message: string,
  field?: string
): ParseFailure {
  return {
    success: false,
    error: { code, message, ...(field && { field }) }
  };
}

/**
 * Map YAML field names (kebab-case) to TypeScript field names (camelCase).
 * Only keys defined in FIELD_MAP are kept; unrecognised keys (including any
 * camelCase variants) are silently ignored — the spec mandates kebab-case.
 */
function mapFieldNames(data: Record<string, unknown>): SkillMetadata {
  const metadata: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const mappedKey = FIELD_MAP[key];
    if (mappedKey !== undefined) {
      if (mappedKey === "allowedTools" && typeof value === "string") {
        metadata[mappedKey] = value.split(/\s+/).filter(Boolean);
      } else {
        metadata[mappedKey] = value;
      }
    }
  }

  return metadata as unknown as SkillMetadata;
}

/**
 * Parse skill content from a string
 *
 * Extracts YAML frontmatter and Markdown body, validates required fields,
 * and returns a structured Skill object.
 *
 * @param content - Raw skill file content (YAML frontmatter + Markdown body)
 * @returns ParseResult with either success (Skill) or failure (ParseError)
 *
 * @example
 * ```typescript
 * const content = `---
 * name: example-skill
 * description: An example skill
 * ---
 * # Example Skill
 *
 * This is the skill body.
 * `;
 *
 * const result = parseSkillContent(content);
 * if (result.success) {
 *   console.log(result.skill.metadata.name); // "example-skill"
 * }
 * ```
 */
export function parseSkillContent(content: string): ParseResult {
  // Check for empty file
  if (!content || content.trim().length === 0) {
    return createError("EMPTY_FILE", "Skill file is empty");
  }

  // Parse frontmatter using gray-matter
  let parsed;
  try {
    parsed = matter(content);
  } catch (error) {
    return createError(
      "INVALID_YAML",
      `Failed to parse YAML frontmatter: ${(error as Error).message}`
    );
  }

  // Check if frontmatter exists
  if (!parsed.data || Object.keys(parsed.data).length === 0) {
    return createError(
      "MISSING_FRONTMATTER",
      "Skill file must contain YAML frontmatter"
    );
  }

  // Validate required fields
  for (const field of REQUIRED_FIELDS) {
    if (!(field in parsed.data)) {
      return createError(
        "MISSING_REQUIRED_FIELD",
        `required field '${field}' is missing from skill metadata`,
        field
      );
    }
  }

  // Map field names from kebab-case to camelCase
  const metadata = mapFieldNames(parsed.data);

  // Create Skill object
  const skill: Skill = Object.freeze({
    metadata: Object.freeze(metadata),
    body: parsed.content
  });

  return {
    success: true,
    skill
  };
}

/**
 * Read and parse a skill file from the filesystem
 *
 * Reads the file at the given path, then delegates to parseSkillContent
 * for parsing. Handles file system errors gracefully.
 *
 * @param filePath - Absolute path to SKILL.md file
 * @returns ParseResult with either success (Skill) or failure (ParseError)
 *
 * @example
 * ```typescript
 * const result = await parseSkill('/path/to/SKILL.md');
 * if (result.success) {
 *   console.log(result.skill.metadata.name);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export async function parseSkill(filePath: string): Promise<ParseResult> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return parseSkillContent(content);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    // File not found error
    if (nodeError.code === "ENOENT") {
      return createError("FILE_NOT_FOUND", `File not found: ${filePath}`);
    }

    // Permission or other read errors
    if (nodeError.code === "EACCES" || nodeError.code === "EISDIR") {
      return createError(
        "FILE_READ_ERROR",
        `Failed to read file: ${nodeError.message}`
      );
    }

    // Other errors
    return createError(
      "FILE_READ_ERROR",
      `Failed to read file: ${nodeError.message}`
    );
  }
}
