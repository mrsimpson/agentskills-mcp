# Why Agent Skills MCP?

## The Problem

[Agent Skills](https://agentskills.io) are a powerful way to encode reusable workflows, context, and instructions for AI agents. But native implementations have friction:

| Pain Point               | Description                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| **Filesystem discovery** | Each agent tool uses a different directory (`.claude/skills`, etc.). Skills are tied to one tool. |
| **No selectivity**       | All skills are always loaded — you can't declare which ones a project actually needs.             |
| **No team sharing**      | Skill configurations live in developer home directories, not in version control.                  |
| **Unclear security**     | Scripts and dynamic commands run without a clear trust boundary.                                  |

## The Solution: An MCP Gateway

[Model Context Protocol (MCP)](https://modelcontextprotocol.io) has already solved tool distribution for AI agents. Agent Skills MCP uses the same mechanism — exposing skills as MCP tools — so the same solution works for every MCP-compatible agent.

```
package.json  ──declare──▶  npx @codemcp/skills install  ──download──▶  .agentskills/skills/
                                                                               │
Agent  ◀──MCP Protocol──  npx @codemcp/skills-server  ◀──load─────────────────┘
```

This gives you:

- **Declarative configuration** in `package.json` — version it alongside your code
- **Client independence** — same skills work in Claude Desktop, Cline, Cursor, and others
- **Explicit security boundary** — the server reads skill files; agents decide what to execute
- **Familiar tooling** — skill installation works like `npm install`

## When to Use This

**Context engineering at scale** — Break complex system prompts into named, reusable skills that any team member (or agent) can invoke.

**Team collaboration** — Commit your `agentskills` config to the repo. Everyone on the team, and every CI agent, uses the same skills.

**Multi-agent consistency** — The same skill runs identically in every MCP-compatible agent without per-tool configuration.

**Controlled skill libraries** — Curate exactly which skills are available for a project rather than loading everything from a global directory.

## What It Provides

1. **CLI** (`npx @codemcp/skills`) — install, add, list, and validate skills
2. **MCP Server** (`npx @codemcp/skills-server`) — exposes installed skills to any MCP agent
3. **Core library** (`@codemcp/skills-core`) — parsing, validation, and registry for programmatic use
