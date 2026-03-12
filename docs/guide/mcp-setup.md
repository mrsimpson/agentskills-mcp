# MCP Setup Guide

The `npx @codemcp/skills mcp setup` command configures your AI agent to use the Skills MCP server. This is the easiest way to connect agents like Claude Desktop, Cline, Cursor, Kiro, OpenCode, and 36+ others.

## Quick Start

### Interactive Mode (Recommended)

```bash
npx @codemcp/skills mcp setup
```

This launches an interactive wizard that guides you through:

1. **Scope selection** — Local (project) or Global (home directory)
2. **Agent selection** — Choose which agents to configure
3. **Configuration mode** — Agent-config (rich) or MCP JSON (plain)
4. **Activation** — Copy the activation command for your agent

### Command Line Mode

Configure specific agents directly:

```bash
# Single agent
npx @codemcp/skills mcp setup --agent claude-code

# Multiple agents
npx @codemcp/skills mcp setup --agent claude-code cline cursor

# All agents
npx @codemcp/skills mcp setup --agent '*'

# Force specific mode
npx @codemcp/skills mcp setup --agent kiro-cli --agent-config
npx @codemcp/skills mcp setup --agent cline --mcp-json
```

## Two Configuration Modes

### Agent-Config Mode (Recommended for supported agents)

Creates a rich, structured agent file with:

- Complete server configuration
- Usage instructions
- Integration hints

**Supported agents:** GitHub Copilot, Kiro CLI, OpenCode

**Output:** Creates files like `.github/agents/skills-mcp.agent.md`, `.kiro/agents/skills-mcp.json`

**When to use:** When your agent supports it — cleaner, more maintainable

```bash
npx @codemcp/skills mcp setup --agent kiro-cli --agent-config
```

### MCP-JSON Mode (Universal)

Creates a standard MCP server registration JSON file.

**Supported:** All 41 agents

**Output:** Creates files like `.claude/mcp.json`, `.cline/mcp.json`, `opencode.json`

**When to use:** For agents without agent-config support, or when you prefer plain JSON

```bash
npx @codemcp/skills mcp setup --agent claude-code --mcp-json
```

## Scope: Local vs Global

### Local Scope (Default)

Writes configuration to your **project directory**. Best for team projects — configs are version-controlled.

```
my-project/
├── .claude/mcp.json          # Claude Desktop
├── .cline/mcp.json           # Cline
├── .cursor/mcp.json          # Cursor
└── package.json
```

Use local scope when:

- Working in a team project
- Want config in version control
- Multiple developers need same setup

### Global Scope

Writes configuration to your **home directory**. Best for personal workflows — one setup works everywhere.

```
~/.claude/mcp.json           # Claude Desktop
~/.cline/mcp.json            # Cline
~/.cursor/mcp.json           # Cursor
```

Use global scope when:

- Personal machine setup
- Want consistent config across all projects
- Don't want per-project configuration

## Command-Line Options

| Option             | Description                           | Example                     |
| ------------------ | ------------------------------------- | --------------------------- |
| `--agent <agents>` | Agents to configure (space-separated) | `--agent claude-code cline` |
| `--agent '*'`      | Configure all installed agents        | `--agent '*'`               |
| `--agent-config`   | Force agent-config mode               | `--agent-config`            |
| `--mcp-json`       | Force mcp-json mode                   | `--mcp-json`                |
| `--global`         | Use global scope (home dir)           | `--global`                  |
| `--help`           | Show help text                        | `--help`                    |

## Usage Examples

### Setup Claude Desktop (Interactive)

```bash
npx @codemcp/skills mcp setup
# Choose: Local scope
# Choose: Claude Desktop
# System auto-selects: MCP-JSON mode (no agent-config support)
# ✓ Configured: ~/.claude/mcp.json
```

### Setup Kiro (Command Line with Agent-Config)

```bash
npx @codemcp/skills mcp setup --agent kiro-cli --agent-config
# ✓ Configured: ~/.kiro/agents/skills-mcp.json
# Next: kiro chat --agent skills-mcp
```

### Setup Multiple Agents (Global Scope)

```bash
npx @codemcp/skills mcp setup --agent claude-code cline cursor --global
# ✓ Configured: ~/.claude/mcp.json
# ✓ Configured: ~/.cline/mcp.json
# ✓ Configured: ~/.cursor/mcp.json
```

### Setup GitHub Copilot with Agent File

```bash
npx @codemcp/skills mcp setup --agent github-copilot --agent-config
# ✓ Configured: ~/.vscode/mcp.json (baseline)
# ✓ Configured: ~/.github/agents/skills-mcp.agent.md
```

## After Setup: Activation

Once configured, you need to **restart** your agent for changes to take effect.

### Per-Agent Activation

**Claude Desktop**

