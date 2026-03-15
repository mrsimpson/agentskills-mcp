/**
 * Integration tests for MCP server execution
 *
 * Tests that the server can be spawned as a subprocess and properly
 * communicates via stdio using the MCP protocol.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn, ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EventEmitter } from "node:events";

describe("MCP Server Integration - Subprocess Execution", () => {
  let tempDir: string;
  let skillsDir: string;
  let serverProcess: ChildProcess | null = null;

  beforeEach(async () => {
    // Create temporary directory with test skills
    tempDir = await fs.mkdtemp(join(tmpdir(), "agentskills-integration-"));
    skillsDir = join(tempDir, ".agentskills", "skills");
    await fs.mkdir(skillsDir, { recursive: true });

    // Create example-skill
    const exampleSkillDir = join(skillsDir, "example-skill");
    await fs.mkdir(exampleSkillDir, { recursive: true });
    const exampleSkillContent = `---
name: example-skill
description: An example skill for integration testing
---

# Example Skill

This is an example skill body with instructions for the first skill.
`;
    await fs.writeFile(join(exampleSkillDir, "SKILL.md"), exampleSkillContent);

    // Create another-skill
    const anotherSkillDir = join(skillsDir, "another-skill");
    await fs.mkdir(anotherSkillDir, { recursive: true });
    const anotherSkillContent = `---
name: another-skill
description: Another skill for integration testing
---

# Another Skill

This is another skill body with instructions for the second skill.
`;
    await fs.writeFile(join(anotherSkillDir, "SKILL.md"), anotherSkillContent);
  });

  afterEach(async () => {
    // Clean up subprocess if still running
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
      serverProcess = null;
    }

    // Clean up temp directory
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should spawn server, initialize via MCP protocol, and expose use_skill tool with skill enum", async () => {
    // Get path to compiled server binary
    const serverBinPath = join(process.cwd(), "dist", "bin.js");

    // Spawn the server as a subprocess with project directory (not skills directory)
    serverProcess = spawn("node", [serverBinPath, tempDir], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    // Collect responses using an EventEmitter to avoid setInterval timing issues
    const responses: object[] = [];
    let buffer = "";
    const responseEmitter = new EventEmitter();

    serverProcess.stdout?.on("data", (data) => {
      buffer += data.toString();

      // Try to parse complete JSON objects from the buffer
      // MCP SDK outputs newline-delimited JSON
      while (buffer.length > 0) {
        try {
          // Try to find the end of a JSON object
          // We'll look for complete JSON objects by parsing progressively
          let depth = 0;
          let inString = false;
          let escapeNext = false;
          let jsonEnd = -1;

          for (let i = 0; i < buffer.length; i++) {
            const char = buffer[i];

            if (escapeNext) {
              escapeNext = false;
              continue;
            }

            if (char === "\\") {
              escapeNext = true;
              continue;
            }

            if (char === '"' && !escapeNext) {
              inString = !inString;
              continue;
            }

            if (inString) continue;

            if (char === "{") depth++;
            if (char === "}") depth--;

            if (depth === 0 && char === "}") {
              jsonEnd = i + 1;
              break;
            }
          }

          if (jsonEnd > 0) {
            const jsonStr = buffer.substring(0, jsonEnd);
            buffer = buffer.substring(jsonEnd).trim();
            const parsed = JSON.parse(jsonStr);
            responses.push(parsed);
            responseEmitter.emit("response");
          } else {
            // No complete JSON object yet
            break;
          }
        } catch (error) {
          // Not a complete JSON object yet, wait for more data
          break;
        }
      }
    });

    // Collect stderr for debugging
    let stderrOutput = "";
    serverProcess.stderr?.on("data", (data) => {
      stderrOutput += data.toString();
    });

    // Helper to send JSON-RPC message
    const sendMessage = (message: object) => {
      const json = JSON.stringify(message) + "\n";
      serverProcess?.stdin?.write(json);
    };

    // Helper to wait for a response using event-based notification
    // (avoids setInterval timing issues in test environments)
    const waitForResponse = (timeoutMs = 5000): Promise<object> => {
      return new Promise((resolve, reject) => {
        if (responses.length > 0) {
          resolve(responses.shift()!);
          return;
        }
        const timer = setTimeout(() => {
          responseEmitter.removeAllListeners("response");
          reject(
            new Error(
              `Timeout waiting for response. Buffer: "${buffer}". stderr: ${stderrOutput}`
            )
          );
        }, timeoutMs);
        responseEmitter.once("response", () => {
          clearTimeout(timer);
          resolve(responses.shift()!);
        });
      });
    };

    // Step 1: Send initialize request
    sendMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {
          roots: {
            listChanged: true
          }
        },
        clientInfo: {
          name: "test-client",
          version: "1.0.0"
        }
      }
    });

    // Step 2: Wait for initialize response
    const initResponse = (await waitForResponse()) as any;
    expect(initResponse.id).toBe(1);
    expect(initResponse.result).toBeDefined();
    expect(initResponse.result.capabilities).toBeDefined();
    expect(initResponse.result.capabilities.tools).toBeDefined();

    // Step 3: Send initialized notification
    sendMessage({
      jsonrpc: "2.0",
      method: "notifications/initialized"
    });

    // Step 4: Send tools/list request
    sendMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list"
    });

    // Step 5: Wait for tools/list response
    const toolsResponse = (await waitForResponse()) as any;
    expect(toolsResponse.id).toBe(2);
    expect(toolsResponse.result).toBeDefined();
    expect(toolsResponse.result.tools).toBeDefined();
    expect(Array.isArray(toolsResponse.result.tools)).toBe(true);

    // Step 6: Verify use_skill tool is exposed with skill_name enum
    const useSkillTool = toolsResponse.result.tools.find(
      (tool: any) => tool.name === "use_skill"
    );
    expect(useSkillTool).toBeDefined();
    expect(useSkillTool.description).toBeDefined();

    // Verify description includes skill names and descriptions
    expect(useSkillTool.description).toContain("example-skill");
    expect(useSkillTool.description).toContain(
      "An example skill for integration testing"
    );
    expect(useSkillTool.description).toContain("another-skill");
    expect(useSkillTool.description).toContain(
      "Another skill for integration testing"
    );

    expect(useSkillTool.inputSchema).toBeDefined();
    expect(useSkillTool.inputSchema.type).toBe("object");

    // Verify skill_name parameter has enum with loaded skill names
    expect(useSkillTool.inputSchema.properties).toBeDefined();
    expect(useSkillTool.inputSchema.properties.skill_name).toBeDefined();
    expect(useSkillTool.inputSchema.properties.skill_name.type).toBe("string");
    expect(useSkillTool.inputSchema.properties.skill_name.enum).toBeDefined();
    expect(
      Array.isArray(useSkillTool.inputSchema.properties.skill_name.enum)
    ).toBe(true);
    expect(useSkillTool.inputSchema.properties.skill_name.enum).toContain(
      "example-skill"
    );
    expect(useSkillTool.inputSchema.properties.skill_name.enum).toContain(
      "another-skill"
    );
    // Check that at least our 2 test skills are present (may include global skills too)
    expect(
      useSkillTool.inputSchema.properties.skill_name.enum.length
    ).toBeGreaterThanOrEqual(2);

    // Step 7: Test tool execution - call use_skill with example-skill
    sendMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "use_skill",
        arguments: {
          skill_name: "example-skill"
        }
      }
    });

    // Step 8: Wait for tool execution response
    const toolCallResponse = (await waitForResponse()) as any;
    expect(toolCallResponse.id).toBe(3);
    expect(toolCallResponse.result).toBeDefined();
    expect(toolCallResponse.result.content).toBeDefined();
    expect(Array.isArray(toolCallResponse.result.content)).toBe(true);
    expect(toolCallResponse.result.content.length).toBeGreaterThan(0);
    expect(toolCallResponse.result.content[0].type).toBe("text");

    // Parse the skill response - should only contain instructions
    const data = JSON.parse(toolCallResponse.result.content[0].text);
    expect(data).toHaveProperty("instructions");
    expect(data.instructions).toContain("Example Skill");
    expect(data.instructions).toContain(
      "This is an example skill body with instructions for the first skill"
    );

    // Should NOT contain metadata
    expect(data).not.toHaveProperty("name");
    expect(data).not.toHaveProperty("description");
    expect(data).not.toHaveProperty("body");

    console.log("Tool successfully exposed via MCP protocol with skill enum");
    console.log("Tool execution successfully returned skill body");

    // Step 9: Test resources/templates/list
    sendMessage({
      jsonrpc: "2.0",
      id: 4,
      method: "resources/templates/list"
    });

    // Step 10: Wait for resources/templates/list response
    const templatesResponse = (await waitForResponse()) as any;
    expect(templatesResponse.id).toBe(4);
    expect(templatesResponse.result).toBeDefined();
    expect(templatesResponse.result.resourceTemplates).toBeDefined();
    expect(Array.isArray(templatesResponse.result.resourceTemplates)).toBe(
      true
    );

    // Verify single template covers all skills
    const templates = templatesResponse.result.resourceTemplates;
    expect(templates.length).toBe(1);

    const template = templates[0];
    expect(template).toBeDefined();
    expect(template.uriTemplate).toBe("skill://{skillName}");
    expect(template.name).toBe("Agent Skill");
    expect(template.description).toContain("use_skill tool");
    expect(template.description).toContain("skill_name parameter");
    expect(template.mimeType).toBe("text/markdown");

    // NEW: Verify inputSchema with skill enum is present
    expect(template.inputSchema).toBeDefined();
    expect(template.inputSchema.type).toBe("object");
    expect(template.inputSchema.properties).toBeDefined();
    expect(template.inputSchema.properties.skillName).toBeDefined();
    expect(template.inputSchema.properties.skillName.type).toBe("string");
    expect(template.inputSchema.properties.skillName.enum).toBeDefined();
    expect(Array.isArray(template.inputSchema.properties.skillName.enum)).toBe(
      true
    );
    expect(template.inputSchema.properties.skillName.enum).toContain(
      "example-skill"
    );
    expect(template.inputSchema.properties.skillName.enum).toContain(
      "another-skill"
    );
    // Check that at least our 2 test skills are present (may include global skills too)
    expect(
      template.inputSchema.properties.skillName.enum.length
    ).toBeGreaterThanOrEqual(2);
    expect(template.inputSchema.required).toContain("skillName");

    // Step 11: Test resources/read
    sendMessage({
      jsonrpc: "2.0",
      id: 5,
      method: "resources/read",
      params: {
        uri: "skill://example-skill"
      }
    });

    // Step 12: Wait for resources/read response
    const resourceReadResponse = (await waitForResponse()) as any;
    expect(resourceReadResponse.id).toBe(5);
    expect(resourceReadResponse.result).toBeDefined();
    expect(resourceReadResponse.result.contents).toBeDefined();
    expect(Array.isArray(resourceReadResponse.result.contents)).toBe(true);
    expect(resourceReadResponse.result.contents.length).toBeGreaterThan(0);

    const resourceContent = resourceReadResponse.result.contents[0];
    expect(resourceContent.uri).toBe("skill://example-skill");
    expect(resourceContent.mimeType).toBe("text/markdown");
    expect(resourceContent.text).toBeDefined();
    expect(resourceContent.text).toContain("Example Skill");
    expect(resourceContent.text).toContain(
      "This is an example skill body with instructions for the first skill"
    );

    console.log("Resource template successfully exposed via MCP protocol");
    console.log(
      "Single template covers all skills via skill://{skillName} pattern"
    );
    console.log("Resource reading successfully returned SKILL.md content");

    // Step 13: Test resources/list (concrete resources)
    sendMessage({
      jsonrpc: "2.0",
      id: 6,
      method: "resources/list"
    });

    // Step 14: Wait for resources/list response
    const resourcesListResponse = (await waitForResponse()) as any;
    expect(resourcesListResponse.id).toBe(6);
    expect(resourcesListResponse.result).toBeDefined();
    expect(resourcesListResponse.result.resources).toBeDefined();
    expect(Array.isArray(resourcesListResponse.result.resources)).toBe(true);
    // Check that at least our 2 test skills are present (may include global skills too)
    expect(
      resourcesListResponse.result.resources.length
    ).toBeGreaterThanOrEqual(2);

    // Verify each resource has correct structure
    const resources = resourcesListResponse.result.resources;
    const exampleResource = resources.find(
      (r: any) => r.name === "example-skill"
    );
    const anotherResource = resources.find(
      (r: any) => r.name === "another-skill"
    );

    expect(exampleResource).toBeDefined();
    expect(exampleResource.uri).toBe("skill://example-skill");
    expect(exampleResource.name).toBe("example-skill");
    expect(exampleResource.description).toBe(
      "An example skill for integration testing"
    );
    expect(exampleResource.mimeType).toBe("text/markdown");

    expect(anotherResource).toBeDefined();
    expect(anotherResource.uri).toBe("skill://another-skill");
    expect(anotherResource.name).toBe("another-skill");
    expect(anotherResource.description).toBe(
      "Another skill for integration testing"
    );
    expect(anotherResource.mimeType).toBe("text/markdown");

    console.log("Resources list successfully exposed via MCP protocol");
    console.log("Both concrete resources and templates are available");

    // Cleanup: Close subprocess
    serverProcess.stdin?.end();

    // Wait for process to exit
    await new Promise<void>((resolve) => {
      serverProcess?.on("close", () => {
        resolve();
      });
      // Force kill after 1 second if not closed
      setTimeout(() => {
        if (serverProcess) {
          serverProcess.kill("SIGKILL");
          resolve();
        }
      }, 1000);
    });

    serverProcess = null;
  }, 30000); // 30 second timeout for the entire test
});
