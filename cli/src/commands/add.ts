import { execSync } from "node:child_process";
import pc from "picocolors";
import { getAgent } from "../lib/library.js";
import { getLocalAgent } from "../lib/local-library.js";
import { writeAgent, addSkillToJson } from "../lib/writer.js";
import type { TargetConfig } from "../lib/target.js";
import { syncCommand } from "./sync.js";
import { validateSlug } from "../lib/security.js";

export async function addCommand(
  type: string,
  slug: string,
  target: TargetConfig
): Promise<void> {
  if (type !== "agent" && type !== "skill") {
    console.error(pc.red(`\n  Error: Invalid type "${type}". Use "agent" or "skill".\n`));
    process.exit(1);
  }

  if (type === "agent") {
    try {
      validateSlug(slug);
    } catch (err) {
      console.error(pc.red(`\n  Error: ${(err as Error).message}\n`));
      process.exit(1);
    }
    await addAgent(slug, target);
  } else {
    await addSkill(slug);
  }
}

// --- Add agent (from bundled or local library) ---

async function addAgent(slug: string, target: TargetConfig): Promise<void> {
  let written = false;

  try {
    const agent = await getAgent(slug);
    const filePath = writeAgent(target, slug, agent.rawContent);
    console.log(pc.green(`\n  ✓ Agent "${slug}" written to ${filePath}`));
    written = true;
  } catch {
    // Bundled not found — try ~/.loomcraft/library/
    const local = getLocalAgent(slug);
    if (local) {
      const filePath = writeAgent(target, slug, local.rawContent);
      console.log(pc.green(`\n  ✓ Agent "${slug}" written to ${filePath} ${pc.dim("(from ~/.loomcraft/library)")}`));
      written = true;
    }
  }

  if (!written) {
    console.error(pc.red(`\n  Error: agent "${slug}" not found.\n`));
    console.log(pc.dim(`  Try: loomcraft marketplace search ${slug}\n`));
    process.exit(1);
  }

  // Regenerate context after adding an agent
  try {
    await syncCommand(target);
  } catch {
    console.log(pc.dim(`  (sync skipped — run "loomcraft sync" manually)\n`));
  }
}

// --- Add skill (add ref to skills.json + install via skills.sh) ---

async function addSkill(skillRef: string): Promise<void> {
  // Add to skills.json
  const skillsJson = addSkillToJson(skillRef);
  console.log(pc.green(`\n  ✓ Added "${skillRef}" to skills.json (${skillsJson.skills.length} skills total)`));

  // Install via skills.sh
  try {
    console.log(pc.dim("  Installing via skills.sh..."));
    execSync("npx -y skills add .", {
      stdio: "inherit",
      timeout: 120_000,
    });
    console.log(pc.green("  ✓ Skills installed\n"));
  } catch {
    console.log(pc.yellow("  ⚠ Could not install automatically."));
    console.log(pc.dim("    Run manually: npx skills add .\n"));
  }
}
