import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { detectTargets, scanTarget, generatePresetYaml } from "../lib/scanner.js";
import { listAgents } from "../lib/library.js";

export async function importCommand(
  targetPath: string | undefined,
  opts: { dryRun?: boolean; json?: boolean }
): Promise<void> {
  try {
    const dir = targetPath || process.cwd();

    // 1. Detect targets
    const targets = detectTargets(dir);
    if (targets.length === 0) {
      p.log.error(
        "No .claude/ or .cursor/ directory found in " + pc.dim(dir)
      );
      p.log.info(
        "Run this command in a project directory that has an AI agent setup."
      );
      process.exit(1);
    }

    let selectedTarget: "claude-code" | "cursor";
    if (targets.length === 1) {
      selectedTarget = targets[0];
    } else {
      const choice = await p.select({
        message: "Multiple targets detected. Which one to import?",
        options: targets.map((t) => ({ value: t, label: t })),
      });
      if (p.isCancel(choice)) {
        p.cancel("Import cancelled.");
        process.exit(0);
      }
      selectedTarget = choice as "claude-code" | "cursor";
    }

    // 2. Scan
    const silent = !!opts.json;
    if (!silent) p.intro(pc.bold(`Scanning ${pc.cyan(selectedTarget)} in ${pc.dim(dir)}`));
    const result = scanTarget(dir, selectedTarget);

    if (result.agents.length === 0) {
      if (silent) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      p.log.warn("No agents found to import.");
      if (result.skipped.length > 0) {
        p.log.info(pc.dim("Skipped:"));
        for (const s of result.skipped) {
          p.log.info(pc.dim(`  ${s.path} — ${s.reason}`));
        }
      }
      process.exit(0);
    }

    // 3. Dedup vs bundled
    const bundledAgents = await listAgents();
    const bundledSlugs = new Set(bundledAgents.map((a) => a.slug));

    // 4. --json → output JSON
    if (opts.json) {
      const enriched = {
        ...result,
        agents: result.agents.map((a) => ({
          ...a,
          isBundled: bundledSlugs.has(a.slug),
        })),
      };
      console.log(JSON.stringify(enriched, null, 2));
      return;
    }

    // 5. Display summary
    const customAgents = result.agents.filter((a) => !bundledSlugs.has(a.slug));
    const bundledCount = result.agents.length - customAgents.length;

    p.log.info(
      `Found ${pc.bold(String(result.agents.length))} agents` +
        (bundledCount > 0 ? ` (${pc.dim(String(bundledCount) + " bundled")})` : "")
    );

    for (const agent of result.agents) {
      const tag = bundledSlugs.has(agent.slug) ? pc.dim("bundled") : pc.green("custom");
      p.log.info(`  ${pc.cyan(agent.slug)} — ${tag}`);
    }

    if (result.skipped.length > 0) {
      p.log.info(pc.dim("\nSkipped:"));
      for (const s of result.skipped) {
        p.log.info(pc.dim(`  ${s.path} — ${s.reason}`));
      }
    }

    // 6. --dry-run → stop
    if (opts.dryRun) {
      p.outro("Dry run complete — no files were written.");
      return;
    }

    // 7. Generate preset YAML
    const generatePreset = await p.confirm({
      message: "Generate a preset YAML from this setup?",
      initialValue: true,
    });

    if (p.isCancel(generatePreset) || !generatePreset) {
      p.outro("Done.");
      return;
    }

    const presetSlug = result.projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const presetYaml = generatePresetYaml(result.projectName, result.agents);
    const outputPath = path.join(dir, `${presetSlug}.preset.yaml`);
    fs.writeFileSync(outputPath, presetYaml, "utf-8");

    p.log.success(`Preset written to ${pc.green(outputPath)}`);
    p.log.info(pc.dim("\nTo share on the marketplace:"));
    p.log.info(pc.dim("  1. Push agents + preset to a GitHub repo"));
    p.log.info(pc.dim("     repo/agents/<slug>/AGENT.md"));
    p.log.info(pc.dim("     repo/presets/<slug>.yaml"));
    p.log.info(pc.dim("  2. Register on loomcraft.dev/marketplace"));

    p.outro(pc.green("Import complete!"));
  } catch (error) {
    if (error instanceof Error) {
      p.log.error(pc.red(error.message));
    } else {
      p.log.error(pc.red("An unknown error occurred."));
    }
    process.exit(1);
  }
}
