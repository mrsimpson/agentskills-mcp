# Getting Started

## Prerequisites

- Node.js 22 or later
- An MCP-compatible agent (Claude Desktop, Cline, Cursor, OpenCode, etc.)

## 1. Install

```bash
npm install -g @codemcp/skills
# or
pnpm add -g @codemcp/skills
```

This installs the `npx @codemcp/skills` executable.

**Alternatively**

If you prefer always typing npx over a global install (I do)

```bash
npx @codemcp/skills
```

## 2. Add Skills to Your Project

Navigate to your project directory, then add skills by name and source:

```bash
npx @codemcp/skills add git-workflow github:anthropics/agent-skills/skills/git-workflow
npx @codemcp/skills add code-review github:anthropics/agent-skills/skills/code-review
```

The `add` command validates the skill, installs it to `.agentskills/skills/`, and records it in `skills-lock.json`. See [Source Specifiers](/reference/source-specifiers) for all supported formats.

## 3. Install Skills

```bash
npx @codemcp/skills install
```

Skills are downloaded to `.agentskills/skills/` — a directory you can `.gitignore` just like `node_modules`. A `skills-lock.json` at the project root records each skill's source and content hash for reproducible installs. Commit it to share the same skills with your team.

## 4. Connect Your Agent

Use the automated MCP setup command:

```bash
npx @codemcp/skills mcp setup
```

This interactive command will:

1. Detect your installed agents
2. Ask which agents to configure
3. Auto-select the best configuration mode for each agent
4. Write the MCP server config to the right location

**Manual Setup (Advanced)**

If you prefer to configure manually, see [Connecting Agents](/guide/mcp-clients) for per-agent instructions. The general format is:

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

For detailed options and examples, see the [MCP Setup Guide](/guide/mcp-setup).

## 5. Use Skills

Once connected, your agent has access to:

- A `use_skill` tool — the agent calls it by skill name to receive instructions
- `skill://` resources — for browsing skill metadata

The agent's tool call looks like:

```
use_skill(skill_name: "git-workflow")
```

The server returns the raw skill instructions. The agent interprets and applies them.

## What's Next

- [Configuring Skills](/guide/configuration) — team config, multiple sources
- [CLI Reference](/guide/cli) — all available commands
- [SKILL.md Format](/reference/skill-format) — create your own skills
