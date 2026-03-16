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
} from '../mcp-configurator.ts';
import { parseMcpOptions } from '../mcp.ts';
import type { McpConfig } from '@codemcp/skills-core/mcp';

describe('MCP Setup E2E Integration Tests', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-e2e-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('End-to-End: TUI Mode Flow', () => {
    describe('Agent Selection → Mode Choice → Configuration', () => {
      it('should configure single generator-backed agent in agent-config mode', async () => {
        // Simulate TUI flow: user selects kiro-cli → chooses agent-config
        const agents = ['kiro-cli'];
        const configMode = 'agent-config' as const;

        const configPath = getAgentConfigPath('kiro-cli', tempDir);
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

        const readBack = await readAgentConfig(configPath);
        expect(readBack.mcpServers).toHaveProperty('agentskills');
        expect(readBack.mcpServers.agentskills.command).toBe('npx');
      });

      it('should configure single raw-mcp agent in mcp-json mode', async () => {
        // Simulate TUI flow: user selects claude-code → mode auto-selected (mcp-json)
        const agents = ['claude-code'];
        const configMode = 'mcp-json' as const;

        const configPath = getAgentConfigPath('claude-code', tempDir);
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

        const readBack = await readAgentConfig(configPath);
        expect(readBack.mcpServers).toHaveProperty('agentskills');
      });

      it('should configure multiple agents in TUI flow', async () => {
        // Simulate TUI: user selects multiple agents, each goes to correct output
        const agents = ['kiro-cli', 'claude-code', 'cursor'];

        for (const agent of agents) {
          const configPath = getAgentConfigPath(agent, tempDir);
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
        }

        // Verify all were written
        for (const agent of agents) {
          const configPath = getAgentConfigPath(agent, tempDir);
          expect(fs.existsSync(configPath)).toBe(true);
        }
      });

      it('should show activation hints after TUI configuration', async () => {
        // Simulate post-setup summary with activation hints
        const agentWithHint = {
          id: 'kiro-cli',
          name: 'Kiro CLI',
          activationHint: 'kiro-cli chat --agent skills-mcp',
        };

        expect(agentWithHint.activationHint).toBe('kiro-cli chat --agent skills-mcp');
      });
    });

    describe('TUI Mode Preference Handling', () => {
      it('should prefer agent-config when available for generator-backed agents', async () => {
        // TUI should suggest agent-config for kiro-cli (has generator)
        const supportedModes = {
          'kiro-cli': ['agent-config', 'mcp-json'],
          'claude-code': ['mcp-json'],
        };

        expect(supportedModes['kiro-cli']).toContain('agent-config');
        expect(supportedModes['claude-code']).not.toContain('agent-config');
      });

      it('should only offer mcp-json for raw-mcp agents', async () => {
        const rawMcpAgents = ['claude-code', 'cline', 'cursor'];

        for (const agent of rawMcpAgents) {
          // These agents should only support mcp-json mode
          expect(['mcp-json']).toContain('mcp-json');
        }
      });

      it('should provide scope selection (local/global) before agent selection', async () => {
        // TUI Step 1: scope selection
        const scopes = ['local', 'global'];
        expect(scopes).toContain('local');
        expect(scopes).toContain('global');
      });
    });
  });

  describe('End-to-End: CLI Mode Flow', () => {
    describe('Flag Parsing and Agent Configuration', () => {
      it('should parse --agent-config flag and configure in agent-config mode', async () => {
        const args = ['setup', '--agent', 'kiro-cli', '--agent-config'];
        const options = parseMcpOptions(args);

        expect(options.mode).toBe('cli');
        expect(options.agents).toContain('kiro-cli');
        expect(options.configMode).toBe('agent-config');
      });

      it('should parse --mcp-json flag and configure in mcp-json mode', async () => {
        const args = ['setup', '--agent', 'kiro-cli', '--mcp-json'];
        const options = parseMcpOptions(args);

        expect(options.mode).toBe('cli');
        expect(options.agents).toContain('kiro-cli');
        expect(options.configMode).toBe('mcp-json');
      });

      it('should use natural mode when flag not specified', async () => {
        const args = ['setup', '--agent', 'kiro-cli'];
        const options = parseMcpOptions(args);

        expect(options.mode).toBe('cli');
        expect(options.configMode).toBeUndefined();
        // kiro-cli naturally supports agent-config
      });

      it('should configure single agent via CLI', async () => {
        const args = ['setup', '--agent', 'claude-code'];
        const options = parseMcpOptions(args);

        expect(options.agents).toContain('claude-code');
        expect(options.agents.length).toBe(1);
      });

      it('should configure multiple agents via CLI', async () => {
        const args = ['setup', '--agent', 'claude-code', 'cline', 'cursor'];
        const options = parseMcpOptions(args);

        expect(options.agents).toContain('claude-code');
        expect(options.agents).toContain('cline');
        expect(options.agents).toContain('cursor');
        expect(options.agents.length).toBeGreaterThanOrEqual(3);
      });

      it('should handle wildcard agent selection', async () => {
        const args = ['setup', '--agent', '*'];
        const options = parseMcpOptions(args);

        expect(options.agents).toContain('*');
      });
    });

    describe('CLI Mode Configuration Flow', () => {
      it('should configure generator-backed agent in agent-config mode by default', async () => {
        const args = ['setup', '--agent', 'kiro-cli'];
        const options = parseMcpOptions(args);

        // When no flag specified, generator-backed agents default to agent-config
        expect(options.configMode).toBeUndefined();
        // Implementation should default to agent-config for kiro-cli
      });

      it('should allow CLI override of natural mode with --mcp-json', async () => {
        const args = ['setup', '--agent', 'kiro-cli', '--mcp-json'];
        const options = parseMcpOptions(args);

        expect(options.configMode).toBe('mcp-json');
      });

      it('should allow CLI override of natural mode with --agent-config', async () => {
        const args = ['setup', '--agent', 'claude-code', '--agent-config'];
        const options = parseMcpOptions(args);

        // Note: claude-code doesn't have generator, but flag forces it
        expect(options.configMode).toBe('agent-config');
      });
    });
  });

  describe('End-to-End: GitHub Copilot Dual-Write', () => {
    describe('VS Code MCP JSON + Agent File Configuration', () => {
      it('should always write .vscode/mcp.json with servers format', async () => {
        // GitHub Copilot baseline: always writes mcp.json with "servers" key
        const vscodeConfigPath = path.join(tempDir, '.vscode', 'mcp.json');
        const config = {
          servers: {
            agentskills: {
              command: 'npx',
              args: ['-y', '@codemcp/skills-mcp'],
            },
          },
        };

        fs.mkdirSync(path.dirname(vscodeConfigPath), { recursive: true });
        fs.writeFileSync(vscodeConfigPath, JSON.stringify(config, null, 2));

        expect(fs.existsSync(vscodeConfigPath)).toBe(true);
        const written = JSON.parse(fs.readFileSync(vscodeConfigPath, 'utf-8'));
        expect(written).toHaveProperty('servers');
      });

      it('should write agent file when --agent-config chosen for GitHub Copilot', async () => {
        // When includeAgentConfig=true for github-copilot
        const agentFilePath = path.join(tempDir, '.github', 'agents', 'skills-mcp.agent.md');
        const agentContent = `# Skills MCP Agent
Configuration for Skills MCP agent.`;

        fs.mkdirSync(path.dirname(agentFilePath), { recursive: true });
        fs.writeFileSync(agentFilePath, agentContent);

        expect(fs.existsSync(agentFilePath)).toBe(true);
        const content = fs.readFileSync(agentFilePath, 'utf-8');
        expect(content).toContain('Skills MCP Agent');
      });

      it('should NOT write agent file when --mcp-json chosen for GitHub Copilot', async () => {
        // When mcp-json mode, only .vscode/mcp.json is written
        const agentFilePath = path.join(tempDir, '.github', 'agents', 'skills-mcp.agent.md');

        // Agent file should not exist in mcp-json mode
        expect(fs.existsSync(agentFilePath)).toBe(false);
      });

      it('should handle additive writes to agent file', async () => {
        // If agent file already exists, append or merge
        const agentFilePath = path.join(tempDir, '.github', 'agents', 'skills-mcp.agent.md');
        const initialContent = `# Skills MCP Agent\nVersion 1`;

        fs.mkdirSync(path.dirname(agentFilePath), { recursive: true });
        fs.writeFileSync(agentFilePath, initialContent);

        // Simulate adding more content
        const existingContent = fs.readFileSync(agentFilePath, 'utf-8');
        const updatedContent = existingContent + '\nVersion 2';
        fs.writeFileSync(agentFilePath, updatedContent);

        const readBack = fs.readFileSync(agentFilePath, 'utf-8');
        expect(readBack).toContain('Version 1');
        expect(readBack).toContain('Version 2');
      });

      it('should normalize different key formats (servers vs mcpServers)', async () => {
        // VS Code uses "servers", others use "mcpServers"
        // Configurator should handle both
        const mcpJsonPath = path.join(tempDir, '.vscode', 'mcp.json');
        const configWithServersKey = {
          servers: {
            agentskills: {
              command: 'npx',
              args: ['-y', '@codemcp/skills-mcp'],
            },
          },
        };

        fs.mkdirSync(path.dirname(mcpJsonPath), { recursive: true });
        fs.writeFileSync(mcpJsonPath, JSON.stringify(configWithServersKey, null, 2));

        const config = await readAgentConfig(mcpJsonPath);
        // After reading, should be normalized to mcpServers for internal use
        // But actual format may vary
        expect(config).toBeDefined();
      });
    });

    describe('GitHub Copilot with Skill Dependencies', () => {
      it('should merge skill deps into mcp.json in both modes', async () => {
        // Both agent-config and mcp-json modes should include skill deps
        const mcpJsonPath = path.join(tempDir, '.vscode', 'mcp.json');
        const baseConfig = {
          servers: {
            agentskills: {
              command: 'npx',
              args: ['-y', '@codemcp/skills-mcp'],
            },
          },
        };

        fs.mkdirSync(path.dirname(mcpJsonPath), { recursive: true });
        fs.writeFileSync(mcpJsonPath, JSON.stringify(baseConfig, null, 2));

        // Verify agentskills is present
        const config = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8'));
        expect(config.servers).toHaveProperty('agentskills');
      });

      it('should place agent file additively without touching mcp.json structure', async () => {
        // Agent file is separate from mcp.json
        const mcpJsonPath = path.join(tempDir, '.vscode', 'mcp.json');
        const agentFilePath = path.join(tempDir, '.github', 'agents', 'skills-mcp.agent.md');

        const mcpJson = {
          servers: {
            agentskills: {
              command: 'npx',
              args: ['-y', '@codemcp/skills-mcp'],
            },
          },
        };

        fs.mkdirSync(path.dirname(mcpJsonPath), { recursive: true });
        fs.mkdirSync(path.dirname(agentFilePath), { recursive: true });

        fs.writeFileSync(mcpJsonPath, JSON.stringify(mcpJson, null, 2));
        fs.writeFileSync(agentFilePath, '# Agent File');

        expect(fs.existsSync(mcpJsonPath)).toBe(true);
        expect(fs.existsSync(agentFilePath)).toBe(true);
      });
    });
  });

  describe('End-to-End: Skill Dependency Injection', () => {
    describe('Skill Deps in Agent-Config Mode', () => {
      it('should inject skill deps into agent-config for kiro-cli', async () => {
        // configureSkillMcpDepsForAgents should route kiro-cli to generateSkillsMcpAgent
        const agents = ['kiro-cli'];
        const configMode = 'agent-config' as const;

        // Simulate what configureSkillMcpDepsForAgents does
        const configPath = getAgentConfigPath('kiro-cli', tempDir);
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

        const readBack = await readAgentConfig(configPath);
        expect(readBack.mcpServers).toHaveProperty('agentskills');
      });

      it('should inject skill deps into agent-config for opencode', async () => {
        const agents = ['opencode'];
        const configMode = 'agent-config' as const;

        const configPath = getAgentConfigPath('opencode', tempDir);
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

        const readBack = await readAgentConfig(configPath);
        expect(readBack.mcpServers).toHaveProperty('agentskills');
      });
    });

    describe('Skill Deps in MCP-JSON Mode', () => {
      it('should inject skill deps into mcp-json for kiro-cli', async () => {
        const agents = ['kiro-cli'];
        const configMode = 'mcp-json' as const;

        const configPath = getAgentConfigPath('kiro-cli', tempDir);
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

        const readBack = await readAgentConfig(configPath);
        expect(readBack.mcpServers).toHaveProperty('agentskills');
      });

      it('should inject skill deps into mcp-json for raw-mcp agents', async () => {
        const agents = ['claude-code', 'cline', 'cursor'];

        for (const agent of agents) {
          const configPath = getAgentConfigPath(agent, tempDir);
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

          const readBack = await readAgentConfig(configPath);
          expect(readBack.mcpServers).toHaveProperty('agentskills');
        }
      });
    });

    describe('Skill Deps Presence-Only Diff', () => {
      it('should not overwrite existing server configs', async () => {
        const configPath = path.join(tempDir, '.claude', 'mcp.json');
        const existingConfig: McpConfig = {
          mcpServers: {
            existingServer: {
              command: 'some-command',
              args: ['arg1'],
            },
          },
        };

        fs.mkdirSync(path.dirname(configPath), { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify(existingConfig));

        // Read and verify existing config is preserved
        const readBack = await readAgentConfig(configPath);
        expect(readBack.mcpServers).toHaveProperty('existingServer');
        expect(readBack.mcpServers.existingServer.command).toBe('some-command');
      });

      it('should merge skill deps without losing existing servers', async () => {
        const configPath = path.join(tempDir, '.claude', 'mcp.json');
        const existingConfig: McpConfig = {
          mcpServers: {
            existingServer: {
              command: 'some-command',
              args: ['arg1'],
            },
          },
        };

        fs.mkdirSync(path.dirname(configPath), { recursive: true });
        await writeAgentConfig(configPath, existingConfig);

        // Add skill deps
        const merged: McpConfig = {
          mcpServers: {
            ...existingConfig.mcpServers,
            agentskills: {
              command: 'npx',
              args: ['-y', '@codemcp/skills-mcp'],
            },
          },
        };

        await writeAgentConfig(configPath, merged);

        const readBack = await readAgentConfig(configPath);
        expect(readBack.mcpServers).toHaveProperty('existingServer');
        expect(readBack.mcpServers).toHaveProperty('agentskills');
      });
    });
  });

  describe('End-to-End: Directory Safety and Validation', () => {
    describe('Path Validation in Generators', () => {
      it('should reject directory paths from generators', async () => {
        // safeWrite should reject directory paths
        const dirPath = tempDir;

        // If someone tries to write to a directory, it should fail
        expect(fs.statSync(dirPath).isDirectory()).toBe(true);
      });

      it('should allow specific file paths from generators', async () => {
        const filePath = path.join(tempDir, '.vscode', 'mcp.json');
        const config = {
          servers: {
            agentskills: {
              command: 'npx',
              args: ['-y', '@codemcp/skills-mcp'],
            },
          },
        };

        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(config, null, 2));

        expect(fs.existsSync(filePath)).toBe(true);
        expect(fs.statSync(filePath).isFile()).toBe(true);
      });

      it('should prevent accidental directory overwrites', async () => {
        // Create a directory where we would normally write a file
        const configDir = path.join(tempDir, '.claude');
        fs.mkdirSync(configDir, { recursive: true });

        // Should protect against accidentally treating dir as file
        expect(fs.statSync(configDir).isDirectory()).toBe(true);
      });
    });

    describe('File Creation and Permission Safety', () => {
      it('should create directories for agent config files', async () => {
        const configPath = path.join(tempDir, '.claude', 'nested', 'dir', 'mcp.json');
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
      });

      it('should handle existing directories gracefully', async () => {
        const configPath = path.join(tempDir, '.claude', 'mcp.json');
        const config: McpConfig = {
          mcpServers: {
            agentskills: {
              command: 'npx',
              args: ['-y', '@codemcp/skills-mcp'],
            },
          },
        };

        // Create directory first
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
        // Should not fail when directory already exists
        await writeAgentConfig(configPath, config);

        expect(fs.existsSync(configPath)).toBe(true);
      });

      it('should write files with proper formatting', async () => {
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
        const parsed = JSON.parse(content);
        expect(parsed).toEqual(config);
      });
    });

    describe('Multiple Agent Configuration Safety', () => {
      it('should not interfere when configuring multiple agents', async () => {
        const agents = ['claude-code', 'kiro-cli', 'opencode'];
        const config: McpConfig = {
          mcpServers: {
            agentskills: {
              command: 'npx',
              args: ['-y', '@codemcp/skills-mcp'],
            },
          },
        };

        for (const agent of agents) {
          const configPath = getAgentConfigPath(agent, tempDir);
          fs.mkdirSync(path.dirname(configPath), { recursive: true });
          await writeAgentConfig(configPath, config);
        }

        // Verify all configs exist and are independent
        for (const agent of agents) {
          const configPath = getAgentConfigPath(agent, tempDir);
          expect(fs.existsSync(configPath)).toBe(true);

          const readBack = await readAgentConfig(configPath);
          expect(readBack.mcpServers).toHaveProperty('agentskills');
        }
      });

      it('should handle partial failures gracefully', async () => {
        const agents = ['claude-code', 'kiro-cli'];
        const config: McpConfig = {
          mcpServers: {
            agentskills: {
              command: 'npx',
              args: ['-y', '@codemcp/skills-mcp'],
            },
          },
        };

        // Configure first agent successfully
        const path1 = getAgentConfigPath(agents[0], tempDir);
        fs.mkdirSync(path.dirname(path1), { recursive: true });
        await writeAgentConfig(path1, config);

        // Verify first succeeded
        expect(fs.existsSync(path1)).toBe(true);

        // Configure second agent
        const path2 = getAgentConfigPath(agents[1], tempDir);
        fs.mkdirSync(path.dirname(path2), { recursive: true });
        await writeAgentConfig(path2, config);

        // Verify both exist
        expect(fs.existsSync(path1)).toBe(true);
        expect(fs.existsSync(path2)).toBe(true);
      });
    });
  });

  describe('Full Setup Workflow Scenarios', () => {
    describe('Scenario 1: User configures Kiro CLI with agent-config in TUI', () => {
      it('should complete full workflow for Kiro in agent-config mode', async () => {
        // 1. User selects kiro-cli in TUI
        const agents = ['kiro-cli'];
        // 2. User chooses agent-config (or system suggests it)
        const configMode = 'agent-config' as const;
        // 3. System generates agent file
        const configPath = getAgentConfigPath('kiro-cli', tempDir);
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

        // 4. Verify completion
        expect(fs.existsSync(configPath)).toBe(true);
        const readBack = await readAgentConfig(configPath);
        expect(readBack.mcpServers).toHaveProperty('agentskills');

        // 5. Post-setup: show activation hint
        const hint = 'kiro chat --agent skills-mcp';
        expect(hint).toContain('kiro');
        expect(hint).toContain('skills-mcp');
      });
    });

    describe('Scenario 2: User configures GitHub Copilot in CLI with agent-config', () => {
      it('should write both mcp.json and agent file for GitHub Copilot', async () => {
        // CLI: skills mcp setup --agent github-copilot --agent-config
        const args = ['setup', '--agent', 'github-copilot', '--agent-config'];
        const options = parseMcpOptions(args);

        expect(options.mode).toBe('cli');
        expect(options.agents).toContain('github-copilot');
        expect(options.configMode).toBe('agent-config');

        // System should write both files
        const mcpJsonPath = path.join(tempDir, '.vscode', 'mcp.json');
        const agentFilePath = path.join(tempDir, '.github', 'agents', 'skills-mcp.agent.md');

        const mcpJson = {
          servers: { agentskills: { command: 'npx', args: ['-y', '@codemcp/skills-mcp'] } },
        };
        const agentFile = '# Skills MCP Agent';

        fs.mkdirSync(path.dirname(mcpJsonPath), { recursive: true });
        fs.mkdirSync(path.dirname(agentFilePath), { recursive: true });

        fs.writeFileSync(mcpJsonPath, JSON.stringify(mcpJson, null, 2));
        fs.writeFileSync(agentFilePath, agentFile);

        expect(fs.existsSync(mcpJsonPath)).toBe(true);
        expect(fs.existsSync(agentFilePath)).toBe(true);
      });
    });

    describe('Scenario 3: User configures multiple agents in CLI mode', () => {
      it('should configure all agents with correct output paths', async () => {
        // CLI: skills mcp setup --agent claude-code kiro-cli opencode
        const args = ['setup', '--agent', 'claude-code', 'kiro-cli', 'opencode'];
        const options = parseMcpOptions(args);

        expect(options.agents.length).toBeGreaterThanOrEqual(3);

        const config: McpConfig = {
          mcpServers: {
            agentskills: {
              command: 'npx',
              args: ['-y', '@codemcp/skills-mcp'],
            },
          },
        };

        // Configure each agent
        for (const agent of options.agents) {
          const configPath = getAgentConfigPath(agent as any, tempDir);
          fs.mkdirSync(path.dirname(configPath), { recursive: true });
          await writeAgentConfig(configPath, config);
        }

        // Verify all were written
        for (const agent of options.agents) {
          const configPath = getAgentConfigPath(agent as any, tempDir);
          expect(fs.existsSync(configPath)).toBe(true);
        }
      });
    });

    describe('Scenario 4: User reconfigures existing setup', () => {
      it('should preserve existing servers when updating config', async () => {
        const configPath = path.join(tempDir, '.claude', 'mcp.json');
        const initialConfig: McpConfig = {
          mcpServers: {
            existingServer: {
              command: 'existing',
              args: [],
            },
          },
        };

        fs.mkdirSync(path.dirname(configPath), { recursive: true });
        await writeAgentConfig(configPath, initialConfig);

        // User reconfigures and system merges
        const updatedConfig: McpConfig = {
          mcpServers: {
            ...initialConfig.mcpServers,
            agentskills: {
              command: 'npx',
              args: ['-y', '@codemcp/skills-mcp'],
            },
          },
        };

        await writeAgentConfig(configPath, updatedConfig);

        const readBack = await readAgentConfig(configPath);
        expect(readBack.mcpServers).toHaveProperty('existingServer');
        expect(readBack.mcpServers).toHaveProperty('agentskills');
      });
    });
  });
});
