import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import pc from "picocolors";
import * as p from "@clack/prompts";
import {
  isRef,
  slugFromRef,
  detectRefType,
  fetchAgent,
  fetchPreset,
  fetchAgentIndex,
  fetchPresetIndex,
  agentRef,
  presetRef,
  type RefType,
} from "../lib/remote.js";
import type { AgentInfo, Preset } from "../lib/types.js";
import { writeAgent, writeContextFile, writeSkillsJson, type SkillsJson } from "../lib/writer.js";
import { generateContextFile } from "../lib/generator.js";
import { mergeContextFile, generateAgentsSection } from "../lib/generator.js";
import { type TargetConfig, BUILTIN_TARGETS } from "../lib/target.js";
import { saveConfig, loadConfig, addAgentToConfig } from "../lib/config.js";
import { detectStack } from "../lib/stack-detector.js";
import { trackAdd } from "../lib/telemetry.js";

export interface AddOptions {
  agent?: boolean;
  preset?: boolean;
  target: TargetConfig;
  overwrite?: boolean;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function addCommand(
  ref: string | undefined,
  opts: AddOptions
): Promise<void> {
  try {
    if (!ref) {
      await interactiveAdd(opts);
    } else {
      await directAdd(ref, opts);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(pc.red(`\n  Error: ${error.message}\n`));
    } else {
      console.error(pc.red("\n  An unknown error occurred.\n"));
    }
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Interactive mode
// ---------------------------------------------------------------------------

async function interactiveAdd(opts: AddOptions): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" loomcraft add ")));

  const s = p.spinner();
  s.start("Fetching catalog...");

  const [agents, presets] = await Promise.all([
    fetchAgentIndex(),
    fetchPresetIndex(),
  ]);

  s.stop("Catalog loaded.");

  if (agents.length === 0 && presets.length === 0) {
    p.cancel("Could not fetch catalog. Check your connection.");
    process.exit(1);
  }

  // Choose type
  const typeChoice = await p.select({
    message: "What do you want to add?",
    options: [
      { value: "preset", label: "Preset", hint: `${presets.length} available — agents + skills + pipeline` },
      { value: "agent", label: "Agent", hint: `${agents.length} available — single agent` },
    ],
  });

  if (p.isCancel(typeChoice)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  if (typeChoice === "preset") {
    const choice = await p.select({
      message: "Choose a preset",
      options: presets.map((pr) => ({
        value: pr.slug,
        label: pr.name,
        hint: `${pr.agents} agents, ${pr.skills} skills`,
      })),
    });
    if (p.isCancel(choice)) { p.cancel("Cancelled."); process.exit(0); }
    const ref = presetRef(choice as string);
    await directAdd(ref, { ...opts, preset: true });
  } else {
    const choice = await p.multiselect({
      message: "Select agents",
      options: agents.map((a) => ({
        value: a.slug,
        label: a.name,
        hint: a.description,
      })),
      required: true,
    });
    if (p.isCancel(choice)) { p.cancel("Cancelled."); process.exit(0); }
    for (const slug of choice as string[]) {
      const ref = agentRef(slug);
      await addSingleAgent(ref, opts.target);
    }
    p.outro(pc.green("Done!"));
  }
}

// ---------------------------------------------------------------------------
// Direct mode (ref provided)
// ---------------------------------------------------------------------------

async function directAdd(ref: string, opts: AddOptions): Promise<void> {
  if (!isRef(ref)) {
    throw new Error(`Invalid ref "${ref}". Use format: org/repo/name`);
  }

  // Determine hint from flags
  let hint: RefType | undefined;
  if (opts.agent) hint = "agent";
  if (opts.preset) hint = "preset";

  const detected = await detectRefType(ref, hint);

  if (detected.type === "preset") {
    await addPreset(ref, opts);
  } else {
    await addSingleAgent(ref, opts.target);
  }
}

// ---------------------------------------------------------------------------
// Add preset (agents + skills + workflow + CLAUDE.md)
// ---------------------------------------------------------------------------

