# Compared to Client-Native Skills

Many AI coding assistants (OpenCode, Cursor, Windsurf, etc.) have **native skill support** — built-in mechanisms for loading and executing skill instructions. This document explains how the MCP-based approach compares.

## TL;DR: It's Just Noodle Soup

There is no secret ingredient. Both approaches:

1. Load `SKILL.md` files with frontmatter metadata
2. Expose skills as tools with descriptions
3. Return skill instructions to the agent when invoked
4. Leave execution decisions to the agent

The **real difference** is **packaging and distribution**, not functionality.

## How Native Skill Tools Work (OpenCode Example)

OpenCode has a built-in `skill` tool that:

1. **Auto-discovers** skills from multiple locations:
   - `.claude/skills/` (global and project-level)
   - `.agents/skills/` (same)
   - `.opencode/skills/` (OpenCode-specific)
   - Custom paths from config
   - Remote URLs (downloaded to cache)

2. **Registers as a native tool** in the tool list with a dynamic description listing available skills

3. **Returns skill content** wrapped in XML when called:

   ```xml
   <skill_content name="commit">
   [Full SKILL.md content here]

   Base directory: file:///path/to/skill
   <skill_files>
     <file>/path/to/script.sh</file>
   </skill_files>
   </skill_content>
   ```

## How This MCP Server Works

The `npx @codemcp/skills-server` MCP server:

1. **Loads skills explicitly** from one configured location:
   - Declared in `package.json` agentskills field
   - Installed via `npx @codemcp/skills install` (like `npm install`)
   - Default: `.agentskills/skills/`

2. **Registers as an MCP tool** (`agentskills_use_skill`) with a dynamic description listing available skills

3. **Returns skill content** in JSON when called:
   ```json
   {
     "instructions": "[Full SKILL.md content here]",
     "basePath": "/path/to/.agentskills/skills/skill-name"
   }
   ```

## Side-by-Side Comparison

| Aspect                | Native (e.g. OpenCode)      | MCP Server (npx @codemcp/skills-server)  |
| --------------------- | --------------------------- | ---------------------------------------- |
| **Discovery**         | Auto-scan filesystem        | Explicit package.json declaration        |
| **Installation**      | Copy to `~/.claude/skills/` | `npx @codemcp/skills install` (like npm) |
| **Tool Registration** | Native client tool          | MCP protocol tool                        |
| **Tool Name**         | `skill`                     | `agentskills_use_skill`                  |
| **Output Format**     | XML with file listings      | JSON with basePath                       |
| **Skill Format**      | `SKILL.md` with frontmatter | `SKILL.md` with frontmatter (identical)  |
| **Execution**         | Agent decides               | Agent decides (same)                     |
| **Multi-client**      | Single client               | Any MCP client                           |
| **Version Control**   | Manual (copy files)         | Declarative (package.json)               |

## Key Similarities

### 1. Same File Format

Both use `SKILL.md` with YAML frontmatter:

```markdown
---
name: commit
description: "Always apply this skill when committing to git"
---

Create a conventional commit message...
```

### 2. Same Execution Model

Neither approach **executes** anything. Both:

- Parse the `SKILL.md` file
- Return the content to the agent
- Let the agent decide what to do with the instructions

The MCP server is **read-only**, just like native implementations should be.

### 3. Same Visibility to LLM

**Critical point**: Both approaches deliver skill instructions in **exactly the same place** — as tool results in the conversation history.

Tool outputs (whether from native `skill` or MCP `agentskills_use_skill`) become part of the **assistant's message history**, with full attention from the model. The XML vs JSON format doesn't matter — both have equal visibility once the tool is called.

```
User: Please commit my changes
Assistant: [calls skill tool]
Tool Result: [SKILL INSTRUCTIONS HERE] ← Model must process this
Assistant: [follows the instructions]
```

## The Real Difference: Distribution

The functional difference isn't in how skills work — it's in **how they're managed**:

### Native Approach

- ✅ Zero configuration for basic use
- ✅ Auto-discovery from standard paths
- ❌ Skills scattered across filesystem
- ❌ No clear version control story
- ❌ Team members must manually sync skills
- ❌ Client-specific (each tool has its own implementation)

### MCP Approach

- ✅ Declarative in `package.json`
- ✅ Version-controlled alongside code
- ✅ Team sync via git commit
- ✅ Works with any MCP client
- ✅ Reproducible installations (lock file)
- ❌ Requires explicit installation step

## Discovery Problem (Applies to Both)

**Neither approach mentions skills in system prompts** by default. This means:

1. The model sees skills in the **tool list** (among 20+ other tools)
2. The model must **spontaneously decide** to check for a skill
3. Once called, the skill instructions have **full visibility** in conversation history

### Improving Discovery

Clients can improve skill discovery by adding to their system prompts:

```
# Skills
Before starting significant tasks, check if a specialized skill exists.
Use the skill tool to load domain-specific instructions and workflows.
```

This is **up to the client developer**, not the skill tool itself. Both native and MCP approaches benefit equally from system prompt improvements.

## When to Use Which

### Use Native Skills When:

- You're only using one AI coding assistant
- You prefer filesystem-based discovery
- You don't need team synchronization
- Skills are personal/local

### Use MCP Skills When:

- You use multiple MCP-compatible agents (Claude Desktop, Cline, Cursor, etc.)
- You want skills version-controlled with your project
- Your team needs to share the same skill configurations
- You want reproducible skill environments (dev/CI/prod)
- You already use package.json for dependencies

## Can They Coexist?

**Not recommended.** Having both active creates confusion:

- Two tools with similar purposes (`skill` vs `agentskills_use_skill`)
- Models don't know which to use
- Skills might be in different locations with different contents

The MCP implementation automatically disables native skill tools (like OpenCode's `skill`) via permission configuration to avoid this conflict.

## Migration Path

Moving from native skills to MCP skills:

1. **Copy skill directories** from native locations (e.g., `.claude/skills/`) to `.agentskills/skills/`

2. **Add to package.json**:

   ```json
   {
     "agentskills": {
       "skills": {
         "commit": "file:../.agentskills/skills/commit",
         "tdd": "file:../.agentskills/skills/tdd"
       }
     }
   }
   ```

3. **Run installation**:

   ```bash
   npx @codemcp/skills install
   ```

4. **Configure MCP server** (see [MCP Clients](/guide/mcp-clients))

5. **Commit to git** — now your team has the same skills

## Summary

Native skill tools and MCP skill tools are **functionally equivalent** — they both parse `SKILL.md` files and return instructions to agents. The choice is about **packaging philosophy**:

- **Native**: Filesystem-based, auto-discovery, per-client
- **MCP**: Package-based, explicit, cross-client

Pick the approach that fits your team's workflow. There's no magic — just noodle soup! 🍜
