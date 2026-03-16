# CLI Reference

The `npx @codemcp/skills` CLI manages your skill configuration, installation, and agent connections.

## `npx @codemcp/skills mcp setup`

Configure your AI agent to use the Skills MCP server. This is the easiest way to connect agents like Claude Desktop, Cline, Cursor, Kiro, OpenCode, and 36+ others.

```bash
npx @codemcp/skills mcp setup [options]
```

**Interactive Mode (Recommended):**

```bash
npx @codemcp/skills mcp setup
```

This launches a wizard that guides you through scope selection, agent selection, and configuration.

**Command Line Mode:**

```bash
# Single agent
npx @codemcp/skills mcp setup --agent claude-code

# Multiple agents
npx @codemcp/skills mcp setup --agent claude-code cline cursor

# All agents
npx @codemcp/skills mcp setup --agent '*'

# Force specific configuration mode
npx @codemcp/skills mcp setup --agent kiro-cli --agent-config
npx @codemcp/skills mcp setup --agent cline --mcp-json

# Use global scope (home directory)
npx @codemcp/skills mcp setup --agent claude-code --global
```

**Options:**

| Option             | Description                                                                     |
| ------------------ | ------------------------------------------------------------------------------- |
| `--agent <agents>` | Agents to configure (space-separated list or `*` for all)                       |
| `--agent-config`   | Force rich agent-config mode (supported agents: GitHub Copilot, Kiro, OpenCode) |
| `--mcp-json`       | Force plain MCP JSON mode (universal, all agents)                               |
| `--global`         | Write to home directory (default: project directory)                            |
| `--help`           | Show help text                                                                  |

**See Also:** [MCP Setup Guide](/guide/mcp-setup) for detailed walkthrough and examples.

## `npx @codemcp/skills add`

Add a skill to `package.json` and validate it before writing.

```bash
npx @codemcp/skills add <name> <spec>
```

**Examples:**

```bash
npx @codemcp/skills add git-workflow github:anthropics/agent-skills/skills/git-workflow
npx @codemcp/skills add local-skill file:./my-skills/custom-skill
```

The skill is fetched, validated (format and metadata checked), and only added to `package.json` if valid. Run `npx @codemcp/skills install` afterwards to install all configured skills.

### Creating a skill from scratch

There is no built-in command to generate a skill from a name/description/body. To author your own skill:

1. Create a directory with a `SKILL.md` file — see the [skill format reference](/reference/skill-format) for the required structure.
2. Reference it locally:
   ```bash
   npx @codemcp/skills add my-skill file:./path/to/my-skill
   ```

The `file:` prefix accepts any local path. Writing the `SKILL.md` content is left to you (or to whatever generates it — a script, an agent, a template engine, etc.).

## `npx @codemcp/skills install`

Download and install all skills declared in `package.json`.

```bash
npx @codemcp/skills install [options]
```

| Option           | Description                                                               |
| ---------------- | ------------------------------------------------------------------------- |
| `--agent <name>` | Validate that required MCP servers are configured for the specified agent |
| `--with-mcp`     | Auto-configure missing MCP servers using `npx @codemcp/skills mcp setup`  |

**Supported agent names:** `claude`, `cline`, `continue`, `cursor`, `junie`, `kiro`, `opencode`, `zed` (and 33+ others)

**Examples:**

```bash
npx @codemcp/skills install                          # Install skills only
npx @codemcp/skills install --agent claude           # Install + validate MCP dependencies
npx @codemcp/skills install --with-mcp --agent cline # Install + auto-configure MCP servers
npx @codemcp/skills install --with-mcp --agent opencode # Install + auto-configure for OpenCode
```

Agent configs are written to the project directory (`.claude/`, `.kiro/`, `opencode.json`, etc.) or your home directory (`~/.claude/`, `~/.kiro/`, etc.) so they can be version-controlled.

**Note:** The `--with-mcp` option uses `npx @codemcp/skills mcp setup` internally. See [MCP Setup Guide](/guide/mcp-setup) for more control over MCP configuration.

## `npx @codemcp/skills list`

List all configured and installed skills.

```bash
npx @codemcp/skills list [options]
```

| Option         | Description                                      |
| -------------- | ------------------------------------------------ |
| `-g, --global` | List global skills (default: project)            |
| `-a, --agent`  | Filter by specific agents                        |
| `--json`       | Output as JSON (machine-readable, no ANSI codes) |

**Examples:**

```bash
npx @codemcp/skills list                 # list project skills
npx @codemcp/skills list -g              # list global skills
npx @codemcp/skills list -a claude-code  # filter by agent
npx @codemcp/skills list --json          # machine-readable JSON output
```

## `npx @codemcp/skills validate`

Validate a `SKILL.md` file against the Agent Skills standard.

```bash
npx @codemcp/skills validate <path>
```

**Example:**

```bash
npx @codemcp/skills validate ./my-skills/custom-skill/SKILL.md
```

Reports errors (blocking) and warnings (non-blocking) with field-level detail.
