import { execSync } from "node:child_process";
import pc from "picocolors";
import { getAgent } from "../lib/library.js";
import { writeAgent, addSkillToJson } from "../lib/writer.js";
import type { TargetConfig } from "../lib/target.js";
import { syncCommand } from "./sync.js";

export async function addCommand(
  type: string,
  slugOrRef: string,
  target: TargetConfig
): Promise<void> {
  if (type !== "agent" && type !== "skill") {
    console.error(pc.red(`\n  Error: Invalid type "${type}". Use "agent" or "skill".\n`));
    process.exit(1);
  }

  if (type === "agent") {
    await addAgent(slugOrRef, target);
  } else {
    await addSkill(slugOrRef);
  }
}

// --- Add agent (bundled or remote ref: org/repo/name) ---

async function addAgent(slugOrRef: string, target: TargetConfig): Promise<void> {
  try {
    const agent = await getAgent(slugOrRef);
    const filePath = writeAgent(target, agent.slug, agent.rawContent);
    console.log(pc.green(`\n  ✓ Agent "${agent.slug}" written to ${filePath}`));
  } catch (err) {
    console.error(pc.red(`\n  Error: ${(err as Error).message}\n`));
    console.log(pc.dim(`  Bundled agents: loomcraft list agents`));
    console.log(pc.dim(`  Remote: loomcraft add agent org/repo/agent-name\n`));
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
  const parts = skillRef.split("/");
  if (parts.length >= 2) {
    const repo = `${parts[0]}/${parts[1]}`;
    const url = `https://github.com/${repo}`;
    const skillName = parts.length >= 3 ? parts.slice(2).join("/") : "";
    const skillFlag = skillName ? `--skill ${skillName} ` : "";
    try {
      console.log(pc.dim(`  Installing via skills.sh...`));
      execSync(`npx -y skills add ${url} ${skillFlag}-y`, {
        stdio: "pipe",
        timeout: 60_000,
      });
      console.log(pc.green(`  ✓ ${repo}${skillName ? `/${skillName}` : ""} installed\n`));
    } catch {
      console.log(pc.yellow(`  ⚠ Could not install automatically.`));
      console.log(pc.dim(`    Run manually: npx skills add ${url} ${skillFlag}\n`));
    }
  }
}
