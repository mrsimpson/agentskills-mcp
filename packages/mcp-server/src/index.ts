/**
 * Agent Skills MCP Server
 *
 * This server exposes Agent Skills functionality through the Model Context Protocol (MCP).
 * It provides tools for discovering, validating, and installing skills.
 */

// Export the core MCPServer class
export { MCPServer } from "./server.js";

// Re-export MCP SDK protocol types used in the public API
export type {
  ServerCapabilities,
  Tool,
  CallToolResult,
  Resource,
  ResourceTemplate,
  ReadResourceResult
} from "@modelcontextprotocol/sdk/types.js";

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
