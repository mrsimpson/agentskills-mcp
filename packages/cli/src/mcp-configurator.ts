import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { AgentType } from './types.ts';
import type {
  McpConfig,
  McpServerConfig,
  SkillsMcpAgentConfig,
  SkillsMcpServerConfig,
} from '@codemcp/skills-core/mcp';
import {
  McpConfigAdapterRegistry,
  ConfigGeneratorRegistry,
  GitHubCopilotGenerator,
  KiroGenerator,
  OpenCodeMcpGenerator,
  OpenCodeAgentGenerator,
  VsCodeGenerator,
} from '@codemcp/skills-core/mcp';

/**
 * Type mapping from simplified agent names to MCP client types
 */
const AGENT_TO_MCP_CLIENT: Record<string, string> = {
  'claude-code': 'claude-desktop',
  claude: 'claude-desktop',
  cline: 'cline',
  cursor: 'cursor',
  'kiro-cli': 'kiro',
  kiro: 'kiro',
  junie: 'junie',
  opencode: 'opencode',
  zed: 'zed',
  continue: 'continue',
  'github-copilot': 'github-copilot',
  'mistral-vibe': 'mistral-vibe',
  windsurf: 'windsurf',
  codex: 'codex',
  'command-code': 'command-code',
  cortex: 'cortex',
  crush: 'crush',
  droid: 'droid',
  'gemini-cli': 'gemini-cli',
  goose: 'goose',
  'iflow-cli': 'iflow-cli',
  kilo: 'kilo',
  'kimi-cli': 'kimi-cli',
  kode: 'kode',
  mcpjam: 'mcpjam',
  mux: 'mux',
  neovate: 'neovate',
  openhands: 'openhands',
  pi: 'pi',
  qoder: 'qoder',
  'qwen-code': 'qwen-code',
  replit: 'replit',
  roo: 'roo',
  trae: 'trae',
  'trae-cn': 'trae-cn',
  zencoder: 'zencoder',
  pochi: 'pochi',
  adal: 'adal',
  universal: 'universal',
  amp: 'amp',
  antigravity: 'antigravity',
  augment: 'augment',
  openclaw: 'openclaw',
  codebuddy: 'codebuddy',
};

/**
 * Get the MCP configuration file path for an agent
 * @param agentType The agent type
 * @param cwd Current working directory (or home directory for global)
 * @param scope 'local' for project, 'global' for home directory
 * @returns The full path to the agent's MCP config file
 */
export function getAgentConfigPath(
  agentType: AgentType | string,
  cwd: string,
  scope: 'local' | 'global' = 'local'
): string {
  const mappedType = AGENT_TO_MCP_CLIENT[agentType] || agentType;
  // Note: cwd already contains the home directory if scope='global'

  switch (mappedType) {
    case 'claude-desktop':
      // Claude Desktop: store MCP config in project or home .claude/mcp.json
      return join(cwd, '.claude', 'mcp.json');
    case 'cline':
      // Cline: store in .cline/mcp.json
      return join(cwd, '.cline', 'mcp.json');
    case 'cursor':
      return join(cwd, '.cursor', 'mcp.json');
    case 'kiro':
      // Kiro: local .kiro/mcp.json | global ~/.kiro/agents/default.json
      if (scope === 'global') {
        return join(cwd, '.kiro', 'agents', 'default.json');
      }
      return join(cwd, '.kiro', 'mcp.json');
    case 'github-copilot':
      // GitHub Copilot runs in VS Code; VS Code reads .vscode/mcp.json (key: "servers")
      return join(cwd, '.vscode', 'mcp.json');
    case 'junie':
      // Junie: store in .junie/mcp.json
      return join(cwd, '.junie', 'mcp.json');
    case 'opencode':
      // OpenCode: local opencode.json | global ~/.config/opencode/opencode.json
      if (scope === 'global') {
        return join(cwd, '.config', 'opencode', 'opencode.json');
      }
      return join(cwd, 'opencode.json');
    case 'zed':
      return join(cwd, '.config', 'zed', 'settings.json');
    case 'continue':
      // Continue: store in .continue/config.json
      return join(cwd, '.continue', 'config.json');
    // For other agents, try to infer config path
    default:
      // Try to infer from agent name if possible
      const sanitized = mappedType.replace(/[^a-z0-9-]/gi, '_').toLowerCase();
      return join(cwd, `.${sanitized}`, 'mcp.json');
  }
}

