# Upgrading the Vercel Skills CLI

This document explains how to upgrade the `packages/cli` directory with the latest changes from Vercel's [skills](https://github.com/vercel-labs/skills) repository.

## Overview

Our CLI is built on Vercel's open-source skills implementation, integrated via **git subtree**. This allows us to:

- Receive Vercel's improvements and bug fixes
- Maintain our own MCP Server install mode extensions
- Keep our customizations isolated for easy merging

## Architecture

```
packages/cli/
├── src/
│   ├── installer.ts          ← Vercel's code + our MCP mode additions
│   ├── add.ts                ← Vercel's code + our MCP UI additions
│   ├── api.ts                ← Our file (new, re-exports programmatic API)
│   ├── agents.ts             ← Vercel's code (unchanged)
│   ├── providers/            ← Vercel's code (unchanged)
│   └── ...                   ← Other Vercel files
├── bin/cli.mjs              ← Vercel's executable entry point
└── package.json             ← Our modified dependencies + exports field
```

### Our Custom Changes

We have **minimal, surgical modifications** to 2 files, plus 1 new file that is unaffected by upstream merges:

**packages/cli/src/installer.ts:**

- Added `'mcp-server'` to `InstallMode` type
- Added `getMCPCanonicalSkillsDir()` function (uses `.agentskills/skills` path)
- MCP server mode block in `installSkillForAgent()`: installs to canonical location, returns immediately
- Same MCP server mode block in `installRemoteSkillForAgent()` and `installWellKnownSkillForAgent()`
- No changes to existing symlink/copy logic

**packages/cli/src/add.ts:**

- MCP mode: install path hardcoded to `'mcp-server'` (bypasses symlink/copy prompt)
- Post-install message showing `@codemcp/skills-server` MCP server configuration
- Updated `buildAgentSummaryLines()` display logic for MCP mode
- Updated `buildResultLines()` display logic for MCP mode

**packages/cli/src/api.ts** (new file, never conflicts):

- Re-exports `runAdd`, `runInstallFromLock`, lock-file helpers for programmatic use
- Exposed via `"./api"` in `package.json` exports and built as a separate tsup entry
- Upgrade note: this file is unaffected by Vercel merges — it only imports from other modules

This isolation means:

- ✅ **Low conflict rate**: Most updates won't touch our code
- ✅ **Easy resolution**: When conflicts occur, they're localized
- ✅ **Additive changes**: We add new functionality, don't modify existing paths

## Upgrade Process

### Prerequisites

- You have push access to the repository
- Your working tree is clean: `git status`
- You understand git merge conflict resolution

### Step 1: Check for Updates

```bash
# List recent commits from Vercel
git log --oneline packages/cli | head -10

# Or fetch and check directly
git fetch https://github.com/vercel-labs/skills.git main
git log --oneline FETCH_HEAD | head -10
```

### Step 2: Identify the Vercel Baseline

Find the Vercel commit that was used when we last adopted the CLI. Check the git log for the adoption commit and note the date:

```bash
git log --all --oneline | grep -i "subtree\|vercel\|adopt"
# e.g., 830c291 feat: adopt Vercel's skills CLI via git subtree (Feb 26, 2026)
```

Then find the Vercel commit around that date:

```bash
git log --oneline FETCH_HEAD --after="YYYY-MM-DD" --before="YYYY-MM-DD" | head -5
# e.g., cc77715 v1.4.2
```

### Step 3: Pull from Upstream

> ⚠️ **Note:** `git subtree pull` will fail if the subtree was not originally set up with `git subtree add`. If you see `fatal: can't squash-merge: 'packages/cli' was never added.`, use the manual approach below instead.

**If git subtree works:**

```bash
git subtree pull --prefix=packages/cli https://github.com/vercel-labs/skills.git main --squash
```

**If git subtree fails (manual approach):**

