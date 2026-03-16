/**
 * Tests for ConfigGenerator implementations
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ConfigGeneratorRegistry,
  GitHubCopilotGenerator,
  KiroGenerator,
  OpenCodeMcpGenerator,
  OpenCodeAgentGenerator,
  SkillsMcpAgentConfig
} from "../mcp.js";

const baseConfig: SkillsMcpAgentConfig = {
  id: "skills-mcp",
  description: "Agent-skills MCP server with use_skill tool access",
  mcp_servers: {
    "agent-skills": {
      type: "stdio",
      command: "npx",
      args: ["-y", "@agent-skills/mcp-server"],
      tools: ["*"]
    }
  },
  tools: {
    use_skill: true
  },
  permissions: {
    use_skill: "allow"
  }
};

const generatorOptions = {
  skillsDir: "/project",
  agentId: "skills-mcp",
  scope: "local" as const,
  isGlobal: false
};

describe("ConfigGeneratorRegistry", () => {
  let registry: ConfigGeneratorRegistry;

  beforeEach(() => {
    registry = new ConfigGeneratorRegistry();
  });

  it("should register generators", () => {
    const copilotGen = new GitHubCopilotGenerator();
    registry.register(copilotGen);

    expect(registry.supports("github-copilot")).toBe(true);
  });

  it("should get generator for agent type", () => {
    const copilotGen = new GitHubCopilotGenerator();
    registry.register(copilotGen);

    const generator = registry.getGenerator("copilot-cli");
    expect(generator).toBeDefined();
    expect(generator?.supports("copilot-cli")).toBe(true);
  });

  it("should return undefined for unsupported agent type", () => {
    const generator = registry.getGenerator("unsupported-agent");
    expect(generator).toBeUndefined();
  });

  it("should list all generators with deduplication", () => {
    const registry = new ConfigGeneratorRegistry();
    registry.register(new GitHubCopilotGenerator());
    registry.register(new KiroGenerator());
    registry.register(new OpenCodeMcpGenerator());

    const generators = registry.listGenerators();
    expect(generators.length).toBe(3);
    expect(generators.map((g) => g.name)).toContain("GitHub Copilot");
    expect(generators.map((g) => g.name)).toContain("Kiro");
    expect(generators.map((g) => g.name)).toContain("OpenCode MCP");
  });

  it("should get supported agent types", () => {
    registry.register(new GitHubCopilotGenerator());
    registry.register(new KiroGenerator());

    const types = registry.getSupportedAgentTypes();
    expect(types).toContain("github-copilot");
    expect(types).toContain("copilot-cli");
    expect(types).toContain("kiro");
  });

  it("should clear all generators", () => {
    registry.register(new GitHubCopilotGenerator());
    expect(registry.supports("github-copilot")).toBe(true);

    registry.clear();
    expect(registry.supports("github-copilot")).toBe(false);
  });
});

describe("GitHubCopilotGenerator", () => {
  let generator: GitHubCopilotGenerator;

  beforeEach(() => {
    generator = new GitHubCopilotGenerator();
  });

  it("should support correct agent types", () => {
    expect(generator.supports("github-copilot")).toBe(true);
    expect(generator.supports("copilot-cli")).toBe(true);
    expect(generator.supports("copilot-coding-agent")).toBe(true);
    expect(generator.supports("invalid")).toBe(false);
  });

  it("should generate markdown with YAML frontmatter", async () => {
    const result = await generator.generate(baseConfig, generatorOptions);

    expect(result.format).toBe("markdown");
    expect(result.filePath).toBe("/project/.github/agents/skills-mcp.agent.md");
    expect(typeof result.content).toBe("string");

    const content = result.content as string;
    expect(content).toContain("---");
    expect(content).toContain("name: skills-mcp");
    expect(content).toContain("description:");
    expect(content).toContain("mcp-servers:");
    expect(content).toContain("agent-skills");
  });

  it("should include use_skill in tools", async () => {
    const result = await generator.generate(baseConfig, generatorOptions);
    const content = result.content as string;

    expect(content).toContain("use_skill");
  });

  it("should map MCP servers correctly", async () => {
    const config: SkillsMcpAgentConfig = {
      ...baseConfig,
      mcp_servers: {
        "agent-skills": {
          type: "stdio",
          command: "npx",
          args: ["-y", "@agent-skills/mcp-server"]
        },
        github: {
          type: "http",
          url: "https://api.github.com/mcp"
        }
      }
    };

    const result = await generator.generate(config, generatorOptions);
    const content = result.content as string;

    expect(content).toContain("agent-skills:");
    expect(content).toContain("github:");
    expect(content).toContain("type: stdio");
    expect(content).toContain("type: http");
  });

  it("should get correct output path", () => {
    const path = generator.getOutputPath("/project");
    expect(path).toBe("/project/.github/agents/skills-mcp.agent.md");
  });

  it("should provide metadata", () => {
    const metadata = generator.getMetadata();

    expect(metadata.name).toBe("GitHub Copilot");
    expect(metadata.agentTypes).toContain("github-copilot");
    expect(metadata.version).toBe("1.0.0");
    expect(metadata.docsUrl).toContain("github.com");
  });

  it("should use wildcard tools when server.tools is ['*']", async () => {
    const result = await generator.generate(baseConfig, generatorOptions);
    const content = result.content as string;

    expect(content).toContain("agent-skills/*");
  });

  it("should restrict to specific tools when server.tools lists named tools", async () => {
    const config: SkillsMcpAgentConfig = {
      ...baseConfig,
      mcp_servers: {
        "agent-skills": {
          type: "stdio",
          command: "npx",
          args: ["-y", "@agent-skills/mcp-server"],
          tools: ["*"]
        },
        github: {
          type: "http",
          url: "https://api.github.com/mcp",
          tools: ["search_repositories", "get_file_contents"]
        }
      }
    };

    const result = await generator.generate(config, generatorOptions);
    const content = result.content as string;

    // agent-skills with tools: ['*'] → wildcard
    expect(content).toContain("agent-skills/*");
    // github with specific tools → specific entries, not wildcard
    expect(content).not.toContain("github/*");
    expect(content).toContain("github/search_repositories");
    expect(content).toContain("github/get_file_contents");
  });
});

describe("KiroGenerator", () => {
  let generator: KiroGenerator;

  beforeEach(() => {
    generator = new KiroGenerator();
  });

  it("should support correct agent types", () => {
    expect(generator.supports("kiro")).toBe(true);
    expect(generator.supports("kiro-cli")).toBe(true);
    expect(generator.supports("invalid")).toBe(false);
  });

  it("should generate JSON configuration", async () => {
    const result = await generator.generate(baseConfig, generatorOptions);

    expect(result.format).toBe("json");
    expect(result.filePath).toBe("/project/.kiro/agents/skills-mcp.json");
    expect(typeof result.content).toBe("string");

    const content = result.content as string;
    const parsed = JSON.parse(content);
    expect(parsed.name).toBe("skills-mcp");
    expect(parsed.prompt).toContain("Skill Usage");
    expect(parsed.allowedTools).toBeDefined();
    expect(parsed.mcpServers).toBeDefined();
  });

  it("should include allowed tools", async () => {
    const result = await generator.generate(baseConfig, generatorOptions);
    const content = result.content as string;
    const parsed = JSON.parse(content);

    expect(parsed.allowedTools).toContain("use_skill");
    expect(parsed.allowedTools).toContain("@agent-skills/*");
  });

  it("should include MCP servers configuration", async () => {
    const result = await generator.generate(baseConfig, generatorOptions);
    const content = result.content as string;
    const parsed = JSON.parse(content);

    expect(parsed.mcpServers).toBeDefined();
    expect(parsed.mcpServers["agent-skills"]).toBeDefined();
    expect(parsed.mcpServers["agent-skills"].command).toContain("npx");
  });

  it("should include tools array", async () => {
    const result = await generator.generate(baseConfig, generatorOptions);
    const content = result.content as string;
    const parsed = JSON.parse(content);

    expect(parsed.tools).toContain("@agent-skills");
  });

  it("should get correct output path", () => {
    const path = generator.getOutputPath("/project");
    expect(path).toBe("/project/.kiro/agents/skills-mcp.json");
  });

  it("should provide metadata", () => {
    const metadata = generator.getMetadata();

    expect(metadata.name).toBe("Kiro");
    expect(metadata.agentTypes).toContain("kiro");
    expect(metadata.version).toBe("1.0.0");
    expect(metadata.docsUrl).toContain("kiro.dev");
  });

  it("should handle tools with multiple enabled tools", async () => {
    const config: SkillsMcpAgentConfig = {
      ...baseConfig,
      tools: {
        use_skill: true,
        read: true,
        bash: false
      }
    };

    const result = await generator.generate(config, generatorOptions);
    const content = result.content as string;
    const parsed = JSON.parse(content);

    expect(parsed.allowedTools).toContain("use_skill");
    expect(parsed.allowedTools).toContain("fs_read");
    expect(parsed.tools).toContain("fs_read");
  });

  it("should use wildcard when server.tools is ['*']", async () => {
    // baseConfig already has tools: ['*'] for agent-skills
    const result = await generator.generate(baseConfig, generatorOptions);
    const parsed = JSON.parse(result.content as string);

    expect(parsed.allowedTools).toContain("@agent-skills/*");
  });

  it("should restrict to specific tools when server.tools lists named tools", async () => {
    const config: SkillsMcpAgentConfig = {
      ...baseConfig,
      mcp_servers: {
        "agent-skills": {
          type: "stdio",
          command: "npx",
          args: ["-y", "@agent-skills/mcp-server"],
          tools: ["*"]
        },
        github: {
          type: "http",
          url: "https://api.github.com/mcp",
          tools: ["search_repositories", "get_file_contents"]
        }
      }
    };

    const result = await generator.generate(config, generatorOptions);
    const parsed = JSON.parse(result.content as string);

    // agent-skills with tools: ['*'] → wildcard
    expect(parsed.allowedTools).toContain("@agent-skills/*");
    // github with specific tools → no wildcard
    expect(parsed.allowedTools).not.toContain("@github/*");
    expect(parsed.allowedTools).toContain("@github/search_repositories");
    expect(parsed.allowedTools).toContain("@github/get_file_contents");
  });

  it("should use wildcard when server.tools is undefined", async () => {
    const config: SkillsMcpAgentConfig = {
      ...baseConfig,
      mcp_servers: {
        "agent-skills": {
          type: "stdio",
          command: "npx",
          args: ["-y", "@agent-skills/mcp-server"]
          // no tools field → wildcard
        }
      }
    };

    const result = await generator.generate(config, generatorOptions);
    const parsed = JSON.parse(result.content as string);

    expect(parsed.allowedTools).toContain("@agent-skills/*");
  });
});

describe("OpenCodeAgentGenerator", () => {
  let generator: OpenCodeAgentGenerator;

  beforeEach(() => {
    generator = new OpenCodeAgentGenerator();
  });

  it("should support correct agent types", () => {
    expect(generator.supports("opencode")).toBe(true);
    expect(generator.supports("opencode-cli")).toBe(true);
    expect(generator.supports("invalid")).toBe(false);
  });

  it("should generate markdown with YAML frontmatter", async () => {
    const result = await generator.generate(baseConfig, generatorOptions);

    expect(result.format).toBe("markdown");
    expect(result.filePath).toBe("/project/.opencode/agents/skills-mcp.md");
    expect(typeof result.content).toBe("string");

    const content = result.content as string;
    expect(content).toContain("---");
    expect(content).toContain("description:");
  });

  it("should include tools configuration", async () => {
    const result = await generator.generate(baseConfig, generatorOptions);
    const content = result.content as string;

    expect(content).toContain("tools:");
    expect(content).toContain("use_skill: true");
  });

  it("should include permission configuration", async () => {
    const result = await generator.generate(baseConfig, generatorOptions);
    const content = result.content as string;

    expect(content).toContain("permission:");
    expect(content).toContain("use_skill: allow");
  });

  it("should get correct output path", () => {
    const path = generator.getOutputPath("/project");
    expect(path).toBe("/project/.opencode/agents/skills-mcp.md");
  });

  it("should provide metadata", () => {
    const metadata = generator.getMetadata();

    expect(metadata.name).toBe("OpenCode Agent");
    expect(metadata.agentTypes).toContain("opencode");
    expect(metadata.version).toBe("1.0.0");
    expect(metadata.docsUrl).toContain("opencode.ai");
  });
});

describe("ConfigGenerator Integration", () => {
  it("should work with multiple generators in registry", async () => {
    const registry = new ConfigGeneratorRegistry();
    registry.register(new GitHubCopilotGenerator());
    registry.register(new KiroGenerator());
    registry.register(new OpenCodeMcpGenerator());

    const copilotResult = await registry.generate(
      "github-copilot",
      baseConfig,
      generatorOptions
    );
    const kiroResult = await registry.generate(
      "kiro",
      baseConfig,
      generatorOptions
    );
    const opencodeResult = await registry.generate(
      "opencode",
      baseConfig,
      generatorOptions
    );

    expect(copilotResult).not.toBeNull();
    expect(kiroResult).not.toBeNull();
    expect(opencodeResult).not.toBeNull();

    expect((copilotResult!.filePath as string).endsWith(".agent.md")).toBe(
      true
    );
    expect((kiroResult!.filePath as string).endsWith(".json")).toBe(true);
    expect((opencodeResult!.filePath as string).endsWith(".json")).toBe(true);
  });

  it("should return null for unsupported generator", async () => {
    const registry = new ConfigGeneratorRegistry();
    registry.register(new GitHubCopilotGenerator());

    const result = await registry.generate(
      "unsupported-agent",
      baseConfig,
      generatorOptions
    );

    expect(result).toBeNull();
  });
});