/**
 * Read an agent's MCP configuration file.
 * Normalises agent-specific formats to the common McpConfig shape:
 *   - VS Code (.vscode/mcp.json) uses "servers" → normalised to "mcpServers"
 *   - OpenCode uses "mcp" → normalised to "mcpServers"
 * @param configPath Path to the config file
 * @returns The parsed config object, or empty config if file doesn't exist
 */
export async function readAgentConfig(configPath: string, agentType?: string): Promise<McpConfig> {
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const raw = JSON.parse(content) as Record<string, unknown>;

    // If agentType is provided, use the appropriate adapter to normalize format
    if (agentType) {
      const mappedType = AGENT_TO_MCP_CLIENT[agentType] || agentType;
      const adapter = McpConfigAdapterRegistry.getAdapter(mappedType as any);
      return adapter.toStandard(raw);
    }

    // No agentType provided - return raw config as-is
    // Caller is responsible for using the right adapter if needed
    return raw as unknown as McpConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { mcpServers: {} };
    }
    throw error;
  }
}

/**
 * Write an agent's MCP configuration file
 * @param configPath Path to the config file
 * @param config The config object to write
 */
export async function writeAgentConfig(configPath: string, config: McpConfig): Promise<void> {
  const dir = dirname(configPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
}

/**
 * Configure MCP server for an agent
 * @param agentType The agent type (e.g., 'claude-code', 'cline', 'cursor')
 * @param cwd Current working directory (or home directory if configuring globally)
 * @param scope 'local' for project, 'global' for home directory
 */
export async function configureAgentMcp(
  agentType: AgentType | string,
  cwd: string,
  scope: 'local' | 'global' = 'local'
): Promise<void> {
  // Validate agent type
  if (!agentType || typeof agentType !== 'string') {
    throw new Error(`Invalid agent type: ${agentType}`);
  }

  if (!AGENT_TO_MCP_CLIENT[agentType] && !isValidMcpClientType(agentType)) {
    throw new Error(`Unknown agent type: ${agentType}`);
  }

  // Get config path for this agent
  const configPath = getAgentConfigPath(agentType, cwd, scope);

  // Read existing config (use adapter to convert from agent-specific format if needed)
  let config = await readAgentConfig(configPath, agentType);

  // Ensure mcpServers exists
  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  // Define the MCP server config
  const mcpServerConfig: McpServerConfig = {
    command: 'npx',
    args: ['-y', '@codemcp/skills-server'],
  };

  // Update or add agentskills server
  config.mcpServers.agentskills = mcpServerConfig;

  // Use the appropriate adapter for the agent type to convert to agent-specific format
  const mappedType = AGENT_TO_MCP_CLIENT[agentType] || agentType;
  const adapter = McpConfigAdapterRegistry.getAdapter(mappedType as any);

  // Read existing config for this agent (to preserve other settings)
  let existingAgentConfig: unknown;
  try {
    const existingContent = await fs.readFile(configPath, 'utf-8');
    existingAgentConfig = JSON.parse(existingContent);
  } catch {
    // File doesn't exist or isn't valid JSON, that's okay
    existingAgentConfig = undefined;
  }

  // Convert to agent-specific format using the adapter
  const agentSpecificConfig = adapter.toClient(config, existingAgentConfig);

  await writeAgentConfig(configPath, agentSpecificConfig as McpConfig);
}

/**
 * Check if a string is a valid MCP client type
 */
function isValidMcpClientType(type: string): boolean {
  const validTypes = [
    'claude-desktop',
    'cline',
    'cursor',
    'kiro',
    'junie',
    'opencode',
    'zed',
    'continue',
    'codium',
  ];
  return validTypes.includes(type);
}

/**
 * A shared registry instance so callers can check which agents are
 * generator-backed without re-instantiating.
 *
 * VsCodeGenerator handles github-copilot et al. (baseline .vscode/mcp.json).
 * GitHubCopilotGenerator is NOT registered here — it is invoked separately
 * and additively when agent-config mode is requested for github-copilot.
 */
export function buildConfigGeneratorRegistry(): ConfigGeneratorRegistry {
  const registry = new ConfigGeneratorRegistry();
  registry.register(new VsCodeGenerator());
  registry.register(new KiroGenerator());
  registry.register(new OpenCodeMcpGenerator());
  return registry;
}

/**
 * SAFETY: generators MUST target specific named files — never a directory.
 * We validate every resolved path before writing to enforce this contract.
 */
async function safeWrite(filePath: string, content: string): Promise<void> {
  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      throw new Error(
        `Generator returned a directory path instead of a file path: ${filePath}. ` +
          `Generators must write to a specific named file and must never clear or overwrite directories.`
      );
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  const dir = dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

async function writeGeneratedConfig(generatedConfig: {
  files?: Array<{ path: string; content: string | Record<string, unknown> }>;
  filePath?: string | string[];
  content?: string | Record<string, unknown>;
}): Promise<void> {
  if (generatedConfig.files) {
    for (const file of generatedConfig.files) {
      const content =
        typeof file.content === 'string' ? file.content : JSON.stringify(file.content, null, 2);
      await safeWrite(file.path, content);
    }
  } else {
    const content =
      typeof generatedConfig.content === 'string'
        ? generatedConfig.content
        : JSON.stringify(generatedConfig.content, null, 2);
    await safeWrite(generatedConfig.filePath as string, content);
  }
}

/**
 * Generate skills-mcp agent configuration using the ConfigGeneratorRegistry.
 *
 * For VS Code / GitHub Copilot the model is additive:
 *   1. `.vscode/mcp.json` is ALWAYS written (the baseline server registration)
 *   2. `.github/agents/skills-mcp.agent.md` is written ADDITIONALLY when
 *      `includeAgentConfig` is true (default true for backward compatibility)
 *
 * @param agentType      The agent type
 * @param cwd            Current working directory (or home directory for global)
 * @param scope          'local' for project, 'global' for home directory
 * @param extraServers   Additional MCP servers to include alongside agentskills
 * @param includeAgentConfig  When true (default), also write the rich agent file
 *   for agents that support one (GitHub Copilot: .github/agents/*.agent.md)
 */
export async function generateSkillsMcpAgent(
  agentType: AgentType | string,
  cwd: string,
  scope: 'local' | 'global' = 'local',
  extraServers?: Record<string, SkillsMcpServerConfig>,
  includeAgentConfig = true
): Promise<void> {
  const registry = buildConfigGeneratorRegistry();
  const skillsDir = scope === 'global' ? homedir() : cwd;

  const baseConfig: SkillsMcpAgentConfig = {
    id: 'skills-mcp',
    description: 'Agent-skills MCP server with use_skill tool access',
    mcp_servers: {
      'agent-skills': {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@codemcp/skills-server'],
        tools: ['*'],
      },
      ...extraServers,
    },
    tools: { use_skill: true },
    permissions: { use_skill: 'allow' },
  };

  const generatorOptions = {
    skillsDir,
    agentId: 'skills-mcp',
    scope,
    isGlobal: scope === 'global',
    includeAgentConfig,
  };

  const generator = registry.getGenerator(agentType as string);
  if (!generator) {
    throw new Error(
      `No config generator found for agent type: ${agentType}. Supported types: ${registry
        .getSupportedAgentTypes()
        .join(', ')}`
    );
  }

  // 1. Always write the baseline config (e.g. .vscode/mcp.json for github-copilot or opencode.json for opencode)
  await writeGeneratedConfig(await generator.generate(baseConfig, generatorOptions));

  // 2. For GitHub Copilot: additionally write the agent file when requested
  //    (the VsCodeGenerator owns the baseline; GitHubCopilotGenerator owns the agent file)
  if (includeAgentConfig && generator instanceof VsCodeGenerator) {
    const agentFileGenerator = new GitHubCopilotGenerator();
    await writeGeneratedConfig(await agentFileGenerator.generate(baseConfig, generatorOptions));
  }

  // 3. For OpenCode: additionally write the agent file when requested
  //    (the OpenCodeMcpGenerator owns the baseline opencode.json; OpenCodeAgentGenerator owns the agent file)
  if (includeAgentConfig && generator instanceof OpenCodeMcpGenerator) {
    const agentFileGenerator = new OpenCodeAgentGenerator();
    await writeGeneratedConfig(await agentFileGenerator.generate(baseConfig, generatorOptions));
  }
}
