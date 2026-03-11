# SKILL.md Format

A skill is a directory containing a `SKILL.md` file. The file uses YAML frontmatter for metadata and Markdown for the instruction body.

```
my-skill/
  SKILL.md          # Required
  scripts/          # Optional supporting files
  references/       # Optional reference documents
  assets/           # Optional static assets
```

## Structure

```markdown
---
name: my-skill
description: A one-line summary of what this skill does
# ... additional fields
---

# My Skill

Instruction body in Markdown. This is what the agent receives
when it calls `use_skill`.
```

## JSON Schema

A machine-readable schema is published alongside the docs and can be used for IDE validation and autocomplete.

**Schema URL:**

```
https://mrsimpson.github.io/agentskills-mcp/skill-frontmatter-schema.json
```

### VS Code (YAML extension)

Add to `.vscode/settings.json` to enable validation for all `SKILL.md` files in the workspace:

```json
{
  "yaml.schemas": {
    "https://mrsimpson.github.io/agentskills-mcp/skill-frontmatter-schema.json": "**/SKILL.md"
  }
}
```

### Inline schema hint

Add a comment at the top of the frontmatter block (supported by some editors):

```yaml
# yaml-language-server: $schema=https://mrsimpson.github.io/agentskills-mcp/skill-frontmatter-schema.json
name: my-skill
description: ...
```

## Frontmatter Fields

### Required

| Field         | Type   | Constraints                                                                                |
| ------------- | ------ | ------------------------------------------------------------------------------------------ |
| `name`        | string | 1–64 chars · lowercase letters, numbers, hyphens · no leading/trailing/consecutive hyphens |
| `description` | string | 1–1024 chars                                                                               |

### Standard Optional Fields

| Field           | Type     | Description                                                  |
| --------------- | -------- | ------------------------------------------------------------ |
| `license`       | string   | SPDX license identifier, e.g. `MIT`                          |
| `compatibility` | string   | Agent compatibility string                                   |
| `metadata`      | object   | Arbitrary key-value metadata                                 |
| `allowedTools`  | string[] | Tools this skill is permitted to use                         |
| `labels`        | string[] | Tags for categorising skills (used for filtering, see below) |

### Claude Code Extensions

| Field                    | Type    | Description                                                                          |
| ------------------------ | ------- | ------------------------------------------------------------------------------------ |
| `disableModelInvocation` | boolean | If `true`, skill is excluded from `use_skill` enum                                   |
| `userInvocable`          | boolean | If `true`, skill is designed for direct user invocation                              |
| `argumentHint`           | string  | Hint shown to users about expected arguments                                         |
| `context`                | string  | Execution context hint                                                               |
| `agent`                  | string  | Target agent identifier                                                              |
| `model`                  | string  | Preferred model for this skill                                                       |
| `hooks`                  | object  | Lifecycle hook definitions                                                           |
| `requiresMcpServers`     | array   | MCP server dependencies (see [MCP Server Dependencies](/reference/mcp-dependencies)) |

## Argument Placeholders

The server returns skill content with placeholders intact. The agent is responsible for substitution:

| Placeholder      | Meaning                                                      |
| ---------------- | ------------------------------------------------------------ |
| `$ARGUMENTS`     | All arguments as a space-separated string                    |
| `$1`, `$2`, …    | Individual arguments by position (1-indexed)                 |
| `${SESSION_ID}`  | Session identifier (agent provides)                          |
| `` !`command` `` | Dynamic command to execute (flagged, not executed by server) |

## Example

```markdown
---
name: summarize-pr
description: Summarize a pull request for a code review
argumentHint: "<pr-url>"
---

# Summarize Pull Request

Fetch and summarize the pull request at $1.

Focus on:

- What changed and why
- Potential risks
- Suggested review focus areas
```

## Label Filtering

Skills can be tagged with one or more labels. When the MCP server starts with the `SKILL_LABELS` environment variable set, only skills whose labels overlap with the requested set are loaded (OR logic). Skills without labels are excluded when filtering is active.

```yaml
---
name: react-review
description: Review React component code
labels:
  - frontend
  - react
---
```

```bash
# Only load skills labelled "frontend" or "backend"
SKILL_LABELS=frontend,backend npx @codemcp/skills-mcp
```

If `SKILL_LABELS` is not set, all skills are loaded regardless of their labels.

## Validation Rules

Run `agentskills validate <path>` to check a skill file. Errors block installation; warnings are advisory.

**Errors** (must fix):

- Missing `name` or `description`
- `name` outside 1–64 characters, or contains uppercase/spaces/special chars, or has leading/trailing/consecutive hyphens
- `description` outside 1–1024 characters
- `compatibility` exceeds 500 characters
- `metadata` is not an object; `allowedTools` is not an array
- Malformed YAML frontmatter

**Warnings** (advisory):

- `description` shorter than 50 characters
- Missing `license` field
- Body content exceeds ~5000 tokens (20 000 characters)
