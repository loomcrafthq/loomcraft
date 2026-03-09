import * as p from "@clack/prompts";
import pc from "picocolors";
import { detectTargets, scanTarget, generatePresetYaml } from "../lib/scanner.js";
import type { ScannedAgent } from "../lib/scanner.js";
import { listAgents } from "../lib/library.js";
import {
  getLocalAgent,
  saveLocalAgent,
  saveLocalPreset,
} from "../lib/local-library.js";

type DedupStatus = "new" | "duplicate-bundled" | "duplicate-local";

interface DedupItem {
  slug: string;
  name: string;
  status: DedupStatus;
}

function statusLabel(status: DedupStatus): string {
  switch (status) {
    case "new":
      return pc.green("new");
    case "duplicate-bundled":
      return pc.yellow("bundled duplicate");
    case "duplicate-local":
      return pc.yellow("local duplicate");
  }
}

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
        console.log(JSON.stringify({ ...result, dedup: [] }, null, 2));
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
    const bundledAgentSlugs = new Set(bundledAgents.map((a) => a.slug));

    // 4. Dedup vs local
    const items: DedupItem[] = [];

    for (const agent of result.agents) {
      let status: DedupStatus = "new";
      if (bundledAgentSlugs.has(agent.slug)) {
        status = "duplicate-bundled";
      } else if (getLocalAgent(agent.slug)) {
        status = "duplicate-local";
      }
      items.push({ slug: agent.slug, name: agent.name, status });
    }

    // 5. --json → output enriched JSON
    if (opts.json) {
      const enriched = {
        ...result,
        dedup: items.map((i) => ({
          slug: i.slug,
          name: i.name,
          status: i.status,
        })),
      };
      console.log(JSON.stringify(enriched, null, 2));
      return;
    }

    // 6. Display summary
    const newCount = items.filter((i) => i.status === "new").length;
    const dupCount = items.length - newCount;

    p.log.info(
      `Found ${pc.bold(String(result.agents.length))} agents` +
        (dupCount > 0 ? ` (${pc.yellow(String(dupCount) + " duplicates")})` : "")
    );

    for (const item of items) {
      p.log.info(`  ${pc.cyan("[agent]")} ${pc.bold(item.slug)} — ${statusLabel(item.status)}`);
    }

    if (result.skipped.length > 0) {
      p.log.info(pc.dim("\nSkipped:"));
      for (const s of result.skipped) {
        p.log.info(pc.dim(`  ${s.path} — ${s.reason}`));
      }
    }

    // 7. --dry-run → stop
    if (opts.dryRun) {
      p.outro("Dry run complete — no files were written.");
      return;
    }

    // 8. Interactive selection
    const importable = items.filter((i) => i.status !== "duplicate-bundled");
    if (importable.length === 0) {
      p.log.warn("All items are bundled duplicates — nothing to import.");
      p.outro("Done.");
      return;
    }

    const selected = await p.multiselect({
      message: "Select agents to import into your local library:",
      options: importable.map((item) => ({
        value: item.slug,
        label: `[agent] ${item.slug}`,
        hint: item.status === "duplicate-local" ? "will overwrite" : undefined,
      })),
      initialValues: importable
        .filter((i) => i.status === "new")
        .map((i) => i.slug),
    });

    if (p.isCancel(selected)) {
      p.cancel("Import cancelled.");
      process.exit(0);
    }

    const selectedSlugs = new Set(selected as string[]);

    // 9. Save selected agents
    const agentMap = new Map(result.agents.map((a) => [a.slug, a]));
    let savedCount = 0;

    for (const item of importable) {
      if (!selectedSlugs.has(item.slug)) continue;
      const agent = agentMap.get(item.slug)!;
      saveLocalAgent(item.slug, agent.content);
      savedCount++;
    }

    p.log.success(`Saved ${pc.bold(String(savedCount))} agents to ~/.loomcraft/library/`);

    // 10. Preset generation
    const generatePreset = await p.confirm({
      message: "Generate a preset from this import?",
      initialValue: true,
    });

    if (!p.isCancel(generatePreset) && generatePreset) {
      const selectedAgents = result.agents.filter((a) => selectedSlugs.has(a.slug));

      const presetSlug = result.projectName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const presetYaml = generatePresetYaml(result.projectName, selectedAgents);
      saveLocalPreset(presetSlug, presetYaml);
      p.log.success(`Preset saved as ${pc.green(presetSlug)}`);
    }

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
