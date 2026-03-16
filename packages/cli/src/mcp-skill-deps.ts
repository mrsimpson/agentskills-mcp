/**
 * Handles MCP server dependencies declared in skill frontmatter via `requires-mcp-servers`.
 *
 * Called from `mcp setup` after configuring the agentskills server so that
 * every agent the user selects also receives the individual MCP servers that
 * the installed skills require.
 */

import { promises as fs } from 'fs';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { AgentType, McpServerDependency } from './types.ts';
import type { SkillsMcpServerConfig } from '@codemcp/skills-core/mcp';
import { agents } from './agents.ts';
import {
  getAgentConfigPath,
  readAgentConfig,
  writeAgentConfig,
  generateSkillsMcpAgent,
  buildConfigGeneratorRegistry,
} from './mcp-configurator.ts';
import { discoverSkills } from './skills.ts';
import { getCanonicalSkillsDir, getMCPCanonicalSkillsDir } from './installer.ts';

// ── skill discovery ───────────────────────────────────────────────────────────

/**
 * Result of loading installed skill MCP dependencies.
 */
export interface InstalledSkillMcpDepsResult {
  /** Unique MCP server dependencies declared across all installed skills. */
  deps: McpServerDependency[];
  /**
   * Per-server allowed tools aggregated from all skills that use each server.
   * A tool entry uses the format `@server-name/tool-name` as declared in a
   * skill's `allowed-tools` frontmatter field. When a server has no entry here,
   * all tools should be allowed (wildcard behaviour).
   *
   * Only populated when at least one skill specifies `allowed-tools` for a
   * server. If any skill that depends on a given server does NOT restrict tools,
   * that server is omitted from this map (wildcard falls back).
   */
  allowedToolsByServer: Record<string, string[]>;
}

/**
 * Load all installed skills for the given scope and return the unique set of
 * MCP server dependencies declared across them, along with per-server allowed
 * tool restrictions derived from skill `allowed-tools` frontmatter.
 */
export async function loadInstalledSkillMcpDeps(
  cwd: string,
  scope: 'local' | 'global'
): Promise<InstalledSkillMcpDepsResult> {
  const isGlobal = scope === 'global';

  // Skills can live in the canonical .agents/skills dir or the MCP-server dir
  const searchDirs = [
    getCanonicalSkillsDir(isGlobal, cwd),
    getMCPCanonicalSkillsDir(isGlobal, cwd),
  ];

  const seen = new Map<string, McpServerDependency>();

  // For each server: accumulate allowed tools per skill. If any skill omits
  // allowed-tools for a server, that server should allow all tools (wildcard).
  const serverToolSets = new Map<string, Set<string> | 'wildcard'>();

  for (const dir of searchDirs) {
    try {
      const skills = await discoverSkills(dir, undefined, { fullDepth: true });
      for (const skill of skills) {
        for (const dep of skill.requiresMcpServers ?? []) {
          if (!seen.has(dep.name)) {
            seen.set(dep.name, dep);
          }

          // Collect allowed tools for this server from this skill's allowedTools
          const skillAllowedTools = skill.allowedTools;
          const serverName = dep.name;

          if (!skillAllowedTools || skillAllowedTools.length === 0) {
            // This skill doesn't restrict tools → server must allow all tools
            serverToolSets.set(serverName, 'wildcard');
          } else if (serverToolSets.get(serverName) !== 'wildcard') {
            // Filter allowedTools entries that belong to this server: @server-name/tool
            const prefix = `@${serverName}/`;
            const serverTools = skillAllowedTools
              .filter((t) => t.startsWith(prefix))
              .map((t) => t.slice(prefix.length));

            if (serverTools.length === 0) {
              // No tools explicitly listed for this server → wildcard for this server
              serverToolSets.set(serverName, 'wildcard');
            } else {
              const existing = serverToolSets.get(serverName);
              if (existing instanceof Set) {
                for (const t of serverTools) existing.add(t);
              } else {
                serverToolSets.set(serverName, new Set(serverTools));
              }
            }
          }
        }
      }
    } catch {
      // Directory may not exist — skip silently
    }
  }

  // Build the allowedToolsByServer map (only for servers with explicit restrictions)
  const allowedToolsByServer: Record<string, string[]> = {};
  for (const [serverName, toolsOrWildcard] of serverToolSets.entries()) {
    if (toolsOrWildcard instanceof Set) {
      allowedToolsByServer[serverName] = [...toolsOrWildcard];
    }
    // 'wildcard' entries are intentionally omitted → caller uses wildcard
  }

  return { deps: [...seen.values()], allowedToolsByServer };
}

