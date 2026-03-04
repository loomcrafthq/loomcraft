import * as p from "@clack/prompts";
import pc from "picocolors";
import { detectTargets, scanTarget, generatePresetYaml } from "../lib/scanner.js";
import type { ScanResult, ScannedAgent, ScannedSkill } from "../lib/scanner.js";
import { listAgents, listSkills } from "../lib/library.js";
import {
  getLocalAgent,
  getLocalSkillWithFiles,
  saveLocalAgent,
  saveLocalSkill,
  saveLocalPreset,
} from "../lib/local-library.js";

type DedupStatus = "new" | "duplicate-bundled" | "duplicate-local";

interface DedupItem {
  type: "agent" | "skill";
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

    if (result.agents.length === 0 && result.skills.length === 0) {
      if (silent) {
        console.log(JSON.stringify({ ...result, dedup: [] }, null, 2));
        return;
      }
      p.log.warn("No agents or skills found to import.");
      if (result.skipped.length > 0) {
        p.log.info(pc.dim("Skipped:"));
        for (const s of result.skipped) {
          p.log.info(pc.dim(`  ${s.path} — ${s.reason}`));
        }
      }
      process.exit(0);
    }

    // 3. Dedup vs bundled
    const [bundledAgents, bundledSkills] = await Promise.all([
      listAgents(),
      listSkills(),
    ]);
    const bundledAgentSlugs = new Set(bundledAgents.map((a) => a.slug));
    const bundledSkillSlugs = new Set(bundledSkills.map((s) => s.slug));

    // 4. Dedup vs local
    const items: DedupItem[] = [];

    for (const agent of result.agents) {
      let status: DedupStatus = "new";
      if (bundledAgentSlugs.has(agent.slug)) {
        status = "duplicate-bundled";
      } else if (getLocalAgent(agent.slug)) {
        status = "duplicate-local";
      }
      items.push({ type: "agent", slug: agent.slug, name: agent.name, status });
    }

    for (const skill of result.skills) {
      let status: DedupStatus = "new";
      if (bundledSkillSlugs.has(skill.slug)) {
        status = "duplicate-bundled";
      } else if (getLocalSkillWithFiles(skill.slug)) {
        status = "duplicate-local";
      }
      items.push({ type: "skill", slug: skill.slug, name: skill.name, status });
    }

    // 5. --json → output enriched JSON (before any display)
    if (opts.json) {
      const enriched = {
        ...result,
        dedup: items.map((i) => ({
          type: i.type,
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
      `Found ${pc.bold(String(result.agents.length))} agents, ${pc.bold(String(result.skills.length))} skills` +
        (dupCount > 0 ? ` (${pc.yellow(String(dupCount) + " duplicates")})` : "")
    );

    for (const item of items) {
      const typeTag = item.type === "agent" ? pc.cyan("[agent]") : pc.magenta("[skill]");
      p.log.info(`  ${typeTag} ${pc.bold(item.slug)} — ${statusLabel(item.status)}`);
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
      message: "Select items to import into your local library:",
      options: importable.map((item) => ({
        value: item.slug,
        label: `${item.type === "agent" ? "[agent]" : "[skill]"} ${item.slug}`,
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

    // 9. Save selected items
    const agentMap = new Map(result.agents.map((a) => [a.slug, a]));
    const skillMap = new Map(result.skills.map((s) => [s.slug, s]));

    let savedCount = 0;

    for (const item of importable) {
      if (!selectedSlugs.has(item.slug)) continue;

      if (item.type === "agent") {
        const agent = agentMap.get(item.slug)!;
        saveLocalAgent(item.slug, agent.content);
        savedCount++;
      } else {
        const skill = skillMap.get(item.slug)!;
        saveLocalSkill(item.slug, skill.files);
        savedCount++;
      }
    }

    p.log.success(`Saved ${pc.bold(String(savedCount))} items to ~/.loomcraft/library/`);

    // 10. Preset generation
    const generatePreset = await p.confirm({
      message: "Generate a preset from this import?",
      initialValue: true,
    });

    if (!p.isCancel(generatePreset) && generatePreset) {
      const selectedAgents = result.agents.filter((a) => selectedSlugs.has(a.slug));
      const selectedSkills = result.skills.filter((s) => selectedSlugs.has(s.slug));

      const presetSlug = result.projectName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const presetYaml = generatePresetYaml(
        result.projectName,
        selectedAgents,
        selectedSkills
      );
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
