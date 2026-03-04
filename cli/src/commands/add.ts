import pc from "picocolors";
import { getAgent, getSkillWithFiles } from "../lib/library.js";
import { getLocalAgent, getLocalSkillWithFiles } from "../lib/local-library.js";
import { writeAgent, writeSkillDir } from "../lib/writer.js";
import type { TargetConfig } from "../lib/target.js";
import { syncCommand } from "./sync.js";

export async function addCommand(
  type: string,
  slug: string,
  target: TargetConfig
): Promise<void> {
  if (type !== "agent" && type !== "skill") {
    console.error(pc.red(`\n  Error: Invalid type "${type}". Use "agent" or "skill".\n`));
    process.exit(1);
  }

  let written = false;

  try {
    // Try bundled first
    if (type === "agent") {
      const agent = await getAgent(slug);
      const filePath = writeAgent(target, slug, agent.rawContent);
      console.log(pc.green(`\n  ✓ Agent "${slug}" written to ${filePath}`));
      written = true;
    } else {
      const skill = await getSkillWithFiles(slug);
      const dirPath = writeSkillDir(target, slug, skill.files);
      const fileCount = skill.files.length;
      console.log(pc.green(`\n  ✓ Skill "${slug}" written to ${dirPath} (${fileCount} file${fileCount !== 1 ? "s" : ""})`));
      written = true;
    }
  } catch {
    // Bundled not found — try ~/.loomcraft/library/
    if (type === "agent") {
      const local = getLocalAgent(slug);
      if (local) {
        const filePath = writeAgent(target, slug, local.rawContent);
        console.log(pc.green(`\n  ✓ Agent "${slug}" written to ${filePath} ${pc.dim("(from ~/.loomcraft/library)")}`));
        written = true;
      }
    } else {
      const local = getLocalSkillWithFiles(slug);
      if (local) {
        const dirPath = writeSkillDir(target, slug, local.files);
        const fileCount = local.files.length;
        console.log(pc.green(`\n  ✓ Skill "${slug}" written to ${dirPath} (${fileCount} file${fileCount !== 1 ? "s" : ""}) ${pc.dim("(from ~/.loomcraft/library)")}`));
        written = true;
      }
    }

    if (!written) {
      console.error(pc.red(`\n  Error: ${type} "${slug}" not found.\n`));
      console.log(pc.dim(`  Try: loomcraft marketplace search ${slug}\n`));
      process.exit(1);
    }
  }

  // Regenerate orchestrator after adding an agent or skill
  if (written) {
    try {
      await syncCommand(target);
    } catch {
      console.log(pc.dim(`  (orchestrator sync skipped — run "loomcraft sync" manually)\n`));
    }
  }
}