// ── parameter resolution ──────────────────────────────────────────────────────

/** Replace `{{PARAM_NAME}}` placeholders with resolved values. */
function substituteParam(value: string, params: Record<string, string>): string {
  return value.replace(
    /\{\{([A-Za-z0-9_-]+)\}\}/g,
    (_, key: string) => params[key] ?? `{{${key}}}`
  );
}

function applyParams(
  dep: McpServerDependency,
  params: Record<string, string>
): { command: string; args?: string[]; env?: Record<string, string>; cwd?: string } {
  const result: { command: string; args?: string[]; env?: Record<string, string>; cwd?: string } = {
    command: dep.command,
  };
  if (dep.args?.length) result.args = dep.args.map((a) => substituteParam(a, params));
  if (dep.env && Object.keys(dep.env).length) {
    result.env = Object.fromEntries(
      Object.entries(dep.env).map(([k, v]) => [k, substituteParam(v, params)])
    );
  }
  if (dep.cwd) result.cwd = dep.cwd;
  return result;
}

async function resolveParameters(dep: McpServerDependency): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  if (!dep.parameters) return result;

  for (const [paramName, spec] of Object.entries(dep.parameters)) {
    // Resolve env-var defaults: {{ENV:VAR_NAME}}
    let resolved = spec.default;
    if (resolved?.startsWith('{{ENV:')) {
      const m = resolved.match(/\{\{ENV:([A-Za-z0-9_]+)\}\}/);
      if (m) resolved = process.env[m[1]!] ?? undefined;
    }

    if (resolved !== undefined) {
      result[paramName] = resolved;
      continue;
    }

    if (!spec.required) continue; // optional with no default — leave placeholder

    // Required parameter without a default — prompt the user
    const answer = await p.text({
      message: `${pc.cyan(dep.name)} needs ${pc.bold(paramName)}: ${spec.description}`,
    });

    if (p.isCancel(answer)) {
      p.cancel('MCP server configuration cancelled');
      process.exit(0);
    }

    result[paramName] = answer as string;
  }

  return result;
}

// ── main export ───────────────────────────────────────────────────────────────

/**
 * For each supplied agent, write any skill-required MCP servers that are not
 * yet present in that agent's config.
 *
 * The `configMode` parameter controls how generator-backed agents are handled:
 * - 'agent-config': deps are merged into the agent file via generateSkillsMcpAgent
 * - 'mcp-json':     deps are written to the raw mcp.json path even for generator-backed agents
 *
 * For agents without a generator, mcp.json is always used regardless of configMode.
 *
 * In all cases the diff rule is: only check presence of the server key —
 * never modify an existing server's configuration.
 *
 * @param deps                 MCP server dependencies collected from installed skills.
 * @param agentTypes           Agents that were just configured by `mcp setup`.
 * @param configCwd            Base directory for agent config files.
 * @param scope                'local' or 'global'.
 * @param configMode           Whether generator-backed agents use agent-config or mcp-json.
 * @param allowedToolsByServer Per-server tool restrictions derived from skill allowedTools.
 *                             When provided and a server has an entry, only those specific
 *                             tools are whitelisted in the generated agent config instead of
 *                             the default wildcard.
 */
