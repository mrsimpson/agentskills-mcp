/**
 * Agent Skills MCP Server
 *
 * This server exposes Agent Skills functionality through the Model Context Protocol (MCP).
 * It provides tools for discovering, validating, and installing skills.
 */

// Export the core MCPServer class
export { MCPServer } from "./server.js";

// Export public API types
export type {
  ServerCapabilities,
  ToolDefinition,
  ToolInputSchema,
  ToolCallContent,
  ToolCallSuccess,
  ToolCallError,
  ToolCallResult,
  ResourceDefinition,
  ResourceTemplate,
  ResourceTemplateParameter,
  ResourceTemplateInputSchema,
  ResourceContentItem,
  ResourceReadSuccess,
  ResourceReadError,
  ResourceReadResult
} from "./types.js";

/**
 * Main MCP server class for Agent Skills
 *
 * Minimal implementation to pass smoke tests.
 * Will be expanded as we implement actual functionality.
 *
 * @deprecated Use MCPServer instead
 */
export class AgentSkillsServer {
  constructor() {
    // Minimal constructor for now
  }
}

// Re-export for convenience and backward compatibility
export default AgentSkillsServer;
