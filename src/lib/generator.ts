import type { Preset, AgentInfo } from "./types.js";
import type { TargetConfig } from "./target.js";

// ---------------------------------------------------------------------------
// Full CLAUDE.md generation (from preset)
// ---------------------------------------------------------------------------

export function generateContextFile(
  preset: Preset,
  agents: AgentInfo[],
  target: TargetConfig,
  stackSummary: string
): string {
  const lines: string[] = [];

  lines.push(`# ${preset.name}`);
  lines.push("");

  // Stack section
  lines.push("<!-- loomcraft:stack:start -->");
  lines.push("## Stack");
  lines.push("");
  lines.push(stackSummary);
  lines.push("");
  lines.push("<!-- loomcraft:stack:end -->");
  lines.push("");

  // Workflow section
  lines.push(generateWorkflowSection(preset));
  lines.push("");

  // Agents section
  lines.push(generateAgentsSection(agents, target));
  lines.push("");

  // Skills section
  if (preset.skills.length > 0) {
    lines.push(generateSkillsSection(preset.skills));
    lines.push("");
  }

  // Custom section
  lines.push("<!-- loomcraft:custom:start -->");
  lines.push("## Custom Rules");
  lines.push("");
  lines.push("<!-- Add your project-specific rules here. This section is never overwritten by loomcraft sync. -->");
  lines.push("");
  lines.push("<!-- loomcraft:custom:end -->");
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Workflow section
// ---------------------------------------------------------------------------

function generateWorkflowSection(preset: Preset): string {
  const lines: string[] = [];

  lines.push("<!-- loomcraft:workflow:start -->");
  lines.push("## Workflow");
  lines.push("");
  lines.push(`Preset: **${preset.name}** — ${preset.description}`);
  lines.push("");

  // Pipeline
  if (preset.pipeline.length > 0) {
    lines.push("### Pipeline");
    lines.push("");
    lines.push("When implementing a feature, delegate to agents in this order:");
    lines.push("");
    for (let i = 0; i < preset.pipeline.length; i++) {
      const step = preset.pipeline[i];
      let line = `${i + 1}. **${step.agent}**`;
      if (step.when) line += ` — ${step.when}`;
      if (step.mode) line += ` (${step.mode})`;
      if (step.scope) line += ` [scope: ${step.scope}]`;
      lines.push(line);
    }
    lines.push("");
  }

  // Verification
  if (preset.verification.length > 0) {
    lines.push("### Verification");
    lines.push("");
    lines.push("After implementation, always run:");
    lines.push("");
    for (let i = 0; i < preset.verification.length; i++) {
      lines.push(`${i + 1}. **${preset.verification[i]}**`);
    }
    lines.push("");
  }

  // Conventions
  if (preset.conventions) {
    lines.push("### Conventions");
    lines.push("");
    if (preset.conventions.commits === "conventional") {
      lines.push("- Commits: conventional commits (`feat`, `fix`, `chore`, etc.)");
    }
    if (preset.conventions.branches) {
      lines.push(`- Branches: \`${preset.conventions.branches}\``);
    }
    lines.push("");
  }

  lines.push("<!-- loomcraft:workflow:end -->");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Agents section
// ---------------------------------------------------------------------------

export function generateAgentsSection(agents: AgentInfo[], target: TargetConfig): string {
  const lines: string[] = [];
  lines.push("<!-- loomcraft:agents:start -->");
  lines.push("## Agents");
  lines.push("");

  if (agents.length > 0) {
    lines.push(`This project uses ${agents.length} agents in \`${target.dir}/${target.agentsSubdir}/\`.`);
    lines.push("");
    lines.push("| Agent | Description |");
    lines.push("|-------|-------------|");
    for (const agent of agents) {
      lines.push(`| \`${agent.slug}\` | ${agent.description} |`);
    }
    lines.push("");
  }
  lines.push("<!-- loomcraft:agents:end -->");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Skills section
// ---------------------------------------------------------------------------

export function generateSkillsSection(skills: string[]): string {
  const lines: string[] = [];
  lines.push("<!-- loomcraft:skills:start -->");
  lines.push("## Skills");
  lines.push("");
  lines.push("Installed via `skills.json` (skills.sh).");
  lines.push("");
  for (const skill of skills) {
    const name = skill.split("/").pop() || skill;
    lines.push(`- \`${name}\``);
  }
  lines.push("");
  lines.push("<!-- loomcraft:skills:end -->");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Merge (preserves user content outside loomcraft-managed sections)
// ---------------------------------------------------------------------------

export function mergeContextFile(
  existingContent: string,
  agents: AgentInfo[],
  target: TargetConfig,
  skills: string[],
  opts: { stackSummary?: string; preset?: Preset } = {}
): string {
  let result = existingContent;

  // Stack section
  if (opts.stackSummary) {
    const stackSection = [
      "<!-- loomcraft:stack:start -->",
      "## Stack",
      "",
      opts.stackSummary,
      "",
      "<!-- loomcraft:stack:end -->",
    ].join("\n");
    const stackRegex = /<!-- loomcraft:stack:start -->[\s\S]*?<!-- loomcraft:stack:end -->/;
    if (stackRegex.test(result)) {
      result = result.replace(stackRegex, stackSection);
    }
  }

  // Workflow section
  if (opts.preset) {
    const workflowSection = generateWorkflowSection(opts.preset);
    const workflowRegex = /<!-- loomcraft:workflow:start -->[\s\S]*?<!-- loomcraft:workflow:end -->/;
    if (workflowRegex.test(result)) {
      result = result.replace(workflowRegex, workflowSection);
    } else {
      const agentsMarker = /<!-- loomcraft:agents:start -->/;
      if (agentsMarker.test(result)) {
        result = result.replace(agentsMarker, workflowSection + "\n\n<!-- loomcraft:agents:start -->");
      } else {
        result = result.trimEnd() + "\n\n" + workflowSection + "\n";
      }
    }
  }

  // Agents section
  const agentsSection = generateAgentsSection(agents, target);
  const agentsRegex = /<!-- loomcraft:agents:start -->[\s\S]*?<!-- loomcraft:agents:end -->/;
  if (agentsRegex.test(result)) {
    result = result.replace(agentsRegex, agentsSection);
  } else {
    result = result.trimEnd() + "\n\n" + agentsSection + "\n";
  }

  // Skills section
  const skillsRegex = /<!-- loomcraft:skills:start -->[\s\S]*?<!-- loomcraft:skills:end -->/;
  if (skills.length > 0) {
    const skillsSection = generateSkillsSection(skills);
    if (skillsRegex.test(result)) {
      result = result.replace(skillsRegex, skillsSection);
    } else {
      result = result.trimEnd() + "\n\n" + skillsSection + "\n";
    }
  } else if (skillsRegex.test(result)) {
    result = result.replace(skillsRegex, "").replace(/\n{3,}/g, "\n\n");
  }

  // Custom section
  const customRegex = /<!-- loomcraft:custom:start -->/;
  if (!customRegex.test(result)) {
    result = result.trimEnd() + "\n\n" + [
      "<!-- loomcraft:custom:start -->",
      "## Custom Rules",
      "",
      "<!-- Add your project-specific rules here. This section is never overwritten by loomcraft sync. -->",
      "",
      "<!-- loomcraft:custom:end -->",
    ].join("\n") + "\n";
  }

  return result;
}