export async function configureSkillMcpDepsForAgents(
  deps: McpServerDependency[],
  agentTypes: AgentType[],
  configCwd: string,
  scope: 'local' | 'global',
  configMode: 'agent-config' | 'mcp-json' = 'agent-config',
  allowedToolsByServer: Record<string, string[]> = {}
): Promise<void> {
  if (deps.length === 0 || agentTypes.length === 0) return;

  // Resolve parameters once (shared across all agents)
  const resolvedConfigs = new Map<
    string,
    { command: string; args?: string[]; env?: Record<string, string>; cwd?: string }
  >();

  for (const dep of deps) {
    const params = await resolveParameters(dep);
    resolvedConfigs.set(dep.name, applyParams(dep, params));
  }

  // Determine routing per agent: generator-backed in agent-config mode → regenerate agent file
  const registry = buildConfigGeneratorRegistry();

  let anyConfigured = false;

  for (const agentType of agentTypes) {
    const useAgentConfig = configMode === 'agent-config' && registry.supports(agentType as string);

    if (useAgentConfig) {
      // ── Generator-backed agents (Kiro, GitHub Copilot, OpenCode) ──────────
      // The agent file already exists (written by generateSkillsMcpAgent).
      // We need to know which servers are already in it to diff correctly,
      // then regenerate with the full merged set.
      //
      // For simplicity we re-run generateSkillsMcpAgent with the extra servers
      // — the generator always writes the canonical set so idempotent runs are
      // safe. The existing agentskills entry is never duplicated because it is
      // hardcoded in generateSkillsMcpAgent's baseConfig.
      const missingServers: Record<string, SkillsMcpServerConfig> = {};
      for (const dep of deps) {
        const resolved = resolvedConfigs.get(dep.name)!;
        const restrictedTools = allowedToolsByServer[dep.name];
        missingServers[dep.name] = {
          command: resolved.command,
          args: resolved.args,
          env: resolved.env,
          ...(resolved.cwd ? { cwd: resolved.cwd } : {}),
          // Only whitelist specific tools when the skill declares allowedTools
          // for this server; otherwise leave undefined so generators use wildcard.
          ...(restrictedTools ? { tools: restrictedTools } : {}),
        };
      }

      try {
        await generateSkillsMcpAgent(agentType, configCwd, scope, missingServers);
        for (const dep of deps) {
          p.log.success(
            `${pc.green('✓')} Added ${pc.cyan(dep.name)} to ${pc.dim(agents[agentType as AgentType]?.displayName || agentType)}`
          );
        }
        anyConfigured = true;
      } catch {
        p.log.warn(
          pc.yellow(
            `Could not update agent config for ${agents[agentType as AgentType]?.displayName || agentType} — add skill MCP servers manually`
          )
        );
      }
    } else {
      // ── Raw mcp.json agents (Claude, Cursor, Cline, …) ───────────────────
      // Import here to avoid circular dependency
      const { McpConfigAdapterRegistry } = await import('@codemcp/skills-core/mcp');
      const configPath = getAgentConfigPath(agentType, configCwd, scope);
      const config = await readAgentConfig(configPath, agentType);
      if (!config.mcpServers) config.mcpServers = {};

      let anyServerAdded = false;
      for (const dep of deps) {
        if (config.mcpServers[dep.name]) continue; // already configured — don't touch

        config.mcpServers[dep.name] = resolvedConfigs.get(dep.name)! as {
          command: string;
          args?: string[];
          env?: Record<string, string>;
        };
        anyServerAdded = true;

        p.log.success(
          `${pc.green('✓')} Added ${pc.cyan(dep.name)} to ${pc.dim(agents[agentType as AgentType]?.displayName || agentType)}`
        );
      }

      if (anyServerAdded) {
        try {
          // Use the adapter to convert to agent-specific format if needed
          const { McpConfigAdapterRegistry } = await import('@codemcp/skills-core/mcp');
          const adapter = McpConfigAdapterRegistry.getAdapter(agentType as any);

          // Read existing config to preserve other settings
          let existingAgentConfig: unknown;
          try {
            const existingContent = await fs.readFile(configPath, 'utf-8');
            existingAgentConfig = JSON.parse(existingContent);
          } catch {
            // File doesn't exist or isn't valid JSON
            existingAgentConfig = undefined;
          }

          // Convert to agent-specific format
          const agentSpecificConfig = adapter.toClient(config, existingAgentConfig);

          // Write in agent-specific format
          await writeAgentConfig(configPath, agentSpecificConfig as any);
          anyConfigured = true;
        } catch (error) {
          p.log.warn(
            pc.yellow(
              `Could not update MCP config for ${agents[agentType as AgentType]?.displayName || agentType} — add skills manually`
            )
          );
        }
      }
    }
  }

  if (anyConfigured) {
    console.log();
  }
}
