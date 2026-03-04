import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import matter from "gray-matter";
import { listAgents, getAgent } from "../lib/library.js";
import { generateOrchestrator, mergeContextFile, type AgentWithSkills, type AgentInfo } from "../lib/generator.js";
import { writeOrchestrator } from "../lib/writer.js";
import type { TargetConfig } from "../lib/target.js";

/**
 * Scans the current project's agent directory, reads all installed agents,
 * and regenerates the orchestrator with up-to-date delegation rules.
 */
export async function syncCommand(target: TargetConfig): Promise<void> {
  const cwd = process.cwd();
  const agentsDir = path.join(cwd, target.dir, target.agentsSubdir);
  const skillsDir = path.join(cwd, target.dir, target.skillsSubdir);

  if (!fs.existsSync(agentsDir)) {
    console.error(pc.red(`\n  Error: No agents directory found. Expected ${target.dir}/${target.agentsSubdir}/\n`));
    console.log(pc.dim(`  Run "loomcraft init" first.\n`));
    process.exit(1);
  }

  // Discover installed agents from the project directory
  const installedSlugs = fs
    .readdirSync(agentsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  // Discover installed skills from the project directory
  const installedSkills: string[] = [];
  if (fs.existsSync(skillsDir)) {
    const skillDirs = fs
      .readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    installedSkills.push(...skillDirs);
  }

  // Read agent metadata from installed files
  const agentsWithSkills: AgentWithSkills[] = [];
  let orchestratorTemplate: string | null = null;

  for (const slug of installedSlugs) {
    const agentFile = path.join(agentsDir, slug, "AGENT.md");
    if (!fs.existsSync(agentFile)) continue;

    const raw = fs.readFileSync(agentFile, "utf-8");
    const { data } = matter(raw);
    const fm = data as Record<string, unknown>;

    agentsWithSkills.push({
      slug,
      name: (fm.name as string) || slug,
      description: (fm.description as string) || "",
      skills: Array.isArray(fm.skills) ? (fm.skills as string[]) : [],
    });
  }

  // Get orchestrator template from the library (bundled)
  try {
    const orch = await getAgent("orchestrator");
    orchestratorTemplate = orch.rawContent;
  } catch {
    // Fall back to installed orchestrator
    const orchFile = path.join(cwd, target.dir, target.orchestratorFile);
    if (fs.existsSync(orchFile)) {
      orchestratorTemplate = fs.readFileSync(orchFile, "utf-8");
    }
  }

  if (!orchestratorTemplate) {
    console.error(pc.red(`\n  Error: Could not find orchestrator template.\n`));
    process.exit(1);
  }

  // Regenerate orchestrator
  const orchestratorContent = generateOrchestrator(
    orchestratorTemplate,
    agentsWithSkills,
    installedSkills
  );
  writeOrchestrator(target, orchestratorContent);

  console.log(pc.green(`\n  ✓ Orchestrator regenerated with ${agentsWithSkills.length} agents and ${installedSkills.length} skills.`));
  console.log(pc.dim(`    ${target.dir}/${target.orchestratorFile}`));

  // Merge context file if it exists
  const contextFilePath = path.join(cwd, target.contextFile);
  if (fs.existsSync(contextFilePath)) {
    const existingContent = fs.readFileSync(contextFilePath, "utf-8");
    const agentInfos: AgentInfo[] = agentsWithSkills.map((a) => ({
      slug: a.slug,
      name: a.name,
      role: "",
      description: a.description,
    }));
    const merged = mergeContextFile(existingContent, agentInfos, target, installedSkills);
    fs.writeFileSync(contextFilePath, merged, "utf-8");
    console.log(pc.green(`  ✓ ${target.contextFile} merged`));
  }

  console.log("");
}
