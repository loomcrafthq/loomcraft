import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import * as p from "@clack/prompts";
import type { TargetConfig } from "../lib/target.js";
import { loadConfig, configPath } from "../lib/config.js";

export async function cleanCommand(
  target: TargetConfig,
  opts: { dryRun?: boolean }
): Promise<void> {
  const cwd = process.cwd();
  const config = loadConfig(cwd);

  // Collect files/dirs to remove
  const toRemove: { path: string; label: string; isDir: boolean }[] = [];

  // Agents directory
  const agentsDir = path.join(cwd, target.dir, target.agentsSubdir);
  if (fs.existsSync(agentsDir)) {
    toRemove.push({ path: agentsDir, label: `${target.dir}/${target.agentsSubdir}/`, isDir: true });
  }

  // skills.json
  const skillsJsonPath = path.join(cwd, "skills.json");
  if (fs.existsSync(skillsJsonPath)) {
    toRemove.push({ path: skillsJsonPath, label: "skills.json", isDir: false });
  }

  // loomcraft.config.json
  const cfgPath = configPath(cwd);
  if (fs.existsSync(cfgPath)) {
    toRemove.push({ path: cfgPath, label: "loomcraft.config.json", isDir: false });
  }

  // CLAUDE.md loomcraft sections (we'll strip them, not delete the file)
  const contextFilePath = path.join(cwd, target.contextFile);
  const hasContextFile = fs.existsSync(contextFilePath);

  if (toRemove.length === 0 && !hasContextFile) {
    console.log(pc.dim("\n  Nothing to clean.\n"));
    return;
  }

  // Preview
  console.log(pc.bold(pc.cyan("\n  Will remove:")));
  for (const item of toRemove) {
    console.log(`  ${pc.red("✗")} ${item.label}`);
  }
  if (hasContextFile) {
    console.log(`  ${pc.yellow("~")} ${target.contextFile} — strip loomcraft sections`);
  }

  if (opts.dryRun) {
    console.log(pc.dim("\n  Dry run — no files were modified.\n"));
    return;
  }

  // Confirm
  const confirmed = await p.confirm({
    message: "Proceed?",
    initialValue: false,
  });

  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  // Delete files and dirs
  for (const item of toRemove) {
    if (item.isDir) {
      fs.rmSync(item.path, { recursive: true, force: true });
    } else {
      fs.unlinkSync(item.path);
    }
    console.log(pc.red(`  ✗ ${item.label}`));
  }

  // Strip loomcraft sections from CLAUDE.md
  if (hasContextFile) {
    let content = fs.readFileSync(contextFilePath, "utf-8");
    const sections = [
      /<!-- loomcraft:stack:start -->[\s\S]*?<!-- loomcraft:stack:end -->\n*/g,
      /<!-- loomcraft:workflow:start -->[\s\S]*?<!-- loomcraft:workflow:end -->\n*/g,
      /<!-- loomcraft:agents:start -->[\s\S]*?<!-- loomcraft:agents:end -->\n*/g,
      /<!-- loomcraft:skills:start -->[\s\S]*?<!-- loomcraft:skills:end -->\n*/g,
      /<!-- loomcraft:custom:start -->[\s\S]*?<!-- loomcraft:custom:end -->\n*/g,
    ];
    for (const regex of sections) {
      content = content.replace(regex, "");
    }
    content = content.replace(/\n{3,}/g, "\n\n").trim() + "\n";
    fs.writeFileSync(contextFilePath, content, "utf-8");
    console.log(pc.yellow(`  ~ ${target.contextFile} — sections stripped`));
  }

  // Clean up empty .claude/ dir if it exists and is empty
  const targetDir = path.join(cwd, target.dir);
  if (fs.existsSync(targetDir)) {
    try {
      const remaining = fs.readdirSync(targetDir);
      if (remaining.length === 0) {
        fs.rmdirSync(targetDir);
        console.log(pc.red(`  ✗ ${target.dir}/`));
      }
    } catch {
      // Not empty, leave it
    }
  }

  console.log(pc.green("\n  Clean complete.\n"));
}
