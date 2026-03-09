import fs from "node:fs";
import path from "node:path";
import type { TargetConfig } from "./target.js";
import type { AgentInfo, Preset } from "./types.js";
import { mergeContextFile } from "./generator.js";

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export function writeAgent(target: TargetConfig, slug: string, content: string, cwd = process.cwd()): string {
  const dir = path.join(cwd, target.dir, target.agentsSubdir, slug);
  ensureDir(dir);
  const filePath = path.join(dir, "AGENT.md");
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

// ---------------------------------------------------------------------------
// skills.json
// ---------------------------------------------------------------------------

export interface SkillsJson {
  name: string;
  version: string;
  description: string;
  skills: string[];
}

export function writeSkillsJson(skillsJson: SkillsJson, cwd = process.cwd()): string {
  const filePath = path.join(cwd, "skills.json");
  fs.writeFileSync(filePath, JSON.stringify(skillsJson, null, 2) + "\n", "utf-8");
  return filePath;
}

export function readSkillsJson(cwd = process.cwd()): SkillsJson | null {
  const filePath = path.join(cwd, "skills.json");
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as SkillsJson;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Context file (CLAUDE.md / .cursorrules)
// ---------------------------------------------------------------------------

export interface WriteContextOptions {
  merge?: boolean;
  agents?: AgentInfo[];
  skills?: string[];
  stackSummary?: string;
  preset?: Preset;
}

export function writeContextFile(
  target: TargetConfig,
  content: string,
  cwd = process.cwd(),
  options: WriteContextOptions = {}
): string {
  const filePath = path.join(cwd, target.contextFile);

  if (options.merge && fs.existsSync(filePath) && options.agents) {
    const existing = fs.readFileSync(filePath, "utf-8");
    const merged = mergeContextFile(
      existing,
      options.agents,
      target,
      options.skills ?? [],
      { stackSummary: options.stackSummary, preset: options.preset }
    );
    fs.writeFileSync(filePath, merged, "utf-8");
  } else {
    fs.writeFileSync(filePath, content, "utf-8");
  }

  return filePath;
}
