#!/usr/bin/env node

/**
 * Executable entry point for Agent Skills MCP Server
 *
 * Usage: npx @codemcp/skills-server [project-directory]
 *
 * If no directory provided, uses current working directory.
 * Skills are loaded from:
 * 1. ./.agentskills/skills (local directory, required)
 * 2. ~/.agentskills/skills (global directory, optional)
 *
 * Skills can be filtered using skills-lock.json in the .agentskills directory.
 */

import {
  SkillRegistry,
  getAllowedSkillsFromAgentskills
} from "@codemcp/skills-core";
import { MCPServer } from "./server.js";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

async function main() {
  // Get project directory from CLI args or use current directory
  const projectDir = process.argv[2] || process.cwd();

  // Validate project directory exists
  if (!fs.existsSync(projectDir)) {
    console.error(`Project directory not found: ${projectDir}`);
    process.exit(1);
  }

  // Validate it's a directory
  const projectStat = fs.statSync(projectDir);
  if (!projectStat.isDirectory()) {
    console.error(`Not a directory: ${projectDir}`);
    process.exit(1);
  }

  try {
    // Local skills directory
    const localSkillsDir = path.join(projectDir, ".agentskills", "skills");

    // Check if local skills directory exists
    if (!fs.existsSync(localSkillsDir)) {
      console.error(`Skills directory not found: ${localSkillsDir}`);
      console.error(
        `\nRun 'npx @codemcp/skills install' to install configured skills.`
      );
      process.exit(1);
    }

    // Build list of skill directories to search
    const skillsDirs = [localSkillsDir];

    // Add global skills directory if it exists
    const globalSkillsDir = path.join(os.homedir(), ".agentskills", "skills");
    if (fs.existsSync(globalSkillsDir)) {
      skillsDirs.push(globalSkillsDir);
    }

    // Get allowed skills from skills-lock.json (if it exists)
    const allowedSkills = await getAllowedSkillsFromAgentskills(projectDir);

    // Parse SKILL_LABELS env var for label-based filtering
    const skillLabelsEnv = process.env.SKILL_LABELS;
    const requiredLabels = skillLabelsEnv
      ? new Set(
          skillLabelsEnv
            .split(",")
            .map((l) => l.trim())
            .filter(Boolean)
        )
      : undefined;

    // Create registry and load skills from multiple directories with filtering
    const registry = new SkillRegistry();
    await registry.loadSkillsFromMultiple(
      skillsDirs,
      allowedSkills,
      requiredLabels
    );

    // Log info about loaded skills
    const state = registry.getState();
    if (state.skillCount === 0 && allowedSkills) {
      console.error(`Warning: No skills found matching skills-lock.json`);
    }

    // Create and start server
    const server = new MCPServer(registry);
    await server.start();

    // Server is now running via stdio
    // Keep process alive until stdin closes
    process.stdin.on("close", () => {
      process.exit(0);
    });
  } catch (error) {
    // Only write to stderr if we haven't started stdio communication
    process.stderr.write(`Failed to start MCP server: ${error}\n`);
    process.exit(1);
  }
}

main();
