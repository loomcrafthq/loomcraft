import fs from "node:fs";
import path from "node:path";
import type { TargetConfig } from "./target.js";
import { resolveTarget } from "./target.js";
import type { LoomcraftConfig } from "./types.js";

const CONFIG_FILE = "loomcraft.config.json";

export function configPath(cwd = process.cwd()): string {
  return path.join(cwd, CONFIG_FILE);
}

export function saveConfig(
  target: TargetConfig,
  cwd = process.cwd(),
  opts: { preset?: string; agents?: string[]; skills?: string[] } = {}
): void {
  const config: LoomcraftConfig = {
    target: target.name,
    targetDir: target.dir,
    contextFile: target.contextFile,
    agents: opts.agents ?? [],
    skills: opts.skills ?? [],
  };
  if (opts.preset) config.preset = opts.preset;
  const filePath = configPath(cwd);
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function loadConfig(cwd = process.cwd()): LoomcraftConfig | null {
  const filePath = configPath(cwd);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      target: String(parsed.target ?? ""),
      targetDir: String(parsed.targetDir ?? ""),
      contextFile: String(parsed.contextFile ?? ""),
      preset: parsed.preset ? String(parsed.preset) : undefined,
      agents: Array.isArray(parsed.agents) ? parsed.agents.map(String) : [],
      skills: Array.isArray(parsed.skills) ? parsed.skills.map(String) : [],
    };
  } catch {
    return null;
  }
}

export function loadTarget(cwd = process.cwd()): TargetConfig | null {
  const config = loadConfig(cwd);
  if (!config) return null;
  try {
    return resolveTarget(config.target, config.targetDir, config.contextFile);
  } catch {
    return null;
  }
}

/** Add an agent ref to config (merge, no duplicates) */
export function addAgentToConfig(agentRef: string, cwd = process.cwd()): void {
  const config = loadConfig(cwd);
  if (!config) return;
  if (!config.agents.includes(agentRef)) {
    config.agents.push(agentRef);
    const filePath = configPath(cwd);
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  }
}
