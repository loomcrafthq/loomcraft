import type { Preset } from "./library.js";
import type { TargetConfig } from "./target.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentInfo {
  slug: string;
  name: string;
  description: string;
}

// ---------------------------------------------------------------------------
// CLAUDE.md / Context file generation
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

  // Stack section (auto-detected)
  lines.push("<!-- loomcraft:stack:start -->");
  lines.push("## Stack");
  lines.push("");
  lines.push(stackSummary);
  lines.push("");
  lines.push("<!-- loomcraft:stack:end -->");
  lines.push("");

  // Workflow section (from preset)
  lines.push(generateWorkflowSection(preset));
  lines.push("");

  // Agents section
  lines.push(generateAgentsSection(agents, target));
  lines.push("");

  // Skills section (references to skills.json)
  if (preset.skills.length > 0) {
    lines.push(generateSkillsSection(preset.skills));
    lines.push("");
  }

  // Custom section (user-managed, never overwritten)
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
  const w = preset.workflow;

  lines.push("<!-- loomcraft:workflow:start -->");
  lines.push("## Implementation Workflow");
  lines.push("");

  // Preparation
  lines.push("### Preparation");
  if (w.preparation.source === "linear") {
    lines.push("1. Fetch the next logical ticket from the backlog (unblocked, highest priority)");
    lines.push("2. Ask for confirmation before starting");
    lines.push('3. Move ticket to "In Progress"');
  } else if (w.preparation.source === "github-issues") {
    lines.push("1. Fetch the next open issue (highest priority label)");
    lines.push("2. Ask for confirmation before starting");
    lines.push("3. Assign yourself to the issue");
  } else {
    lines.push("1. Ask the user what to implement next");
    lines.push("2. Confirm scope before starting");
  }
  lines.push("");

  // Pipeline
  lines.push("### Pipeline");
  lines.push("");
  for (let i = 0; i < w.pipeline.length; i++) {
    const step = w.pipeline[i];
    let line = `${i + 1}. **${step.agent}**`;
    if (step.condition) line += ` — ${step.condition}`;
    if (step.mode) line += ` (${step.mode})`;
    if (step.scope) line += ` [scope: ${step.scope}]`;
    lines.push(line);
  }
  lines.push("");

  // Verification
  if (w.verification.length > 0) {
    lines.push("### Verification (always run)");
    lines.push("");
    for (let i = 0; i < w.verification.length; i++) {
      lines.push(`${i + 1}. **${w.verification[i]}**`);
    }
    lines.push("");
  }

  // Finalization
  lines.push("### Finalization");
  if (w.finalization.commits === "conventional") {
    lines.push("- Commit using conventional commits (feat, fix, chore, etc.)");
  }
  lines.push(`- Push on branch: \`${w.finalization.branch}\``);
  if (w.preparation.source === "linear") {
    lines.push('- Comment a summary on the Linear ticket, move to "Done"');
  } else if (w.preparation.source === "github-issues") {
    lines.push("- Comment a summary on the GitHub issue, close it");
  }
  lines.push("- Propose the next ticket");
  lines.push("");
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
    lines.push(`This project uses ${agents.length} agents in \`${target.dir}/${target.agentsSubdir}/\`. Claude Code auto-delegates based on each agent's description.`);
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
  lines.push("Installed via `skills.json` (skills.sh). Auto-detected by trigger phrases.");
  lines.push("");
  for (const skill of skills) {
    // Show just the skill name from the full ref
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
  stackSummary?: string
): string {
  let result = existingContent;

  // Replace stack section if provided
  if (stackSummary) {
    const stackSection = [
      "<!-- loomcraft:stack:start -->",
      "## Stack",
      "",
      stackSummary,
      "",
      "<!-- loomcraft:stack:end -->",
    ].join("\n");
    const stackRegex = /<!-- loomcraft:stack:start -->[\s\S]*?<!-- loomcraft:stack:end -->/;
    if (stackRegex.test(result)) {
      result = result.replace(stackRegex, stackSection);
    }
  }

  // Replace agents section
  const agentsSection = generateAgentsSection(agents, target);
  const agentsRegex = /<!-- loomcraft:agents:start -->[\s\S]*?<!-- loomcraft:agents:end -->/;
  if (agentsRegex.test(result)) {
    result = result.replace(agentsRegex, agentsSection);
  } else {
    result = result.trimEnd() + "\n\n" + agentsSection + "\n";
  }

  // Replace skills section
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

  // Replace workflow section if present (don't add if not already there)
  const workflowRegex = /<!-- loomcraft:workflow:start -->[\s\S]*?<!-- loomcraft:workflow:end -->/;
  // Workflow is only replaced on full init, not on sync — so we leave it alone here

  // Ensure custom section exists
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