```bash
# Close Claude Desktop, then reopen it
```

**Cline (VSCode Extension)**

```bash
# Restart VSCode or reload the Cline extension
```

**Cursor**

```bash
# Restart Cursor
```

**Kiro CLI**

```bash
kiro chat --agent skills-mcp
```

**OpenCode**

```bash
opencode --agent skills-mcp
# Or type: @skills-mcp inside OpenCode's TUI
```

**GitHub Copilot (VSCode)**

```bash
# Close and reopen VSCode
# Use the agent picker to select "Skills MCP"
```

## Supported Agents Reference

### Agent-Config Support (Rich Mode)

| Agent              | Detection                  | Output Path                                               | Activation                     |
| ------------------ | -------------------------- | --------------------------------------------------------- | ------------------------------ |
| **GitHub Copilot** | VSCode CLI present         | `.vscode/mcp.json` + `.github/agents/skills-mcp.agent.md` | Restart VSCode                 |
| **Kiro CLI**       | `kiro` command present     | `.kiro/agents/skills-mcp.json`                            | `kiro chat --agent skills-mcp` |
| **OpenCode**       | `opencode` command present | `.opencode/agents/skills-mcp.md`                          | `opencode --agent skills-mcp`  |

### MCP-JSON Only Support

All following agents use standard `mcpServers` JSON format.

| Agent          | Local Path                                        | Global Path                   |
| -------------- | ------------------------------------------------- | ----------------------------- |
| Claude Desktop | `.claude/mcp.json`                                | `~/.claude/mcp.json`          |
| Cline          | `.cline/mcp.json`                                 | `~/.cline/mcp.json`           |
| Continue       | `.continue/config.json`                           | `~/.continue/config.json`     |
| Cursor         | `.cursor/mcp.json`                                | `~/.cursor/mcp.json`          |
| Junie          | `.junie/mcp.json`                                 | `~/.junie/mcp.json`           |
| Zed            | `.config/zed/settings.json`                       | `~/.config/zed/settings.json` |
| And 35 more... | (See [Complete Agent List](#complete-agent-list)) |                               |

## Configuration File Formats

### Agent-Config Format (GitHub Copilot Example)

```json
// ~/.vscode/mcp.json
{
  "servers": {
    "agentskills": {
      "command": "npx",
      "args": ["-y", "@codemcp/skills-server"]
    }
  }
}
```

### MCP-JSON Format (Standard)

```json
// ~/.claude/mcp.json
{
  "mcpServers": {
    "agentskills": {
      "command": "npx",
      "args": ["-y", "@codemcp/skills-server"]
    }
  }
}
```

## Environment Variables

| Variable       | Description                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| `SKILL_LABELS` | Comma-separated list of labels. When set, only skills with at least one matching label are loaded (OR logic). |

Example MCP config with label filtering:

```json
{
  "mcpServers": {
    "agentskills": {
      "command": "npx",
      "args": ["-y", "@codemcp/skills-server"],
      "env": {
        "SKILL_LABELS": "frontend,react"
      }
    }
  }
}
```

See [Skill Format — Label Filtering](/reference/skill-format#label-filtering) for details on tagging skills with labels.

## Troubleshooting

### Config File Not Found After Setup

**Problem:** You set up an agent but can't find the config file.

**Solution:** Check the right location based on scope:

- Local: Look in your project's agent-specific directory (`.claude/`, `.cline/`, etc.)
- Global: Look in your home directory (`~/.claude/`, `~/.cline/`, etc.)

Use `find` to locate it:

```bash
find ~ -name "mcp.json" -o -name "*.agent.md" | grep skills
```

### Agent Not Detecting Skills MCP

**Problem:** I configured the agent but it's not showing the Skills MCP server.

**Solution:**

1. Verify the config file exists: `ls ~/.claude/mcp.json` (or your agent's path)
2. Verify the JSON is valid: `cat ~/.claude/mcp.json | jq`
3. **Restart your agent** — it caches configs on startup
4. Check that `npx @codemcp/skills-server` works: `npx @codemcp/skills-server --help`

### Wrong Configuration Mode

**Problem:** I configured with MCP-JSON but want Agent-Config mode.

**Solution:** Run setup again with the opposite flag:

```bash
npx @codemcp/skills mcp setup --agent kiro-cli --agent-config
```

### "Agent Not Installed" Error

**Problem:** You're trying to configure an agent that's not installed.

**Solution:** The CLI auto-detects installed agents. If you see this error:

1. Install the agent first (e.g., `brew install cursor`)
2. Or use `--agent '*'` to configure all detected agents
3. Or manually edit the config file (advanced)

## Next Steps

- [Add skills to your project](/guide/getting-started#2-add-skills-to-your-project)
- [Configure skills](/guide/configuration)
- [View all CLI commands](/guide/cli)
