# Connecting Agents

The MCP server (`npx @codemcp/skills-server`) communicates over stdio. Any MCP-compatible agent needs to know how to start it.

## Manual Configuration

Add this to your agent's MCP server configuration:

```json
{
  "mcpServers": {
    "agentskills": {
      "command": "npx",
      "args": ["-y", "@codemcp/skills-server"]
    }
  }
}
```

## Automatic Configuration

The CLI can write the configuration for you:

```bash
npx @codemcp/skills install --with-mcp --agent <name>
```

Configs are placed in the project directory so they can be committed to version control.

## Agent Config Locations

| Agent          | Config File                                                               |
| -------------- | ------------------------------------------------------------------------- |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) |
| Cline          | VS Code settings / `.cline/`                                              |
| Continue       | `.continue/config.json`                                                   |
| Cursor         | `.cursor/mcp.json`                                                        |
| Junie          | `.junie/`                                                                 |
| Kiro           | `.kiro/` (supports multiple config files)                                 |
| OpenCode       | `opencode.json` (project root)                                            |
| Zed            | `~/.config/zed/settings.json`                                             |

## How It Works at Runtime

When an agent connects:

1. The MCP server loads all installed skills from `.agentskills/skills/`
2. It registers a `use_skill` tool with an enum of available skill names
3. It exposes each skill as a `skill://<name>` resource

The agent calls `use_skill(skill_name: "my-skill")` and receives the raw skill instructions. Argument interpolation (e.g., `$ARGUMENTS`, `$1`) is the agent's responsibility — the server passes content through unchanged.

::: tip Restart after changes
Skills are loaded at startup. After running `npx @codemcp/skills install`, restart the MCP server (usually by restarting your agent or reloading its window).
:::
