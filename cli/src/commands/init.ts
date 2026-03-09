import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import pc from "picocolors";
import * as p from "@clack/prompts";
import matter from "gray-matter";
import {
  listPresets,
  listAgents,
  getPreset,
  getAgent,
  type Preset,
  type AgentSummary,
} from "../lib/library.js";
import { writeAgent, writeContextFile, writeSkillsJson, type SkillsJson } from "../lib/writer.js";
import { generateContextFile, type AgentInfo } from "../lib/generator.js";
import { type TargetConfig, BUILTIN_TARGETS, resolveTarget } from "../lib/target.js";
import { saveConfig } from "../lib/config.js";
import { validateTargetDir } from "../lib/security.js";
import { detectStack } from "../lib/stack-detector.js";

export interface InitOptions {
  addAgent?: string[];
  removeAgent?: string[];
  target: TargetConfig;
  targetExplicit?: boolean;
  overwrite?: boolean;
}

// --- Entry Point ---

export async function initCommand(presetSlug?: string, opts: InitOptions = {} as InitOptions): Promise<void> {
  try {
    if (!presetSlug) {
      await interactiveInit(opts.target, opts.targetExplicit);
    } else {
      await nonInteractiveInit(presetSlug, opts);
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

// --- Interactive Mode ---

async function interactiveInit(target: TargetConfig, targetExplicit?: boolean): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" loomcraft init ")));

  // Skip target selection when explicitly set via --claude, --cursor, or --target
  if (!targetExplicit) {
    const builtinEntries = Object.values(BUILTIN_TARGETS);
    const targetChoice = await p.select({
      message: "Choose a target runtime",
      options: [
        ...builtinEntries.map((t) => ({
          value: t.name,
          label: t.description,
        })),
        { value: "custom", label: "Custom — choose directory and context file" },
      ],
      initialValue: target.name,
    });

    if (p.isCancel(targetChoice)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    if (targetChoice === "custom") {
      const customDir = await p.text({
        message: "Target directory",
        placeholder: ".myruntime",
        validate: (v) => {
          if (!v || v.length === 0) return "Required";
          try { validateTargetDir(v); } catch (e) { return (e as Error).message; }
          return undefined;
        },
      });
      if (p.isCancel(customDir)) { p.cancel("Operation cancelled."); process.exit(0); }

      const customFile = await p.text({
        message: "Context file name",
        placeholder: "CONTEXT.md",
        validate: (v) => (!v || v.length === 0 ? "Required" : undefined),
      });
      if (p.isCancel(customFile)) { p.cancel("Operation cancelled."); process.exit(0); }

      target = resolveTarget("custom", customDir as string, customFile as string);
    } else {
      target = BUILTIN_TARGETS[targetChoice as string];
    }
  } else {
    p.log.info(`Target: ${target.description}`);
  }

  // Auto-detect stack
  const stack = detectStack();
  p.log.info(`Detected stack: ${pc.cyan(stack.summary)}`);

  // List presets and suggest
  const presets = await listPresets();
  if (presets.length === 0) {
    p.cancel("No presets available.");
    process.exit(1);
  }

  const presetSlug = await p.select({
    message: "Choose a preset",
    options: presets.map((pr) => ({
      value: pr.slug,
      label: pr.name,
      hint: `${pr.agentCount} agents, ${pr.skillCount} skills`,
    })),
    initialValue: stack.suggestedPreset,
  });

  if (p.isCancel(presetSlug)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const preset = await getPreset(presetSlug as string);
  const allAgents = await listAgents();

  // Agent selection
  const selectedAgents = await p.multiselect({
    message: "Select agents",
    options: allAgents.map((a) => ({
      value: a.slug,
      label: a.name,
      hint: a.description,
    })),
    initialValues: allAgents
      .filter((a) => preset.agents.includes(a.slug))
      .map((a) => a.slug),
    required: true,
  });

  if (p.isCancel(selectedAgents)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const agentSlugs = selectedAgents as string[];

  // Confirmation
  const confirmed = await p.confirm({
    message: `Scaffold with ${agentSlugs.length} agents and ${preset.skills.length} skills?`,
  });

  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  // Check if context file exists — ask merge or overwrite
  let merge = false;
  const contextFilePath = path.join(process.cwd(), target.contextFile);
  if (fs.existsSync(contextFilePath)) {
    const mergeChoice = await p.select({
      message: `${target.contextFile} already exists. How should we handle it?`,
      options: [
        { value: "merge", label: "Merge — update loomcraft sections, preserve your custom content" },
        { value: "overwrite", label: "Overwrite — replace the entire file" },
      ],
      initialValue: "merge",
    });

    if (p.isCancel(mergeChoice)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    merge = mergeChoice === "merge";
  }

  const s = p.spinner();
  s.start("Generating project files...");

  await generateAndWrite(preset, agentSlugs, target, merge, stack.summary);

  saveConfig(target, process.cwd(), preset.slug);
  s.stop("Project files generated.");

  // Install skills via skills.sh
  await installSkills();

  p.outro(pc.green(`Done! ${agentSlugs.length} agent(s), ${preset.skills.length} skill(s), ${target.contextFile} ready.`));
}

// --- Non-Interactive Mode ---

async function nonInteractiveInit(presetSlug: string, opts: InitOptions): Promise<void> {
  const target = opts.target;
  const preset = await getPreset(presetSlug);

  // Auto-detect stack
  const stack = detectStack();
  console.log(pc.dim(`  Detected stack: ${stack.summary}`));

  // Compute agents: preset ± flags
  let agentSlugs = [...preset.agents];

  if (opts.addAgent) {
    for (const slug of opts.addAgent) {
      if (!agentSlugs.includes(slug)) agentSlugs.push(slug);
    }
  }

  if (opts.removeAgent) {
    agentSlugs = agentSlugs.filter((s) => !opts.removeAgent!.includes(s));
  }

  // Non-interactive: merge by default unless --overwrite
  const contextFilePath = path.join(process.cwd(), target.contextFile);
  const merge = !opts.overwrite && fs.existsSync(contextFilePath);

  console.log(pc.bold(pc.cyan(`\n  Initializing preset "${preset.name}"...\n`)));

  await generateAndWrite(preset, agentSlugs, target, merge, stack.summary);
  saveConfig(target, process.cwd(), preset.slug);

  // Install skills via skills.sh
  await installSkills();

  console.log(
    pc.bold(
      pc.cyan(
        `\n  Done! ${agentSlugs.length} agent(s), ${preset.skills.length} skill(s), ${target.contextFile} ready.\n`
      )
    )
  );
}

// --- Shared Generation Logic ---

async function generateAndWrite(
  preset: Preset,
  agentSlugs: string[],
  target: TargetConfig,
  merge: boolean,
  stackSummary: string
): Promise<void> {
  // Fetch all agents in parallel
  const agentResults = await Promise.allSettled(
    agentSlugs.map((slug) => getAgent(slug))
  );

  // Write agents
  const agentInfos: AgentInfo[] = [];

  for (let i = 0; i < agentSlugs.length; i++) {
    const slug = agentSlugs[i];
    const result = agentResults[i];
    if (result.status === "fulfilled") {
      writeAgent(target, slug, result.value.rawContent);
      console.log(pc.green(`  ✓ Agent: ${slug}`));

      const { data } = matter(result.value.rawContent);
      const fm = data as Record<string, unknown>;
      agentInfos.push({
        slug,
        name: (fm.name as string) || slug,
        description: (fm.description as string) || "",
      });
    } else {
      console.log(pc.yellow(`  ⚠ Agent "${slug}" skipped: ${result.reason}`));
    }
  }

  // Write skills.json
  const skillsJson: SkillsJson = {
    name: `loomcraft-${preset.slug}`,
    version: "1.0.0",
    description: preset.description,
    skills: preset.skills,
  };
  writeSkillsJson(skillsJson);
  console.log(pc.green(`  ✓ skills.json (${preset.skills.length} skills)`));

  // Generate context file
  const contextContent = generateContextFile(preset, agentInfos, target, stackSummary);
  writeContextFile(target, contextContent, process.cwd(), {
    merge,
    agents: agentInfos,
    skills: preset.skills,
    stackSummary,
  });
  console.log(pc.green(`  ✓ ${target.contextFile} ${merge ? "merged" : "generated"}`));
}

// --- Install skills via skills.sh ---

async function installSkills(): Promise<void> {
  try {
    console.log(pc.dim("\n  Installing skills via skills.sh..."));
    execSync("npx -y skills add .", {
      stdio: "inherit",
      timeout: 120_000,
    });
    console.log(pc.green("  ✓ Skills installed"));
  } catch {
    console.log(pc.yellow("  ⚠ Could not install skills automatically."));
    console.log(pc.dim("    Run manually: npx skills add ."));
  }
}