```bash
# 1. Fetch the upstream
git fetch https://github.com/vercel-labs/skills.git main

# 2. Generate a diff of what changed in Vercel from your baseline to now
git diff <baseline-commit> FETCH_HEAD --name-only   # see changed files
git diff <baseline-commit> FETCH_HEAD -- src/<file>  # see changes in specific file

# 3. For pure Vercel files (not modified by us), copy directly:
git show FETCH_HEAD:src/agents.ts > packages/cli/src/agents.ts
# ... repeat for each pure Vercel file that changed

# 4. For our modified files (installer.ts, add.ts), apply upstream changes manually
#    while preserving our MCP mode blocks (see Step 4 below)

# 5. Handle file additions and deletions:
#    - New files in upstream: copy with git show FETCH_HEAD:src/<new-file>
#    - Deleted files: rm packages/cli/src/<deleted-file>
```

The pure Vercel files (no custom changes): `agents.ts`, `cli.ts`, `find.ts`, `list.ts`, `list.test.ts`, `mintlify.ts` (if present), `providers/`, `skill-lock.ts`, `skills.ts`, `source-parser.ts`, `types.ts`

### Step 4: Handle Merge Conflicts (If Any)

If there are no conflicts, skip to Step 4. If conflicts exist:

```bash
# See which files have conflicts
git status

# Check conflict locations
git diff --name-only --diff-filter=U
```

**Most likely conflicts in:**

- `packages/cli/src/installer.ts` - if Vercel refactored handler functions
- `packages/cli/src/add.ts` - if Vercel changed the installation flow

#### Resolving installer.ts Conflicts

Look for conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`):

```typescript
// Example conflict
<<<<<<< HEAD (our version)
if (installMode === 'mcp-server') {
  // Our MCP mode implementation
  await cleanAndCreateDirectory(canonicalDir);
  await copyDirectory(skill.path, canonicalDir);
  return { /* ... */ };
}
=======
// Vercel's updated code (might have refactored functions)
=======
```

**Resolution strategy:**

1. Keep our MCP blocks as-is (they're separate from Vercel's logic)
2. Apply Vercel's changes to the surrounding code
3. Ensure our `if (installMode === 'mcp-server')` blocks remain before Vercel's `copy` or `symlink` blocks

**Example resolution:**

```typescript
// After resolving conflicts, the pattern should be:
try {
  // Our new code: MCP server mode (added)
  if (installMode === 'mcp-server') {
    // ... our implementation
    return { /* ... */ };
  }

  // Vercel's existing code: copy mode
  if (installMode === 'copy') {
    // ... Vercel's implementation
  }

  // Vercel's existing code: symlink mode
  // ... rest of function
}
```

#### Resolving add.ts Conflicts

Similar approach:

1. **Prompt option**: Our MCP option should be added to the options array alongside Vercel's options

   ```typescript
   options: [
     { value: "symlink", label: "Symlink (Recommended)", hint: "..." },
     { value: "copy", label: "Copy to all agents", hint: "..." },
     { value: "mcp-server", label: "MCP Server (Cross-Client)", hint: "..." } // ← Ours
   ];
   ```

2. **Installation logic**: Our `if (installMode === 'mcp-server')` block should be before Vercel's per-agent loop

   ```typescript
   if (installMode === "mcp-server") {
     // Our implementation: single install
   } else {
     // Vercel's loop: per-agent installation
   }
   ```

3. **Post-install message**: Should appear after successful installation
   ```typescript
   // Show MCP server configuration instructions
   if (firstResult.mode === "mcp-server") {
     p.log.message(pc.dim("To use with MCP clients, add to your MCP config:"));
     p.log.message(
       pc.cyan(
         '  { "command": "npx", "args": ["-y", "@codemcp/skills-server"] }'
       )
     );
   }
   ```

#### Using Git Tools for Conflict Resolution

```bash
# See our version
git show :2:packages/cli/src/installer.ts > our-version.ts

# See Vercel's version
git show :3:packages/cli/src/installer.ts > their-version.ts

# Compare and manually merge into the actual file
# Then:
git add packages/cli/src/installer.ts
```

### Step 5: Verify the Merge

```bash
# Check that conflicts are resolved
git status

# Review the final changes
git diff --cached packages/cli/src/installer.ts
git diff --cached packages/cli/src/add.ts

# Look for remaining conflict markers
git grep "^<<<<<<<" packages/cli/
git grep "^=======$" packages/cli/
git grep "^>>>>>>>" packages/cli/
```

### Step 6: Build and Test

```bash
# Install dependencies (in case package.json changed)
pnpm install

# Build the CLI
pnpm build

