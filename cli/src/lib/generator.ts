import matter from "gray-matter";
import type { Preset } from "./library.js";
import type { TargetConfig } from "./target.js";

interface AgentInfo {
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

  // Agents — loom-managed section
  lines.push("<!-- loom:agents:start -->");
  lines.push("## Agents");
  lines.push("");

  const nonOrchestrator = agents.filter((a) => a.slug !== "orchestrator");
  if (nonOrchestrator.length > 0) {
    lines.push(`This project uses ${nonOrchestrator.length} specialized agents coordinated by an orchestrator (\`${target.dir}/${target.orchestratorFile}\`).`);
    lines.push("");
    lines.push("| Agent | Role | Description |");
    lines.push("|-------|------|-------------|");
    for (const agent of nonOrchestrator) {
      lines.push(`| \`${agent.slug}\` | ${agent.name} | ${agent.description} |`);
    }
    lines.push("");
  }
  lines.push("<!-- loom:agents:end -->");
  lines.push("");

  // Skills — loom-managed section
  if (skillSlugs.length > 0) {
    lines.push("<!-- loom:skills:start -->");
    lines.push("## Skills");
    lines.push("");
    lines.push("Installed skills providing domain-specific conventions and patterns:");
    lines.push("");
    for (const slug of skillSlugs) {
      lines.push(`- \`${slug}\``);
    }
    lines.push("");
    lines.push("<!-- loom:skills:end -->");
    lines.push("");
  }

  // Orchestrator usage
  lines.push("## How to use");
  lines.push("");
  lines.push(`The orchestrator agent (\`${target.dir}/${target.orchestratorFile}\`) is the main entry point. It analyzes tasks, breaks them into subtasks, and delegates to the appropriate specialized agents. Each agent has access to its assigned skills for domain-specific guidance.`);
  lines.push("");

  return lines.join("\n");
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

  // Rebuild frontmatter with delegates-to
  const newFrontmatter = { ...frontmatter, "delegates-to": delegatesTo };

  // Replace placeholder in content
  const newContent = content.replace("{{DELEGATION_RULES}}", rules.join("\n"));

  // Reassemble with gray-matter
  return matter.stringify(newContent, newFrontmatter);
}
