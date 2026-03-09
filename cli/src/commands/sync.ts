import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import pc from "picocolors";
import matter from "gray-matter";
import { mergeContextFile, type AgentInfo } from "../lib/generator.js";
import { readSkillsJson } from "../lib/writer.js";
import type { TargetConfig } from "../lib/target.js";

/**
 * Scans the current project's agent directory and skills.json,
 * then regenerates the context file with up-to-date sections.
 */
export async function syncCommand(target: TargetConfig): Promise<void> {
  const cwd = process.cwd();
  const agentsDir = path.join(cwd, target.dir, target.agentsSubdir);

  if (!fs.existsSync(agentsDir)) {
    console.error(pc.red(`\n  Error: No agents directory found. Expected ${target.dir}/${target.agentsSubdir}/\n`));
    console.log(pc.dim(`  Run "loomcraft init" first.\n`));
    process.exit(1);
  }

  // Discover installed agents
  const installedSlugs = fs
    .readdirSync(agentsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  // Read agent metadata
  const agentInfos: AgentInfo[] = [];

  for (const slug of installedSlugs) {
    const agentFile = path.join(agentsDir, slug, "AGENT.md");
    if (!fs.existsSync(agentFile)) continue;

    try {
      const raw = fs.readFileSync(agentFile, "utf-8");
      const { data } = matter(raw);
      const fm = data as Record<string, unknown>;
      agentInfos.push({
        slug,
        name: (fm.name as string) || slug,
        description: (fm.description as string) || "",
      });
    } catch {
      agentInfos.push({ slug, name: slug, description: "" });
    }
  }

  // Read skills from skills.json
  const skillsJson = readSkillsJson(cwd);
  const skills = skillsJson?.skills ?? [];

  // Re-install skills via skills.sh
  if (skills.length > 0) {
    const repoSkills = new Map<string, string[]>();
    for (const ref of skills) {
      const parts = ref.split("/");
      if (parts.length >= 3) {
        const repo = `${parts[0]}/${parts[1]}`;
        const skill = parts.slice(2).join("/");
        const list = repoSkills.get(repo) ?? [];
        list.push(skill);
        repoSkills.set(repo, list);
      } else if (parts.length === 2) {
        repoSkills.set(`${parts[0]}/${parts[1]}`, []);
      }
    }
    console.log(pc.dim(`  Re-installing skills via skills.sh (${repoSkills.size} repos)...`));
    for (const [repo, skillNames] of repoSkills) {
      const url = `https://github.com/${repo}`;
      const skillFlag = skillNames.length > 0 ? `--skill ${skillNames.join(" ")} ` : "";
      try {
        execSync(`npx -y skills add ${url} ${skillFlag}-y`, {
          stdio: "pipe",
          timeout: 60_000,
          cwd,
        });
        console.log(pc.green(`  ✓ ${repo}`));
      } catch {
        console.log(pc.yellow(`  ⚠ ${repo} — skipped`));
      }
    }
  }

  // Merge context file if it exists
  const contextFilePath = path.join(cwd, target.contextFile);
  if (fs.existsSync(contextFilePath)) {
    const existingContent = fs.readFileSync(contextFilePath, "utf-8");
    const merged = mergeContextFile(existingContent, agentInfos, target, skills);
    fs.writeFileSync(contextFilePath, merged, "utf-8");
    console.log(pc.green(`\n  ✓ ${target.contextFile} merged (${agentInfos.length} agents, ${skills.length} skills)`));
  } else {
    console.log(pc.yellow(`\n  ⚠ ${target.contextFile} not found. Run "loomcraft init" to generate it.`));
  }

  console.log("");
}
