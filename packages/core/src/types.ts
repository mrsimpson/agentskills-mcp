/**
 * Type definitions for Agent Skills Parser
 *
 * These types define the structure of parsed Agent Skills following
 * the Agent Skills standard and Claude Code extensions.
 */

/**
 * Metadata extracted from skill YAML frontmatter
 */
export interface SkillMetadata {
  // Required fields (Agent Skills standard)
  name: string;
  description: string;

  // Optional standard fields
  license?: string;
  compatibility?: string;
  metadata?: Record<string, unknown>;
  allowedTools?: string[];

  // Claude Code extensions
  disableModelInvocation?: boolean;
  userInvocable?: boolean;
  argumentHint?: string;
  context?: string;
  agent?: string;
  model?: string;
  hooks?: Record<string, string>;

  // Labels for categorization and filtering
  labels?: string[];

  // MCP server dependencies
  requiresMcpServers?: McpServerDependency[];
}

/**
 * Parsed skill with metadata and body content
 */
export interface Skill {
  metadata: SkillMetadata;
  body: string;
}

/**
 * Error codes for parsing failures
 */
export type ParseErrorCode =
  | "EMPTY_FILE"
  | "MISSING_FRONTMATTER"
  | "INVALID_YAML"
  | "MISSING_REQUIRED_FIELD"
  | "FILE_NOT_FOUND"
  | "FILE_READ_ERROR";

/**
 * Error information for parsing failures
 */
export interface ParseError {
  code: ParseErrorCode;
  message: string;
  field?: string; // For MISSING_REQUIRED_FIELD errors
}

/**
 * Successful parse result
 */
export interface ParseSuccess {
  success: true;
  skill: Skill;
}

/**
 * Failed parse result
 */
export interface ParseFailure {
  success: false;
  error: ParseError;
}

/**
 * Result of parsing a skill (discriminated union)
 */
export type ParseResult = ParseSuccess | ParseFailure;

/**
 * Validation error information
 */
export interface ValidationError {
  message: string;
}

/**
 * Validation warning information (reserved for future use)
 */
export interface ValidationWarning {
  message: string;
}

/**
 * Result of validating a skill
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Result of loading skills into registry
 *
 * Note: Loading is strict - any error throws exception.
 * No partial failures allowed (fail fast on misconfiguration).
 */
export interface LoadResult {
  loaded: number; // Number of skills successfully loaded
  skillsDir: string; // Directory loaded from
  timestamp: Date; // When skills were loaded
}

/**
 * Current state of the registry
 */
export interface RegistryState {
  skillCount: number;
  skillsDir: string; // Directory skills loaded from (changed from sources array)
  lastLoaded?: Date;
}

/**
 * Error codes for installation failures
 */
export type InstallErrorCode =
  | "INVALID_SPEC"
  | "INSTALL_FAILED"
  | "NETWORK_ERROR"
  | "MISSING_SKILL_MD"
  | "INVALID_SKILL_FORMAT"
  | "PERMISSION_ERROR";

/**
 * Error information for installation failures
 */
export interface InstallError {
  code: InstallErrorCode;
  message: string;
}

/**
 * Skill manifest extracted from installed package
 */
export interface SkillManifest {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  packageName?: string;
  version?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Successful installation result
 */
export interface InstallSuccess {
  success: true;
  name: string;
  spec: string;
  resolvedVersion: string;
  integrity: string;
  installPath: string;
  manifest?: SkillManifest;
}

/**
 * Failed installation result
 */
export interface InstallFailure {
  success: false;
  name?: string;
  spec?: string;
  error?: InstallError;
}

/**
 * Result of installing a single skill (discriminated union)
 */
export type InstallResult = InstallSuccess | InstallFailure;

/**
 * Result of installing multiple skills
 */
export interface InstallAllResult {
  success: boolean;
  installed: Set<string>;
  failed: Set<string>;
  results: Record<string, InstallResult>;
}

/**
 * MCP (Model Context Protocol) related types
 */

/**
 * Supported MCP client types
 */
export type McpClientType =
  | "claude-desktop"
  | "cline"
  | "continue"
  | "cursor"
  | "junie"
  | "kiro"
  | "opencode"
  | "zed"
  | "github-copilot";

/**
 * Parameter specification for MCP server configuration
 */
export interface McpParameterSpec {
  description: string; // What this parameter is for
  required: boolean; // Is this parameter required?
  sensitive?: boolean; // Is this a secret/credential?
  default?: string; // Default value
  example?: string; // Example value to guide users
}

/**
 * MCP server dependency specification
 */
export interface McpServerDependency {
  name: string; // Server identifier
  package?: string; // NPM package name (optional)
  description: string; // Why this server is needed
  command: string; // Executable command
  args?: string[]; // Arguments (may contain placeholders)
  env?: Record<string, string>; // Environment vars
  parameters?: Record<string, McpParameterSpec>; // Parameter definitions
}

/**
 * MCP server configuration structure
 */
export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * OpenCode MCP server configuration structure
 * OpenCode uses "type": "local" and different property names
 */
export interface OpenCodeMcpServerConfig {
  type: "local" | "remote";
  command?: string[]; // For local: ["npx", "-y", "package-name"]
  url?: string; // For remote servers
  enabled?: boolean;
  environment?: Record<string, string>;
  headers?: Record<string, string>; // For remote servers
  oauth?: Record<string, unknown> | false; // For remote OAuth
  timeout?: number;
}

/**
 * MCP client configuration
 */
export interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

/**
 * OpenCode configuration structure
 */
export interface OpenCodeConfig {
  $schema?: string;
  mcp?: Record<string, OpenCodeMcpServerConfig>;
  [key: string]: unknown; // Allow other OpenCode config properties
}

/**
 * MCP dependency information
 */
export interface McpDependencyInfo {
  serverName: string;
  neededBy: string[]; // Skills that need this server
  spec: McpServerDependency;
}

/**
 * Result of checking MCP dependencies
 */
export interface McpDependencyCheckResult {
  allConfigured: boolean;
  missing: McpDependencyInfo[];
  configured: string[];
}

/**
 * Parameter values for substitution
 */
export type ParameterValues = Record<string, string>;
