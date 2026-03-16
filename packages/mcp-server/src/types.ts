/**
 * Public API types for the Agent Skills MCP Server
 */

/** Server capability flags */
export interface ServerCapabilities {
  tools?: object;
  resources?: object;
}

/** Input schema for a tool parameter */
export interface ToolInputSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
}

/** A tool exposed by the MCP server */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
}

/** A single content item returned by a tool call */
export interface ToolCallContent {
  type: "text";
  text: string;
}

/** Successful tool call result */
export interface ToolCallSuccess {
  content: ToolCallContent[];
}

/** Failed tool call result */
export interface ToolCallError {
  isError: true;
  error: string;
}

/** Result of calling a tool */
export type ToolCallResult = ToolCallSuccess | ToolCallError;

/** A concrete resource exposed by the server */
export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

/** Parameter spec for a resource template */
export interface ResourceTemplateParameter {
  type: string;
  enum: string[];
  description: string;
}

/** Input schema for a resource template */
export interface ResourceTemplateInputSchema {
  type: string;
  properties: Record<string, ResourceTemplateParameter>;
  required: string[];
}

/** A resource template exposed by the server */
export interface ResourceTemplate {
  uriTemplate: string;
  name: string;
  description: string;
  mimeType: string;
  inputSchema: ResourceTemplateInputSchema;
}

/** A single content item in a resource read response */
export interface ResourceContentItem {
  uri: string;
  mimeType: string;
  text: string;
}

/** Successful resource read result */
export interface ResourceReadSuccess {
  contents: ResourceContentItem[];
}

/** Failed resource read result */
export interface ResourceReadError {
  isError: true;
  error: string;
}

/** Result of reading a resource */
export type ResourceReadResult = ResourceReadSuccess | ResourceReadError;