async function addPreset(ref: string, opts: AddOptions): Promise<void> {
  console.log(pc.bold(pc.cyan(`\n  Adding preset: ${ref}\n`)));

  const preset = await fetchPreset(ref);
  const stack = detectStack();
  console.log(pc.dim(`  Detected stack: ${stack.summary}`));

  // Fetch all agents in parallel
  const agentResults = await Promise.allSettled(
    preset.agents.map((agentRef) => fetchAgent(agentRef))
  );

  // Write agents
  const agentInfos: AgentInfo[] = [];
  const installedAgentRefs: string[] = [];

  for (let i = 0; i < preset.agents.length; i++) {
    const agentRefStr = preset.agents[i];
    const result = agentResults[i];
    if (result.status === "fulfilled") {
      writeAgent(opts.target, result.value.slug, result.value.rawContent);
      agentInfos.push(result.value.info);
      installedAgentRefs.push(agentRefStr);
      console.log(pc.green(`  ✓ ${result.value.slug}`));
    } else {
      console.log(pc.yellow(`  ⚠ ${slugFromRef(agentRefStr)} — ${result.reason}`));
    }
  }

  // Write skills.json
  if (preset.skills.length > 0) {
    const skillsJson: SkillsJson = {
      name: `loomcraft-${preset.slug}`,
      version: "1.0.0",
      description: preset.description,
      skills: preset.skills,
    };
    writeSkillsJson(skillsJson);
    console.log(pc.green(`  ✓ skills.json (${preset.skills.length} skills)`));
  }

  // Generate/merge CLAUDE.md
  const contextContent = generateContextFile(preset, agentInfos, opts.target, stack.summary);
  const contextFilePath = path.join(process.cwd(), opts.target.contextFile);
  const merge = !opts.overwrite && fs.existsSync(contextFilePath);

  writeContextFile(opts.target, contextContent, process.cwd(), {
    merge,
    agents: agentInfos,
    skills: preset.skills,
    stackSummary: stack.summary,
    preset,
  });
  console.log(pc.green(`  ✓ ${opts.target.contextFile} ${merge ? "merged" : "generated"}`));

  // Save config
  saveConfig(opts.target, process.cwd(), {
    preset: ref,
    agents: installedAgentRefs,
    skills: preset.skills,
  });

  // Install skills via skills.sh
  await installSkills(preset.skills);

  // Telemetry
  trackAdd(ref, "preset");

  console.log(
    pc.bold(pc.green(`\n  Done! ${agentInfos.length} agent(s), ${preset.skills.length} skill(s) installed.\n`))
  );
}

// ---------------------------------------------------------------------------
// Add single agent
// ---------------------------------------------------------------------------

async function addSingleAgent(ref: string, target: TargetConfig): Promise<void> {
  const agent = await fetchAgent(ref);
  const filePath = writeAgent(target, agent.slug, agent.rawContent);
  console.log(pc.green(`\n  ✓ Agent "${agent.slug}" added (${filePath})`));

  // Update CLAUDE.md agents section
  const contextFilePath = path.join(process.cwd(), target.contextFile);
  if (fs.existsSync(contextFilePath)) {
    // Read existing agents from the agents directory to rebuild the full list
    const agentsDir = path.join(process.cwd(), target.dir, target.agentsSubdir);
    const allAgents = readAgentsFromDir(agentsDir);
    const existing = fs.readFileSync(contextFilePath, "utf-8");
    const merged = mergeContextFile(existing, allAgents, target, []);
    fs.writeFileSync(contextFilePath, merged, "utf-8");
    console.log(pc.green(`  ✓ ${target.contextFile} updated`));
  }

  // Update config
  addAgentToConfig(ref);

  // Telemetry
  trackAdd(ref, "agent");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import matter from "gray-matter";

function readAgentsFromDir(agentsDir: string): AgentInfo[] {
  const agents: AgentInfo[] = [];
  if (!fs.existsSync(agentsDir)) return agents;

  const slugs = fs.readdirSync(agentsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const slug of slugs) {
    const agentFile = path.join(agentsDir, slug, "AGENT.md");
    if (!fs.existsSync(agentFile)) continue;
    try {
      const raw = fs.readFileSync(agentFile, "utf-8");
      const { data } = matter(raw);
      const fm = data as Record<string, unknown>;
      agents.push({
        slug,
        name: (fm.name as string) || slug,
        description: (fm.description as string) || "",
      });
    } catch {
      agents.push({ slug, name: slug, description: "" });
    }
  }
  return agents;
}

async function installSkills(skills: string[]): Promise<void> {
  if (skills.length === 0) return;

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

  console.log(pc.dim(`\n  Installing skills via skills.sh (${repoSkills.size} repos)...`));

  for (const [repo, skillNames] of repoSkills) {
    const url = `https://github.com/${repo}`;
    const skillFlag = skillNames.length > 0
      ? `--skill ${skillNames.join(" ")} `
      : "";
    const cmd = `npx -y skills add ${url} ${skillFlag}-y`;
    try {
      execSync(cmd, { stdio: "pipe", timeout: 60_000 });
      console.log(pc.green(`  ✓ ${repo} (${skillNames.length || "all"} skills)`));
    } catch {
      console.log(pc.yellow(`  ⚠ ${repo} — skipped`));
    }
  }
}
