# Agent Skills MCP

[![npm version](https://badge.fury.io/js/%40codemcp%2Fagentskills.svg)](https://www.npmjs.com/package/@codemcp/agentskills)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Transform Agent Skills into MCP tools with team-shareable configuration

An MCP server that makes [Agent Skills](https://agentskills.io) available to any MCP-compatible agent through a declarative, package.json-based configuration.

## Why This Exists

**Agent Skills are powerful context engineering tools:**

- Break down long system prompts into reusable, parameterized components
- Follow an [open standard](https://agentskills.io) for portability across agents
- More powerful than prompts alone when bundled with tools and workflows

**But current implementations have pain points:**

- ❌ **Filesystem-based discovery**: Each agent uses different directories (`.claude/skills`, etc.)
- ❌ **No configuration control**: All skills always loaded, no filtering or organization
- ❌ **Unclear security model**: Dynamic tool calling and scripts are significant threats without proper sandboxing
- ❌ **No team sharing**: Hard to share skill configurations across teams

**The MCP Gateway Solution:**

MCP has already solved these problems for tools. By providing an MCP server as a "gateway" for Agent Skills:

- ✅ Address all pain points **client-independently** through a standardized interface
- ✅ Declarative configuration via `package.json` that teams can version and share
- ✅ Clear security model: server doesn't execute code, agents remain in control
- ✅ Skills + MCP tooling = powerful combination understood by all agents

## What It Does

This project provides:

1. **CLI** for installing and managing Agent Skills from multiple sources (GitHub, local, tarball URLs)
2. **MCP Server** that exposes installed skills as MCP tools to any compatible agent
3. **Core library** for parsing, validating, and working with Agent Skills

## Quick Start

### 1. Install

**Alternatively**

If you prefer always typing npx over a global install (I do)

```bash
npx @codemcp/skills
```

### 2. Configure Skills

Add skills using the CLI (validates the skill before adding it to `package.json`):

```bash
npx @codemcp/skills add git-workflow github:anthropics/agent-skills/skills/git-workflow
npx @codemcp/skills add local-skill file:./my-skills/custom-skill
```

Or edit `package.json` directly:

```json
{
  "agentskills": {
    "git-workflow": "github:anthropics/agent-skills/skills/git-workflow",
    "local-skill": "file:./my-skills/custom-skill",
    "shared-skill": "git+https://github.com/org/skills.git#v1.0.0"
  }
}
```

### 3. Install Skills

```bash
npx @codemcp/skills install
```

This downloads all configured skills to `.agentskills/skills/`.

## MCP Server Dependencies

Skills can declare MCP server dependencies that are automatically configured for your agent.

**Example SKILL.md frontmatter:**

```yaml
---
name: my-skill
requires-mcp-servers:
  - name: filesystem
    package: "@modelcontextprotocol/server-filesystem"
    description: "For file operations"
    command: npx
    args:
      ["-y", "@modelcontextprotocol/server-filesystem", "{{WORKSPACE_PATH}}"]
    parameters:
      WORKSPACE_PATH:
        description: "Root directory"
        required: true
        default: "."
---
```

**Install with validation:**

```bash
npx @codemcp/skills install --agent claude
```

**Auto-install missing servers:**

```bash
npx @codemcp/skills install --with-mcp --agent cline
```

**Supported agents:** `claude`, `cline`, `continue`, `cursor`, `junie`, `kiro`, `opencode`, `zed`

Configs are created in project directory (`.claude/`, `.kiro/`, `opencode.json`, etc.) for version control.

### 5. Configure MCP Client

Point your MCP client (Claude Desktop, Cline, Continue, Cursor, Junie, Kiro, OpenCode, Zed, etc.) to the server:

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

### 6. Use Skills

Your agent can now:

- Call the `use_skill` tool to execute skill instructions
- Browse available skills via `skill://` resources

The `use_skill` tool returns a JSON response with two fields:

```json
{
  "instructions": "# Skill Instructions\n\nThe full skill body content...",
  "basePath": "/absolute/path/to/.agentskills/skills/skill-name"
}
```

The `basePath` points to the skill's directory and allows agents to resolve relative references (per the [Agent Skills specification](https://agentskills.io/specification)):

- Scripts: `<basePath>/scripts/extract.py`
- References: `<basePath>/references/REFERENCE.md`
- Assets: `<basePath>/assets/template.json`

**Example**: If a skill references `scripts/setup.sh`, the agent can read it from:

```
<basePath>/scripts/setup.sh
```

## How It Works

```
package.json (config) → npx @codemcp/skills install → .agentskills/skills/
                                                        ↓
Agent ← MCP Protocol ← npx @codemcp/skills-server ← skill registry
```

1. **Configuration**: Declare skills in `package.json` like npm dependencies
2. **Installation**: CLI downloads skills from GitHub, local paths, or URLs using npm's Pacote
3. **Server**: MCP server reads installed skills and exposes them as tools
4. **Execution**: Agent calls `use_skill` tool, receiving skill instructions in context

## Features

- 🔌 **MCP Protocol Support** - Works with Claude Desktop, Cline, Continue, Cursor, Junie, Kiro, OpenCode, Zed, and other MCP clients
- 📦 **Package Manager Integration** - Declare skills in `package.json`, version control your configuration
- 🚀 **Multiple Sources** - Install from GitHub repos, local paths, or tarball URLs
- 🔧 **MCP Server Dependencies** - Skills declare required MCP servers, auto-configured for your agent
- ✅ **Validation** - Built-in parsing and validation for Agent Skills format
- 🔍 **Discovery** - Skills automatically exposed via MCP resources and tools
- 🔒 **Security** - Server only serves skill content; agents control execution
- 🧩 **Modular** - Three separate packages for different use cases

## Configuration

Skills are declared in the `agentskills` field of `package.json`:

```json
{
  "agentskills": {
    "skill-name": "source-specifier"
  }
}
```

### Source Specifiers

| Source Type               | Example                                                         | Description                                      |
| ------------------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| GitHub shorthand          | `github:user/repo/path/to/skill`                                | GitHub repo with subdirectory (convenience form) |
| GitHub shorthand with ref | `github:user/repo/path/to/skill#v1.0.0`                         | GitHub repo with subdirectory and tag/branch     |
| GitHub with `path:` attr  | `github:user/repo#v1.0.0::path:skills/my-skill`                 | Standard npm format with subdirectory            |
| Git URL                   | `git+https://github.com/org/repo.git#v1.0.0`                    | Full git URL with version tag                    |
| Git URL with `path:` attr | `git+https://github.com/org/repo.git#v1.0.0::path:skills/skill` | Git URL with subdirectory (npm standard)         |
| npm package               | `@org/my-skill` or `my-skill@1.2.0`                             | Published npm package                            |
| Local path                | `file:./skills/custom-skill`                                    | Relative or absolute local path                  |
| Tarball URL               | `https://example.com/skill.tgz`                                 | Remote tarball                                   |

The `path:` attribute syntax (`#ref::path:subdir`) follows the [npm/pacote standard](https://github.com/npm/npm-package-arg) for git subdirectory specifications. The GitHub shorthand form (`github:user/repo/subdir`) is a convenience alias for `github:user/repo#path:subdir`.

### Example Team Configuration

```json
{
  "name": "my-project",
  "agentskills": {
    "git-workflow": "github:anthropics/agent-skills/skills/git-workflow",
    "code-review": "github:anthropics/agent-skills/skills/code-review",
    "custom-api-docs": "file:./team-skills/api-documentation",
    "shared-workflow": "git+https://github.com/myorg/skills.git#v2.1.0"
  }
}
```

Commit this to your repo, and your entire team uses the same skills configuration.

## CLI Commands

### Install all configured skills

```bash
npx @codemcp/skills install
```

Options:

- `--agent <name>` - Validate MCP server dependencies for specified agent (claude, cline, continue, cursor, junie, kiro, zed)
- `--with-mcp` - Auto-install missing MCP servers and update agent config

### Add a new skill

```bash
npx @codemcp/skills add my-skill github:user/repo/path/to/skill
```

The `add` command validates the skill configuration (spec format, presence of `SKILL.md`,
and skill metadata) before writing anything. The skill is added to `package.json` only if
validation succeeds. Run `npx @codemcp/skills install` afterwards to download and install all
configured skills.

### List configured skills

```bash
npx @codemcp/skills list
```

### Validate a skill file

```bash
npx @codemcp/skills validate path/to/SKILL.md
```

## Creating Skills

A skill is a `SKILL.md` file with YAML frontmatter:

```markdown
---
name: example-skill
description: Does something useful
arguments:
  - name: target
    description: What to do it to
    required: true
---

# Example Skill

This is the skill body with instructions for the agent.

Use arguments like this: $ARGUMENTS or $1 (first argument).
```

See the [Agent Skills standard](https://agentskills.io) for full specification.

## Use Cases

**When to use Agent Skills MCP:**

- **Context Engineering** - Break down complex system prompts into modular, reusable pieces
- **Team Collaboration** - Share skill configurations across your team via version control
- **Multi-Agent Workflows** - Use the same skills across different MCP-compatible agents
- **Security Control** - Centralized skill management without giving agents filesystem access
- **Skill Libraries** - Build and share libraries of domain-specific skills (DevOps, testing, documentation, etc.)

## Project Structure

This is a monorepo containing three packages:

- **[@codemcp/skills-core](./packages/core)** - Core parsing, validation, and installation logic
- **[@codemcp/skills](./packages/cli)** - Command-line interface for skill management (based on Vercel's skills CLI)
- **[@codemcp/skills-mcp](./packages/mcp-server)** - MCP protocol server implementation

### Architecture & Integration

Learn more about how the pieces fit together:

- **[Vercel CLI Integration Guide](./docs/architecture/cli-integration.md)** - Why we use Vercel's CLI, how MCP Server mode extends it, and the path separation strategy
- **[Upgrading the CLI](./docs/guide/upgrading-cli.md)** - Step-by-step procedures for pulling upstream updates and handling merge conflicts

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests (302 tests)
pnpm test

# Run linting and formatting
pnpm run lint:all
pnpm run format:check:all
```

## Contributing

Contributions are welcome! Found a bug or have a feature request? [Open an issue](https://github.com/mrsimpson/agentskills/issues).

Pull requests for bug fixes, new features, or documentation improvements are appreciated.

## License

MIT, Oliver Jägle

## Links

- [Agent Skills Standard](https://agentskills.io) - Official specification
- [Model Context Protocol](https://modelcontextprotocol.io) - Learn about MCP
- [npm Package](https://www.npmjs.com/package/@codemcp/agentskills) - Published packages
- [Anthropic Agent Skills](https://github.com/anthropics/agent-skills) - Original skill collection
