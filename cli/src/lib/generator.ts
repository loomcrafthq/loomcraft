import matter from "gray-matter";
import type { Preset } from "./library.js";
import type { TargetConfig } from "./target.js";

export interface AgentInfo {
  slug: string;
  name: string;
  role: string;
  description: string;
}

export interface AgentWithSkills {
  slug: string;
  name: string;
  description: string;
  skills: string[];
}

export function generateContextFile(
  preset: Preset,
  agents: AgentInfo[],
  target: TargetConfig,
  skillSlugs: string[] = []
): string {
  const lines: string[] = [];

  lines.push(`# ${preset.name}`);
  lines.push("");
  lines.push(preset.context.projectDescription.trim());
  lines.push("");

  // Principles
  if (preset.constitution.principles.length > 0) {
    lines.push("## Principles");
    lines.push("");
    for (const p of preset.constitution.principles) {
      lines.push(`- ${p}`);
    }
    lines.push("");
  }

  // Conventions
  if (preset.constitution.conventions.length > 0) {
    lines.push("## Conventions");
    lines.push("");
    for (const c of preset.constitution.conventions) {
      lines.push(`- ${c}`);
    }
    lines.push("");
  }

  // Custom sections
  if (preset.constitution.customSections) {
    for (const [title, content] of Object.entries(preset.constitution.customSections)) {
      lines.push(`## ${title}`);
      lines.push("");
      lines.push(content);
      lines.push("");
    }
  }

  // Commands
  lines.push("## Commands");
  lines.push("");
  lines.push("```bash");
  lines.push("npm run dev          # Start development server");
  lines.push("npm run build        # Build for production");
  lines.push("npm run lint         # Run linter");
  lines.push("npm test             # Run tests");
  lines.push("```");
  lines.push("");

  // Agents — loomcraft-managed section
  lines.push(generateAgentsSection(agents, target));
  lines.push("");

  // Skills — loomcraft-managed section
  if (skillSlugs.length > 0) {
    lines.push(generateSkillsSection(skillSlugs));
    lines.push("");
  }

  // Orchestrator usage
  lines.push("## How to use");
  lines.push("");
  lines.push(`For any task, invoke the **orchestrator** agent. It runs a pipeline (brainstorm → plan → dev → review → test) and delegates to the appropriate specialized agents. Each agent has access to its assigned skills for domain-specific guidance.`);
  lines.push("");
  lines.push(`All agents are in \`${target.dir}/${target.agentsSubdir}/\` and skills in \`${target.dir}/${target.skillsSubdir}/\`.`);
  lines.push("");

  return lines.join("\n");
}

export function generateAgentsSection(agents: AgentInfo[], target: TargetConfig): string {
  const lines: string[] = [];
  lines.push("<!-- loomcraft:agents:start -->");
  lines.push("## Agents");
  lines.push("");

  const nonOrchestrator = agents.filter((a) => a.slug !== "orchestrator");
  if (nonOrchestrator.length > 0) {
    lines.push(`This project uses ${nonOrchestrator.length + 1} agents (including the orchestrator) in \`${target.dir}/${target.agentsSubdir}/\`. The orchestrator (\`${target.dir}/${target.orchestratorFile}\`) coordinates the development pipeline.`);
    lines.push("");
    lines.push("| Agent | Role | Description |");
    lines.push("|-------|------|-------------|");
    for (const agent of nonOrchestrator) {
      lines.push(`| \`${agent.slug}\` | ${agent.name} | ${agent.description} |`);
    }
    lines.push("");
  }
  lines.push("<!-- loomcraft:agents:end -->");
  return lines.join("\n");
}

export function generateSkillsSection(skillSlugs: string[]): string {
  const lines: string[] = [];
  lines.push("<!-- loomcraft:skills:start -->");
  lines.push("## Skills");
  lines.push("");
  lines.push("Installed skills providing domain-specific conventions and patterns:");
  lines.push("");
  for (const slug of skillSlugs) {
    lines.push(`- \`${slug}\``);
  }
  lines.push("");
  lines.push("<!-- loomcraft:skills:end -->");
  return lines.join("\n");
}

export function mergeContextFile(
  existingContent: string,
  agents: AgentInfo[],
  target: TargetConfig,
  skillSlugs: string[]
): string {
  let result = existingContent;

  // Replace or append agents section
  const agentsSection = generateAgentsSection(agents, target);
  const agentsRegex = /<!-- loomcraft:agents:start -->[\s\S]*?<!-- loomcraft:agents:end -->/;

  if (agentsRegex.test(result)) {
    result = result.replace(agentsRegex, agentsSection);
  } else {
    result = result.trimEnd() + "\n\n" + agentsSection + "\n";
  }

  // Replace or append skills section
  const skillsRegex = /<!-- loomcraft:skills:start -->[\s\S]*?<!-- loomcraft:skills:end -->/;

  if (skillSlugs.length > 0) {
    const skillsSection = generateSkillsSection(skillSlugs);
    if (skillsRegex.test(result)) {
      result = result.replace(skillsRegex, skillsSection);
    } else {
      result = result.trimEnd() + "\n\n" + skillsSection + "\n";
    }
  } else {
    // No skills — remove existing skills section if present
    if (skillsRegex.test(result)) {
      result = result.replace(skillsRegex, "").replace(/\n{3,}/g, "\n\n");
    }
  }

  return result;
}

export function generateOrchestrator(
  templateContent: string,
  agents: AgentWithSkills[],
  presetSkills: string[]
): string {
  const { data: frontmatter, content } = matter(templateContent);

  // Build delegation rules
  const rules: string[] = [];
  const delegatesTo: string[] = [];

  for (const agent of agents) {
    if (agent.slug === "orchestrator") continue;

    delegatesTo.push(agent.slug);

    // Filter agent skills to only those present in the preset
    const relevantSkills = agent.skills.filter((s) => presetSkills.includes(s));

    let line = `- **${agent.slug}**: ${agent.description}`;
    if (relevantSkills.length > 0) {
      line += `. Skills: ${relevantSkills.join(", ")}`;
    }
    rules.push(line);
  }

  // Rebuild frontmatter (keep original fields only — delegates-to is not a recognized field)
  const newFrontmatter = { ...frontmatter };

  // Replace placeholder in content
  const newContent = content.replace("{{DELEGATION_RULES}}", rules.join("\n"));

  // Reassemble with gray-matter
  return matter.stringify(newContent, newFrontmatter);
}
