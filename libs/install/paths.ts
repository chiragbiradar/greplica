import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type InstallPlatform = "codex" | "claude";
export type InstructionScope = "user" | "project" | "none";
export type InstallEmbedding = "local" | "openai";

export const skillNames = ["greplica-bootstrap", "greplica-update-working-memory"] as const;
export type SkillName = (typeof skillNames)[number];

export interface PlatformPaths {
  skillsRoot: string;
  userInstructionFile: string;
  projectInstructionFile: string;
}

export function packageRoot(): string {
  let current = dirname(fileURLToPath(import.meta.url));
  while (current !== dirname(current)) {
    if (existsSync(join(current, "package.json")) && existsSync(join(current, "skills"))) return current;
    current = dirname(current);
  }
  throw new Error("Could not locate Greplica package root with bundled skills.");
}

export function platformPaths(platform: InstallPlatform, projectRoot: string): PlatformPaths {
  if (platform === "codex") {
    const codexHome = process.env.CODEX_HOME ?? join(homedir(), ".codex");
    return {
      skillsRoot: join(codexHome, "skills"),
      userInstructionFile: join(codexHome, "AGENTS.md"),
      projectInstructionFile: join(projectRoot, "AGENTS.md"),
    };
  }

  const claudeHome = join(homedir(), ".claude");
  return {
    skillsRoot: join(claudeHome, "skills"),
    userInstructionFile: join(claudeHome, "CLAUDE.md"),
    projectInstructionFile: join(projectRoot, "CLAUDE.md"),
  };
}
