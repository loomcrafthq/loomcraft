import fs from "node:fs";
import path from "node:path";
import type { TargetConfig } from "./target.js";
import { resolveTarget } from "./target.js";

const CONFIG_FILE = "loomcraft.config.json";

interface LoomcraftConfig {
  target: string;
  targetDir: string;
  contextFile: string;
  preset?: string;
}

export function saveConfig(target: TargetConfig, cwd = process.cwd(), presetSlug?: string): void {
  const config: LoomcraftConfig = {
    target: target.name,
    targetDir: target.dir,
    contextFile: target.contextFile,
  };
  if (presetSlug) config.preset = presetSlug;
  const filePath = path.join(cwd, CONFIG_FILE);
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function loadConfig(cwd = process.cwd()): TargetConfig | null {
  const filePath = path.join(cwd, CONFIG_FILE);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    // Only extract known fields to prevent prototype pollution
    const config: LoomcraftConfig = {
      target: String(parsed.target ?? ""),
      targetDir: String(parsed.targetDir ?? ""),
      contextFile: String(parsed.contextFile ?? ""),
    };
    return resolveTarget(config.target, config.targetDir, config.contextFile);
  } catch {
    return null;
  }
}

export function loadPresetSlug(cwd = process.cwd()): string | null {
  const filePath = path.join(cwd, CONFIG_FILE);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return parsed.preset ? String(parsed.preset) : null;
  } catch {
    return null;
  }
}
