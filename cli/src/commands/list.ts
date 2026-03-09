import pc from "picocolors";
import { listAgents, listPresets } from "../lib/library.js";
import { readSkillsJson } from "../lib/writer.js";

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "…";
}

function padEnd(str: string, len: number): string {
  return str + " ".repeat(Math.max(0, len - str.length));
}

export async function listCommand(type?: string): Promise<void> {
  try {
    if (!type || type === "agents") {
      const agents = await listAgents();
      console.log(pc.bold(pc.cyan("\n  Agents")));
      console.log(pc.dim("  " + "─".repeat(60)));
      if (agents.length === 0) {
        console.log(pc.dim("  No agents found."));
      }
      for (const a of agents) {
        console.log(
          `  ${padEnd(pc.green(a.slug), 30)} ${padEnd(a.name, 25)} ${pc.dim(truncate(a.description, 40))}`
        );
      }
    }

    if (!type || type === "skills") {
      const skillsJson = readSkillsJson();
      console.log(pc.bold(pc.cyan("\n  Skills (from skills.json)")));
      console.log(pc.dim("  " + "─".repeat(60)));
      if (!skillsJson || skillsJson.skills.length === 0) {
        console.log(pc.dim("  No skills.json found. Run \"loomcraft init\" first."));
      } else {
        for (const ref of skillsJson.skills) {
          const name = ref.split("/").pop() || ref;
          console.log(`  ${padEnd(pc.green(name), 30)} ${pc.dim(ref)}`);
        }
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
        const meta = pc.dim(`(${p.agentCount} agents, ${p.skillCount} skills)`);
        console.log(
          `  ${padEnd(pc.green(p.slug), 30)} ${padEnd(p.name, 25)} ${meta}`
        );
      }
    }

    console.log();
  } catch (error) {
    if (error instanceof Error) {
      console.error(pc.red(`\n  Error: ${error.message}\n`));
    } else {
      console.error(pc.red("\n  An unknown error occurred.\n"));
    }
    process.exit(1);
  }
}
