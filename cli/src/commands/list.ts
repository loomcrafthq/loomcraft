import pc from "picocolors";
import { listAgents, listSkills, listPresets } from "../lib/library.js";
import { listLocalResources } from "../lib/local-library.js";

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "…";
}

function padEnd(str: string, len: number): string {
  return str + " ".repeat(Math.max(0, len - str.length));
}

export async function listCommand(type?: string): Promise<void> {
  try {
    const bundledSlugs = new Set<string>();

    if (!type || type === "agents") {
      const agents = await listAgents();
      console.log(pc.bold(pc.cyan("\n  Agents")));
      console.log(pc.dim("  " + "─".repeat(60)));
      if (agents.length === 0) {
        console.log(pc.dim("  No agents found."));
      }
      for (const a of agents) {
        bundledSlugs.add(`agent:${a.slug}`);
        console.log(
          `  ${padEnd(pc.green(a.slug), 30)} ${padEnd(a.name, 25)} ${pc.dim(truncate(a.description, 40))}`
        );
      }
    }

    if (!type || type === "skills") {
      const skills = await listSkills();
      console.log(pc.bold(pc.cyan("\n  Skills")));
      console.log(pc.dim("  " + "─".repeat(60)));
      if (skills.length === 0) {
        console.log(pc.dim("  No skills found."));
      }
      for (const s of skills) {
        bundledSlugs.add(`skill:${s.slug}`);
        console.log(
          `  ${padEnd(pc.green(s.slug), 30)} ${padEnd(s.name, 25)} ${pc.dim(truncate(s.description, 40))}`
        );
      }
    }

    if (!type || type === "presets") {
      const presets = await listPresets();
      console.log(pc.bold(pc.cyan("\n  Presets")));
      console.log(pc.dim("  " + "─".repeat(60)));
      if (presets.length === 0) {
        console.log(pc.dim("  No presets found."));
      }
      for (const p of presets) {
        bundledSlugs.add(`preset:${p.slug}`);
        const meta = pc.dim(`(${p.agentCount} agents, ${p.skillCount} skills)`);
        console.log(
          `  ${padEnd(pc.green(p.slug), 30)} ${padEnd(p.name, 25)} ${meta}`
        );
      }
    }

    // Local library section (~/.loom/library/)
    const localItems = listLocalResources().filter(
      (item) => !bundledSlugs.has(`${item.type}:${item.slug}`)
    );

    if (localItems.length > 0) {
      console.log(pc.bold(pc.magenta("\n  Installed (marketplace)")));
      console.log(pc.dim("  " + "─".repeat(60)));
      for (const item of localItems) {
        console.log(
          `  ${padEnd(pc.green(item.slug), 30)} ${pc.dim(`[${item.type}]`)}`
        );
      }
    }

    console.log();
  } catch (error) {
    handleError(error);
  }
}

function handleError(error: unknown): void {
  if (error instanceof Error) {
    console.error(pc.red(`\n  Error: ${error.message}\n`));
  } else {
    console.error(pc.red("\n  An unknown error occurred.\n"));
  }
  process.exit(1);
}
