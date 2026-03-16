/**
 * MCP configuration types and utilities for @codemcp/skills-core.
 *
 * These are intentionally separate from the main entry point — they represent
 * the MCP setup / agent-configuration concern (Vercel subtree logic, config
 * generators, adapter registry) rather than the core skill parsing and registry APIs.
 *
 * Import via: import { ConfigGeneratorRegistry } from "@codemcp/skills-core/mcp"
 */

// MCP config types
export type {
  McpClientType,
  McpConfig,
  McpServerConfig,
  OpenCodeConfig,
  OpenCodeMcpServerConfig,
  McpServerDependency,
  McpParameterSpec,
  McpDependencyCheckResult,
  McpDependencyInfo,
  ParameterValues
} from "./types.js";

// Config generator types and registry
export type {
  SkillsMcpServerConfig,
  ToolPermission,
  ToolPermissions,
  SkillsMcpAgentConfig,
  GeneratorOptions,
  GeneratedConfig,
  GeneratorMetadata,
  ConfigGenerator
} from "./config-generators.js";
export { ConfigGeneratorRegistry } from "./config-generators.js";

// Config generators
export {
  GitHubCopilotGenerator,
  KiroGenerator,
  OpenCodeMcpGenerator,
  OpenCodeAgentGenerator,
  VsCodeGenerator
} from "./generators/index.js";

// MCP config adapters
export {
  McpConfigAdapterRegistry,
  StandardMcpConfigAdapter,
  OpenCodeConfigAdapter,
  VsCodeConfigAdapter
} from "./mcp-config-adapters.js";
export type { McpConfigAdapter } from "./mcp-config-adapters.js";
