# Development Plan: agent-skills (local-skill branch)

_Generated on 2026-03-04 by Vibe Feature MCP_
_Workflow: [bugfix](https://mrsimpson.github.io/responsible-vibe-mcp/workflows/bugfix)_

## Goal

Fix the issue where installing a local skill via `npx @codemcp/skills add ./.sabdx-skills/design/SKILL.md` fails with "No skills found" error despite the SKILL.md file existing.

## Reproduce

<!-- beads-phase-id: agent-skills-8.1 -->

### Tasks

_Tasks managed via `bd` CLI_

## Analyze

<!-- beads-phase-id: agent-skills-8.2 -->

### Phase Entrance Criteria:

- [ ] The bug has been reliably reproduced
- [ ] The error message and behavior are documented
- [ ] The expected vs actual behavior is clearly understood

### Tasks

_Tasks managed via `bd` CLI_

## Fix

<!-- beads-phase-id: agent-skills-8.3 -->

### Phase Entrance Criteria:

- [ ] Root cause has been identified
- [ ] The relevant code paths have been analyzed
- [ ] A fix approach has been determined

### Tasks

_Tasks managed via `bd` CLI_

## Verify

<!-- beads-phase-id: agent-skills-8.4 -->

### Phase Entrance Criteria:

- [ ] The fix has been implemented
- [ ] The code changes are complete

### Tasks

_Tasks managed via `bd` CLI_

## Finalize

<!-- beads-phase-id: agent-skills-8.5 -->

### Phase Entrance Criteria:

- [ ] The fix has been verified to resolve the issue
- [ ] Tests pass (if applicable)

### Tasks

- [ ] Squash WIP commits: `git reset --soft <first commit of this branch>. Then, Create a conventional commit. In the message, first summarize the intentions and key decisions from the development plan. Then, add a brief summary of the key changes and their side effects and dependencies

- [ ] Squash WIP commits: `git reset --soft <first commit of this branch>. Then, Create a conventional commit. In the message, first summarize the intentions and key decisions from the development plan. Then, add a brief summary of the key changes and their side effects and dependencies

_Tasks managed via `bd` CLI_

## Key Decisions

_Important decisions will be documented here as they are made_

## Notes

### Bug Analysis (Reproduce phase)

**Error:** `npx @codemcp/skills add ./.sabdx-skills/design/SKILL.md` fails with "No skills found"

**Root Cause Identified:**

1. User provides path to `SKILL.md` file directly: `./.sabdx-skills/design/SKILL.md`
2. `parseSource()` in `source-parser.ts` resolves this to the full file path
3. In `runAdd()`, code sets `skillsDir = parsed.localPath` which points to the **file**, not the directory
4. `discoverSkills(skillsDir, ...)` expects a **directory** as input
5. `hasSkillMd(searchPath)` checks for `<searchPath>/SKILL.md` - but `searchPath` IS the SKILL.md file
6. So it looks for `SKILL.md/SKILL.md` which doesn't exist
7. Result: "No skills found" error

**Expected Behavior:**

- When user provides `./path/to/SKILL.md`, the CLI should use `./path/to/` as the skill directory

**Fix Approach Options:**

1. Handle in `parseSource()`: detect if path ends with `SKILL.md` and strip it
2. Handle in `runAdd()`: detect if `localPath` is a file ending with `SKILL.md` and use parent dir

---

_This plan is maintained by the LLM and uses beads CLI for task management. Tool responses provide guidance on which bd commands to use for task management._
