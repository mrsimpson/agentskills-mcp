/**
 * MCPServer - Core MCP server implementation for Agent Skills
 *
 * This class implements the Model Context Protocol (MCP) server that exposes
 * Agent Skills as tools and resources. It uses the @modelcontextprotocol/sdk
 * with stdio transport for communication with MCP clients.
 *
 * Architecture:
 * - Uses McpServer from @modelcontextprotocol/sdk for MCP protocol handling
 * - Accepts SkillRegistry via dependency injection (separation of concerns)
 * - Announces capabilities: tools and resources
 * - Routes requests to appropriate handlers
 * - Server is immediately ready after construction (no explicit lifecycle)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SkillRegistry } from "@codemcp/skills-core";
import { z } from "zod";
import {
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import type {
  ServerCapabilities,
  ToolDefinition,
  ToolCallResult,
  ResourceDefinition,
  ResourceTemplate,
  ResourceReadResult
} from "./types.js";

/**
 * MCPServer - Main server class for Agent Skills MCP integration
 *
 * Features:
 * - Accepts SkillRegistry via dependency injection
 * - Announces tools and resources capabilities
 * - Server is "live" immediately upon construction
 * - Routes tools/list, tools/call, resources/list, resources/read requests
 * - Error handling without crashes
 */
export class MCPServer {
  private mcpServer: McpServer;
  private registry: SkillRegistry;
  private transport: StdioServerTransport;

  /**
   * Creates a new MCPServer instance
   *
   * Note: Call start() to begin accepting MCP protocol messages.
   *
   * @param registry - Pre-initialized SkillRegistry instance
   */
  constructor(registry: SkillRegistry) {
    this.registry = registry;

    // Initialize MCP server with capabilities
    this.mcpServer = new McpServer(
      {
        name: "agent-skills-mcp-server",
        version: "0.1.0"
      },
      {
        capabilities: {
          tools: {},
          resources: {}
        }
      }
    );

    // Register handlers BEFORE connecting (required by SDK)
    this.registerHandlers();

    // Create stdio transport
    this.transport = new StdioServerTransport();
  }

  /**
   * Start the MCP server and begin accepting protocol messages
   *
   * This connects the server to the stdio transport. The method returns
   * immediately after connection is established. The server will continue
   * running until stdin is closed.
   */
  async start(): Promise<void> {
    await this.mcpServer.connect(this.transport);
  }

  /**
   * Register MCP request handlers
   *
   * Registers the use_skill tool for retrieving skill instructions.
   * Registers resource handlers for exposing skills as MCP resources.
   */
  private registerHandlers(): void {
    // Get skill names for enum
    const skillNames = this.getSkillNames();

    // Register use_skill tool with Zod schema
    this.mcpServer.registerTool(
      "use_skill",
      {
        description: this.getToolDescription(),
        inputSchema: {
          skill_name: z
            .enum(
              skillNames.length > 0
                ? (skillNames as [string, ...string[]])
                : ["_no_skills_available"]
            )
            .describe("Name of the skill to retrieve"),
          arguments: z
            .object({})
            .passthrough()
            .optional()
            .describe("Optional arguments for skill execution context")
        }
      },
      async (args: Record<string, unknown>) => {
        return this.handleUseSkillTool(args);
      }
    );

    // Access underlying server for resource capabilities
    // Using type assertion as the SDK doesn't expose these methods directly
    const underlyingServer = (
      this.mcpServer as unknown as Record<string, unknown>
    ).server as {
      registerCapabilities: (caps: Record<string, unknown>) => void;
      setRequestHandler: (
        schema: unknown,
        handler: (request: Record<string, unknown>) => unknown
      ) => void;
    };

    // Register resource capabilities via the underlying server
    underlyingServer.registerCapabilities({
      resources: {}
    });

    // Register resources/list handler (concrete resources)
    underlyingServer.setRequestHandler(
      ListResourcesRequestSchema,
      async () => ({
        resources: this.getResourcesList()
      })
    );

    // Register resources/templates/list handler via the underlying server
    underlyingServer.setRequestHandler(
      ListResourceTemplatesRequestSchema,
      async () => ({
        resourceTemplates: this.getResourceTemplatesList()
      })
    );

    // Register resources/read handler via the underlying server
    underlyingServer.setRequestHandler(
      ReadResourceRequestSchema,
      async (request: Record<string, unknown>) => {
        return this.handleReadResource(
          (request.params as Record<string, unknown>).uri as string
        );
      }
    );
  }

  /**
   * Get all skill names from the registry
   *
   * @returns Array of skill names
   */
  private getSkillNames(): string[] {
    const metadata = this.registry.getAllMetadata();
    return metadata.map((m) => m.name);
  }

  /**
   * Get list of concrete resources (internal helper for MCP protocol)
   *
   * Returns all skills as concrete resources with skill:// URIs.
   * Each skill is exposed as an individual resource for discovery.
   *
   * @returns Array of resource definitions for MCP protocol
   */
  private getResourcesList(): Array<{
    uri: string;
    name: string;
    description: string;
    mimeType: string;
  }> {
    const skills = this.registry.getAllMetadata();

    return skills.map((skill) => ({
      uri: `skill://${skill.name}`,
      name: skill.name,
      description: skill.description,
      mimeType: "text/markdown"
    }));
  }

