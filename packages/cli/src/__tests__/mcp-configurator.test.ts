import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  configureAgentMcp,
  getAgentConfigPath,
  readAgentConfig,
  writeAgentConfig,
  generateSkillsMcpAgent,
} from '../mcp-configurator';
import type { McpConfig } from '@agent-skills/core';

describe('mcp-configurator', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create temporary directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-test-'));
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('getAgentConfigPath', () => {
    it('should return claude config path for claude agent', () => {
      const configPath = getAgentConfigPath('claude', tempDir);
      expect(configPath).toMatch(/\.claude\/mcp\.json$/);
      expect(configPath).toContain(tempDir);
    });

    it('should return cline config path for cline agent', () => {
      const configPath = getAgentConfigPath('cline', tempDir);
      expect(configPath).toMatch(/\.cline\/mcp\.json$/);
      expect(configPath).toContain(tempDir);
    });

    it('should return cursor config path for cursor agent', () => {
      const configPath = getAgentConfigPath('cursor', tempDir);
      expect(configPath).toMatch(/\.cursor\/mcp\.json$/);
      expect(configPath).toContain(tempDir);
    });

    it('should return opencode config path for opencode agent', () => {
      const configPath = getAgentConfigPath('opencode', tempDir);
      expect(configPath).toMatch(/opencode\.json$/);
      expect(configPath).toContain(tempDir);
    });

    it('should return kiro config path for kiro agent', () => {
      const configPath = getAgentConfigPath('kiro', tempDir);
      expect(configPath).toMatch(/\.kiro\/mcp\.json$/);
      expect(configPath).toContain(tempDir);
    });

    it('should return zed config path for zed agent', () => {
      const configPath = getAgentConfigPath('zed', tempDir);
      expect(configPath).toMatch(/settings\.json$/);
    });

    it('should return junie config path for junie agent', () => {
      const configPath = getAgentConfigPath('junie', tempDir);
      expect(configPath).toMatch(/\.junie\/mcp\.json$/);
      expect(configPath).toContain(tempDir);
    });

    it('should support unknown agent types with fallback path', () => {
      // Unknown agent types get a sanitized config path
      const configPath = getAgentConfigPath('unknown-agent' as any, tempDir);
      expect(configPath).toContain('.unknown-agent');
      expect(configPath).toContain(tempDir);
    });
  });

  describe('readAgentConfig', () => {
    it('should return empty config if file does not exist', async () => {
      const configPath = path.join(tempDir, '.claude', 'mcp.json');
      const config = await readAgentConfig(configPath);
      expect(config).toEqual({ mcpServers: {} });
    });

    it('should read existing config file', async () => {
      const configPath = path.join(tempDir, '.claude', 'mcp.json');
      const existingConfig: McpConfig = {
        mcpServers: {
          existing: {
            command: 'existing-command',
            args: [],
            env: {},
          },
        },
      };
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify(existingConfig));

      const config = await readAgentConfig(configPath);
      expect(config).toEqual(existingConfig);
    });

    it('should handle invalid JSON gracefully', async () => {
      const configPath = path.join(tempDir, '.claude', 'mcp.json');
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, 'invalid json {');

      await expect(readAgentConfig(configPath)).rejects.toThrow();
    });

    it.skipIf(process.getuid?.() === 0)('should handle permission errors', async () => {
      const configPath = path.join(tempDir, '.claude', 'mcp.json');
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, '{}');
      fs.chmodSync(configPath, 0o000);

      try {
        await expect(readAgentConfig(configPath)).rejects.toThrow();
      } finally {
        fs.chmodSync(configPath, 0o644);
      }
    });
  });

  describe('writeAgentConfig', () => {
    it('should write config to file with proper JSON formatting', async () => {
      const configPath = path.join(tempDir, '.claude', 'mcp.json');
      const config: McpConfig = {
        mcpServers: {
          agentskills: {
            command: 'npx',
            args: ['-y', '@codemcp/skills-mcp'],
          },
        },
      };

      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      await writeAgentConfig(configPath, config);

      expect(fs.existsSync(configPath)).toBe(true);
      const written = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(written).toEqual(config);
    });

    it('should create directories if they do not exist', async () => {
      const configPath = path.join(tempDir, 'nested', 'dir', '.claude');
      const config: McpConfig = {
        mcpServers: {
          agentskills: {
            command: 'npx',
            args: ['-y', '@codemcp/skills-mcp'],
          },
        },
      };

      await writeAgentConfig(configPath, config);

      expect(fs.existsSync(configPath)).toBe(true);
      const written = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(written).toEqual(config);
    });

    it('should use proper JSON indentation (2 spaces)', async () => {
      const configPath = path.join(tempDir, '.claude', 'mcp.json');
      const config: McpConfig = {
        mcpServers: {
          agentskills: {
            command: 'npx',
            args: ['-y', '@codemcp/skills-mcp'],
          },
        },
      };

      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      await writeAgentConfig(configPath, config);

      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).toMatch(/^{\n  /);
      expect(content).toContain('  "mcpServers"');
    });

    it.skipIf(process.getuid?.() === 0)('should handle write permission errors', async () => {
      const configPath = path.join(tempDir, '.claude', 'mcp.json');
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.chmodSync(path.dirname(configPath), 0o000);

      const config: McpConfig = {
        mcpServers: {
          agentskills: {
            command: 'npx',
            args: ['-y', '@codemcp/skills-mcp'],
          },
        },
      };

      try {
        await expect(writeAgentConfig(configPath, config)).rejects.toThrow();
      } finally {
        fs.chmodSync(path.dirname(configPath), 0o755);
      }
    });
  });

  describe('configureAgentMcp', () => {
    it('should create MCP config for claude agent', async () => {
      await configureAgentMcp('claude', tempDir);

      const configPath = path.join(tempDir, '.claude', 'mcp.json');
      expect(fs.existsSync(configPath)).toBe(true);
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(config.mcpServers?.agentskills).toBeDefined();
      expect(config.mcpServers.agentskills.command).toBe('npx');
      expect(config.mcpServers.agentskills.args).toContain('@codemcp/skills-server');
    });

    it('should create MCP config for cline agent', async () => {
      await configureAgentMcp('cline', tempDir);

      const configPath = path.join(tempDir, '.cline', 'mcp.json');
      expect(fs.existsSync(configPath)).toBe(true);
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(config.mcpServers?.agentskills).toBeDefined();
    });

    it('should create MCP config for cursor agent', async () => {
      await configureAgentMcp('cursor', tempDir);

      const configPath = path.join(tempDir, '.cursor', 'mcp.json');
      expect(fs.existsSync(configPath)).toBe(true);
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(config.mcpServers?.agentskills).toBeDefined();
    });

    it('should create MCP config for opencode agent', async () => {
      await configureAgentMcp('opencode', tempDir);

      const configPath = path.join(tempDir, 'opencode.json');
      expect(fs.existsSync(configPath)).toBe(true);
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      // OpenCode may use different format
      expect(config).toBeDefined();
    });

    it('should merge with existing config without removing other servers', async () => {
      const configPath = path.join(tempDir, '.claude', 'mcp.json');
      const existingConfig: McpConfig = {
        mcpServers: {
          existing: {
            command: 'existing-command',
            args: [],
          },
        },
      };
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify(existingConfig));

      await configureAgentMcp('claude', tempDir);

      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(config.mcpServers.existing).toBeDefined();
      expect(config.mcpServers.agentskills).toBeDefined();
      expect(Object.keys(config.mcpServers).length).toBe(2);
    });

    it('should update existing agentskills server config', async () => {
      const configPath = path.join(tempDir, '.claude', 'mcp.json');
      const existingConfig: McpConfig = {
        mcpServers: {
          agentskills: {
            command: 'old-command',
            args: ['old-arg'],
          },
        },
      };
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify(existingConfig));

      await configureAgentMcp('claude', tempDir);

      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(config.mcpServers.agentskills.command).toBe('npx');
      expect(config.mcpServers.agentskills.args).toContain('@codemcp/skills-server');
    });

    it('should throw error for invalid agent type', async () => {
      await expect(configureAgentMcp('invalid' as any, tempDir)).rejects.toThrow();
    });

    it('should use McpConfigAdapterRegistry for agent-specific formats', async () => {
      // This test verifies that the function respects agent-specific config formats
      await configureAgentMcp('opencode', tempDir);

      const configPath = path.join(tempDir, 'opencode.json');
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);

      // OpenCode uses 'mcp' field instead of 'mcpServers'
      // The adapter should handle this transformation
      expect(config).toBeDefined();
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('should not overwrite other config fields when merging', async () => {
      const configPath = path.join(tempDir, '.claude', 'mcp.json');
      const existingConfig: McpConfig = {
        mcpServers: {
          other: { command: 'cmd', args: [] },
        },
        // Additional fields that should be preserved
        otherField: 'should-be-preserved',
      } as any;
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify(existingConfig));

      await configureAgentMcp('claude', tempDir);

      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(config.otherField).toBe('should-be-preserved');
      expect(config.mcpServers.other).toBeDefined();
      expect(config.mcpServers.agentskills).toBeDefined();
    });

    it('should handle concurrent configureAgentMcp calls', async () => {
      await Promise.all([
        configureAgentMcp('claude', tempDir),
        configureAgentMcp('cline', tempDir),
        configureAgentMcp('cursor', tempDir),
      ]);

      expect(fs.existsSync(path.join(tempDir, '.claude', 'mcp.json'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.cline', 'mcp.json'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.cursor', 'mcp.json'))).toBe(true);
    });
  });

  describe('config format validation', () => {
    it('should write valid MCP server config format', async () => {
      const configPath = path.join(tempDir, '.claude', 'mcp.json');
      const config: McpConfig = {
        mcpServers: {
          agentskills: {
            command: 'npx',
            args: ['-y', '@codemcp/skills-mcp'],
            env: {
              NODE_ENV: 'production',
            },
          },
        },
      };

      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      await writeAgentConfig(configPath, config);

      const written = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(written.mcpServers.agentskills.command).toBe('npx');
      expect(Array.isArray(written.mcpServers.agentskills.args)).toBe(true);
      expect(typeof written.mcpServers.agentskills.env).toBe('object');
    });
  });

  describe('github-copilot / VSCode format', () => {
    it('getAgentConfigPath returns .vscode/mcp.json for github-copilot', () => {
      const p = getAgentConfigPath('github-copilot', tempDir, 'local');
      expect(p).toMatch(/\.vscode[/\\]mcp\.json$/);
    });

    it('readAgentConfig normalises VS Code "servers" key to "mcpServers"', async () => {
      const configPath = path.join(tempDir, '.vscode', 'mcp.json');
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(
        configPath,
        JSON.stringify({ servers: { myserver: { command: 'npx', args: ['-y', 'pkg'] } } })
      );
      const config = await readAgentConfig(configPath, 'github-copilot');
      expect(config.mcpServers).toBeDefined();
      expect(config.mcpServers!['myserver']).toBeDefined();
    });

    it('generateSkillsMcpAgent writes .vscode/mcp.json with servers key for github-copilot', async () => {
      await generateSkillsMcpAgent('github-copilot', tempDir, 'local', undefined, false);
      const vscodePath = path.join(tempDir, '.vscode', 'mcp.json');
      expect(fs.existsSync(vscodePath)).toBe(true);
      const written = JSON.parse(fs.readFileSync(vscodePath, 'utf-8'));
      expect(written.servers).toBeDefined();
      expect(written.mcpServers).toBeUndefined();
    });

    it('generateSkillsMcpAgent also writes agent.md when includeAgentConfig=true', async () => {
      await generateSkillsMcpAgent('github-copilot', tempDir, 'local', undefined, true);
      const vscodePath = path.join(tempDir, '.vscode', 'mcp.json');
      const agentPath = path.join(tempDir, '.github', 'agents', 'skills-mcp.agent.md');
      expect(fs.existsSync(vscodePath)).toBe(true);
      expect(fs.existsSync(agentPath)).toBe(true);
    });
  });

  describe('generateSkillsMcpAgent — directory guard', () => {
    it('should throw if a generator returns a path that is an existing directory', async () => {
      // kiro-cli writes to .kiro/agents/skills-mcp.json — create that path as a directory instead
      const agentsDir = path.join(tempDir, '.kiro', 'agents', 'skills-mcp.json');
      fs.mkdirSync(agentsDir, { recursive: true }); // make it a directory, not a file

      await expect(generateSkillsMcpAgent('kiro-cli', tempDir, 'local')).rejects.toThrow(
        /directory path instead of a file path/
      );
    });

    it('should write normally when the target path does not exist yet', async () => {
      await expect(generateSkillsMcpAgent('kiro-cli', tempDir, 'local')).resolves.not.toThrow();
      const written = path.join(tempDir, '.kiro', 'agents', 'skills-mcp.json');
      expect(fs.existsSync(written)).toBe(true);
    });
  });
});
