import fs from "node:fs";
import path from "node:path";
import type { TargetConfig } from "./target.js";
import { resolveTarget } from "./target.js";

const CONFIG_FILE = "loom.config.json";

interface LoomConfig {
  target: string;
  targetDir: string;
  contextFile: string;
}

export function saveConfig(target: TargetConfig, cwd = process.cwd()): void {
  const config: LoomConfig = {
    target: target.name,
    targetDir: target.dir,
    contextFile: target.contextFile,
  };
  const filePath = path.join(cwd, CONFIG_FILE);
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function loadConfig(cwd = process.cwd()): TargetConfig | null {
  const filePath = path.join(cwd, CONFIG_FILE);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const config = JSON.parse(raw) as LoomConfig;
    return resolveTarget(config.target, config.targetDir, config.contextFile);
  } catch {
    return null;
  }
}
