# Vercel CLI Integration: Architecture & Rationale

This document explains why we adopted Vercel's skills CLI, how it integrates with our MCP Server, and how both work together to provide a unified agent skills ecosystem.

## Why Vercel's CLI?

### Maintenance & Sustainability

**Before**: Custom CLI implementation

- Single-author maintenance burden
- Feature requests required custom development
- Bug fixes tied to our release cycle
- Limited test coverage
- No community contribution path

**After**: Vercel's battle-tested CLI

- Mature, actively maintained by Vercel team
- Large install base (hundreds of thousands of developers)
- Comprehensive test suite
- Community contributions and bug reports
- Professional operations and security practices

### UX & Features

Vercel's CLI provides:

1. **Multi-source support**: GitHub, GitLab, custom domains, local paths, well-known registries
2. **Source parsing**: Smart URL detection (GitHub shorthand → full URLs)
3. **Skill discovery**: Integration with HuggingFace and Mintlify for automatic skill finding
4. **Caching & performance**: Local skill lock files, intelligent updates
5. **Agent detection**: Automatic detection of installed agents (Claude Code, Cursor, Cline, etc.)
6. **Symlink & copy modes**: Flexible installation strategies
7. **Global & project scopes**: Install skills for all projects or single project

### Reducing Duplication

Rather than reimplementing these features, we reuse Vercel's battle-tested code. This frees our team to focus on what's unique: **MCP Server mode**.

## The MCP Adaptation

### Why MCP Server Mode?

Standard skills CLI assumes direct agent installation (symlinks/copies to agent directories). But agents in the MCP ecosystem work differently:

**Standard agents** (Claude Code, Cursor):

```
skills add owner/repo
→ symlink to ~/.claude/skills/
→ Cursor reads ~/.cline/skills/
→ Each agent has its own skills location
```

**MCP clients** (any tool supporting MCP protocol):

```
skills add owner/repo --mcp-server
→ install to ~/.agentskills/skills/
→ @codemcp/skills-mcp server exposes skills
→ All MCP clients read from single server
```

This is fundamentally different from per-agent installation.

### Minimal, Surgical Changes

We extend the Vercel CLI with just **one new install mode** (`'mcp-server'`) in two files:

**installer.ts**:

```typescript
export type InstallMode = "symlink" | "copy" | "mcp-server";

// In each install handler (installSkillForAgent, etc.):
if (installMode === "mcp-server") {
  const canonicalDir = getMCPCanonicalSkillsDir();
  await copyDirectory(skill.path, canonicalDir);
  return {
    /* result with mode */
  };
}
```

**add.ts**:

```typescript
// Add MCP option to prompt
options: [
  { value: 'symlink', ... },
  { value: 'copy', ... },
  { value: 'mcp-server', label: 'MCP Server (Cross-Client)', ... }
]

// For MCP mode, skip per-agent selection
if (mode === 'mcp-server') {
  targetAgents = getUniversalAgents(); // Just .agents/skills
}
```

This approach means:

- ✅ Vercel's logic remains untouched for symlink/copy modes
- ✅ Our code is visibly separated (easy to identify, maintain, rebase)
- ✅ Future upstream upgrades have minimal conflicts
- ✅ Can cherry-pick MCP changes when pulling Vercel updates

## Architecture: How It All Fits Together

```
┌─────────────────────────────────────────────────────────┐
│ User runs: npx @codemcp/skills add owner/repo           │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ├─ Source parsing
                   │  ├─ GitHub shorthand? → https://github.com/owner/repo
                   │  ├─ GitLab URL? → Extract from URL
                   │  └─ Skill discovery (Mintlify, HF)
                   │
                   └─ Installation method prompt
                      ├─ Symlink (Recommended)
                      ├─ Copy to all agents
                      └─ MCP Server (Cross-Client) ← NEW
                         │
                         ├─ If chosen:
                         │  ├─ Skip agent selection (universal only)
                         │  ├─ Install to .agentskills/skills/
                         │  └─ Return mode: 'mcp-server'
                         │
                         └─ Vercel's handler functions
                            (unchanged for symlink/copy)
```

## Path Separation Strategy

We maintain **two** skills directories:

### `.agents/skills/` (Standard Agents)

- Used by: Claude Code, Cursor, Cline, etc.
- Installation: symlink/copy mode
- Access: Direct file system
- Example: `~/.agents/skills/commit/SKILL.md`

### `.agentskills/skills/` (MCP Server)

- Used by: @codemcp/skills-mcp server
- Installation: mcp-server mode
- Access: MCP protocol → JSON tools
- Example: `~/.agentskills/skills/commit/SKILL.md`

**Why two locations?**

- Preserves backward compatibility with existing symlink/copy installations
- Allows MCP Server to have its own, isolated skill repository
- Different performance characteristics (MCP caches differently)
- Clear separation of concerns: agent-specific vs. cross-client

**Path Resolution**:

```typescript
// In installer.ts
export function getMCPCanonicalSkillsDir(global: boolean, cwd?: string) {
  return join(baseDir, '.agentskills', 'skills');  // MCP path
}

export function getCanonicalSkillsDir(global: boolean, cwd?: string) {
  return join(baseDir, '.agents', 'skills');       // Standard path
}

// Use based on install mode:
const canonicalDir = installMode === 'mcp-server'
  ? getMCPCanonicalSkillsDir(...)
  : getCanonicalSkillsDir(...);
```

## Integration with MCP Server

When a user selects MCP mode:

```
┌────────────────────────────────────────────────┐
│ 1. Skill installed to .agentskills/skills/    │
└──────────────────┬─────────────────────────────┘
                   │
                   └─ skill/
                      ├─ SKILL.md (metadata)
                      ├─ src/ (implementation)
                      └─ dist/ (compiled)
```

The MCP Server reads from this location:

```typescript
// In packages/mcp-server/src/bin.ts
const DEFAULT_SKILLS_DIR = '.agentskills/skills';

// Server startup:
const registry = new SkillRegistry(skillsDir);
const skills = await registry.loadSkills();

// Tools available to MCP clients:
server.tool('use_skill', {
  description: 'Execute a skill',
  inputSchema: {...},
  execute: async (params) => {
    const skill = registry.getSkill(params.skillName);
    return await skill.execute(params.input);
  }
});
```

MCP clients (Claude Code, IDE extensions, etc.) can now call:

```json
{
  "tool": "use_skill",
  "input": {
    "skillName": "commit",
    "input": "Create a feature branch"
  }
}
```

## Coordination Between Modes

Users can have **both** installation modes active:

```
┌──────────────────────────────────────────────────┐
│ Skills Available                                  │
├──────────────────────────────────────────────────┤
│ .agents/skills/                                   │
│  ├─ commit/           (symlink - via skills CLI)  │
│  ├─ debug/            (copy - via skills CLI)     │
│  └─ linter/           (symlink - via skills CLI)  │
│                                                   │
│ .agentskills/skills/                              │
│  ├─ commit/           (MCP mode - via skills CLI) │
│  ├─ refactor/         (MCP mode - via skills CLI) │
│  └─ custom-skill/     (MCP mode - via skills CLI) │
└──────────────────────────────────────────────────┘

Claude Code (IDE agent)        → reads .agents/skills/
MCP clients (via server)       → reads .agentskills/skills/
```

This allows:

- ✅ Smooth migration (users can add via MCP mode while keeping existing skills)
- ✅ Experimentation (test MCP Server without affecting IDE)
- ✅ Flexibility (use symlink for fast iteration, MCP mode for cross-client exposure)