  /**
   * Get tool description with list of available skills
   *
   * Generates a dynamic description that includes all loaded skills
   * with their descriptions for better discoverability.
   *
   * @returns Tool description string with skill list
   */
  private getToolDescription(): string {
    const skills = this.registry.getAllMetadata();

    if (skills.length === 0) {
      return `No skills currently loaded – don't use this tool!`;
    }

    const instruction =
      "CRITICAL: Before proceeding with any task, CHECK if a skill exists for it!\nAvailable skills (call `use_skill` when you recognize these patterns):\n";

    const skillList = skills
      .map((skill) => `- ${skill.name}: ${skill.description}`)
      .join("\n");

    return `${instruction}
${skillList}
`;
  }

  /**
   * Handle use_skill tool execution
   *
   * Retrieves skill instructions for the requested skill.
   * Returns instructions and base path for resolving relative references.
   *
   * @param args - Tool arguments with skill_name and optional arguments
   * @returns MCP tool result with skill instructions and base path
   */
  private async handleUseSkillTool(
    args: Record<string, unknown>
  ): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    const skillName = args.skill_name as string;

    // Get skill from registry
    const skill = this.registry.getSkill(skillName);

    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    // Get the skills directory and construct full path to this skill
    const skillsDir = this.registry.getSkillsDirectory();
    const basePath = `${skillsDir}/${skillName}`;

    // Return instructions with base path for resolving relative references
    // Client can resolve references like: <basePath>/scripts/extract.py
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              instructions: skill.body,
              basePath: basePath
            },
            null,
            2
          )
        }
      ]
    };
  }

  /**
   * Get server capabilities
   *
   * @returns Server capabilities object
   */
  getCapabilities(): ServerCapabilities {
    return {
      tools: {},
      resources: {}
    };
  }

  /**
   * Get list of available tools
   *
   * Returns the use_skill tool definition with dynamic skill enumeration.
   *
   * @returns Array of tool definitions
   */
  getTools(): ToolDefinition[] {
    return [
      {
        name: "use_skill",
        description: this.getToolDescription(),
        inputSchema: {
          type: "object",
          properties: {
            skill_name: {
              type: "string",
              description: "Name of the skill to retrieve",
              enum: this.getSkillNames()
            },
            arguments: {
              type: "object",
              description: "Optional arguments for skill execution context"
            }
          },
          required: ["skill_name"]
        }
      }
    ];
  }

  /**
   * Call a tool
   *
   * Handles tool execution for use_skill tool.
   *
   * @param toolName - Name of the tool to call
   * @param args - Arguments object for the tool
   * @returns Tool execution result
   */
  async callTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolCallResult> {
    try {
      if (toolName === "use_skill") {
        return await this.handleUseSkillTool(args);
      }

      // Return error for unknown tools
      return {
        isError: true,
        error: `Unknown tool: ${toolName}`
      };
    } catch (error) {
      return {
        isError: true,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Get list of resource templates (internal helper for MCP protocol)
   *
   * Returns a single template that covers all skills using the {skillName} pattern.
   * Clients construct URIs dynamically using skill names from the tool's enum.
   *
   * @returns Array with single resource template for MCP protocol
   */
  private getResourceTemplatesList(): Array<{
    uriTemplate: string;
    name: string;
    description: string;
    mimeType: string;
    inputSchema: {
      type: string;
      properties: {
        skillName: {
          type: string;
          enum: string[];
          description: string;
        };
      };
      required: string[];
    };
  }> {
    // Get skill names for enum (reuse same method as tool)
    const skillNames = this.getSkillNames();

    return [
      {
        uriTemplate: "skill://{skillName}",
        name: "Agent Skill",
        description:
          "Access skill instructions and metadata. Use skill names from the use_skill tool's skill_name parameter.",
        mimeType: "text/markdown",
        inputSchema: {
          type: "object",
          properties: {
            skillName: {
              type: "string",
              enum: skillNames,
              description: "Name of the skill to retrieve"
            }
          },
          required: ["skillName"]
        }
      }
    ];
  }

  /**
   * Handle resource read request (internal helper for MCP protocol)
   *
   * Parses skill:// URIs and returns SKILL.md content.
   *
   * @param uri - Resource URI (skill://<name>)
   * @returns MCP resource content response
   */
  private async handleReadResource(uri: string): Promise<{
    contents: Array<{ uri: string; mimeType: string; text: string }>;
  }> {
    // Parse URI: skill://<name> or skill://<name>/SKILL.md
    const match = uri.match(/^skill:\/\/([^/]+)/);
    if (!match) {
      throw new Error(`Invalid skill URI: ${uri}`);
    }

    const skillName = match[1];
    const skill = this.registry.getSkill(skillName);

    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    // Return full SKILL.md content
    return {
      contents: [
        {
          uri: uri,
          mimeType: "text/markdown",
          text: skill.body
        }
      ]
    };
  }

  /**
   * Get list of resources
   *
   * Returns concrete list of all skills as resources. This method is for testing and
   * external callers. The MCP protocol uses getResourcesList internally.
   *
   * @returns Array of resource definitions
   */
  getResources(): ResourceDefinition[] {
    return this.getResourcesList();
  }

  /**
   * Get list of resource templates
   *
   * Returns resource templates for skills. This method is for testing and
   * external callers. The MCP protocol uses getResourceTemplatesList internally.
   *
   * @returns Array of resource template definitions
   */
  getResourceTemplates(): ResourceTemplate[] {
    return this.getResourceTemplatesList();
  }

  /**
   * Read a resource
   *
   * Reads a skill resource by URI. This method is for testing and
   * external callers. The MCP protocol uses handleReadResource internally.
   *
   * @param uri - Resource URI
   * @returns Resource content
   */
  async readResource(uri: string): Promise<ResourceReadResult> {
    try {
      return await this.handleReadResource(uri);
    } catch (error) {
      return {
        isError: true,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
}