# Expected output:
# ✅ obuild finished in XXXms
```

If build fails, check for syntax errors in your conflict resolution.

```bash
# Run tests (note: some Vercel tests may fail in our environment, that's OK)
pnpm test

# Run only core tests (less likely to have environmental issues)
pnpm --filter @codemcp/skills-core test
pnpm --filter @codemcp/skills-server test
```

### Step 7: Manual Testing

Test the MCP mode functionality to ensure it still works:

```bash
# Test 1: Build succeeded
ls -la packages/cli/dist/cli.mjs

# Test 2: Check MCP mode is still in installer.ts
grep -A 8 "if (installMode === 'mcp-server')" packages/cli/src/installer.ts

# Test 3: Check MCP UI option is in add.ts
grep -A 2 "MCP Server" packages/cli/src/add.ts

# Test 4: Verify paths are correct
grep "\.agents/skills" packages/core/src/package-config.ts
grep "\.agents/skills" packages/mcp-server/src/bin.ts
```

### Step 8: Commit the Upgrade

```bash
git add packages/cli packages/pnpm-lock.yaml
git commit -m "chore: upgrade Vercel skills CLI to latest

- Updated CLI with latest Vercel improvements
- Resolved conflicts in installer.ts (MCP mode preserved)
- Resolved conflicts in add.ts (MCP UI preserved)
- All builds and core tests passing

Vercel upstream: https://github.com/vercel-labs/skills

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

## Handling Complex Conflicts

### If Vercel Completely Refactored a Function

If Vercel made major changes to a function where we added MCP mode:

1. **Keep their new version** and re-apply our MCP block:

   ```bash
   # Check out their version
   git show MERGE_HEAD:packages/cli/src/installer.ts > installer-new.ts

   # Manually add our MCP block back into the new version
   # Copy our MCP block from a previous commit:
   git show c75ed39:packages/cli/src/installer.ts | grep -A 10 "if (installMode === 'mcp-server')"
   ```

2. **Re-apply the modification** following the same pattern (MCP block before copy/symlink blocks)

3. **Test thoroughly** - verify both MCP and standard modes work

### If Merge Has Too Many Conflicts

As a last resort:

```bash
# Abort the merge
git merge --abort

# Try a different approach: cherry-pick our MCP commits on top of new Vercel code
# This is rarely needed but is an option if subtree pull fails badly

# Fetch Vercel's latest
git fetch https://github.com/vercel-labs/skills.git main:refs/remotes/vercel/main

# Check out their latest as a base
git checkout -b upgrade-branch vercel/main

# Copy our MCP modifications manually from the commit history
git show c75ed39:packages/cli/src/installer.ts > /tmp/our-installer.ts
# Manual edit to merge...

# Then proceed with testing and committing
```

## Rollback Procedure

If something goes wrong during the upgrade:

```bash
# Revert the merge commit
git revert -m 1 <merge-commit-hash>

# Or reset to before the merge
git reset --hard HEAD~1

# Re-run the build to confirm
pnpm build
```

## Monitoring for Updates

Set up a periodic check:

```bash
# Create a simple script (save as scripts/check-upstream.sh)
#!/bin/bash
git fetch https://github.com/vercel-labs/skills.git main 2>/dev/null
BEHIND=$(git rev-list --count HEAD..FETCH_HEAD -- packages/cli)
if [ "$BEHIND" -gt 0 ]; then
  echo "⚠️  Vercel skills CLI has $BEHIND new commits"
  git log --oneline HEAD..FETCH_HEAD | head -5
fi
```

## References

- [Vercel skills repo](https://github.com/vercel-labs/skills)
- [Git Subtree Documentation](https://git-scm.com/book/en/v2/Git-Tools-Subtrees)
- [Our MCP modifications](./packages/cli/src/installer.ts#L22) - search for `'mcp-server'`

## Support

If you encounter issues:

1. **Check git log**: `git log --oneline packages/cli | head -20`
2. **Review previous upgrades**: Look at commit messages mentioning "upgrade Vercel"
3. **Compare versions**: `git diff c75ed39 HEAD -- packages/cli/src/installer.ts`
4. **Test isolation**: Build and test just the CLI: `cd packages/cli && pnpm build`
