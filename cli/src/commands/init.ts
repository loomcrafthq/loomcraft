import pc from "picocolors";
import * as p from "@clack/prompts";
import matter from "gray-matter";
import {
  listPresets,
  listAgents,
  listSkills,
  getPreset,
  getAgent,
  getSkillWithFiles,
  type Preset,
  type AgentSummary,
} from "../lib/library.js";
import { writeAgent, writeSkillDir, writeContextFile, writeOrchestrator } from "../lib/writer.js";
import { generateContextFile, generateOrchestrator, type AgentWithSkills } from "../lib/generator.js";
import { type TargetConfig, BUILTIN_TARGETS, resolveTarget } from "../lib/target.js";
import { saveConfig } from "../lib/config.js";

export interface InitOptions {
  addAgent?: string[];
  removeAgent?: string[];
  addSkill?: string[];
  removeSkill?: string[];
  target: TargetConfig;
  targetExplicit?: boolean;
}

// --- Entry Point ---

export async function initCommand(presetSlug?: string, opts: InitOptions = {} as InitOptions): Promise<void> {
  try {
    const hasFlags = !!(opts.addAgent || opts.removeAgent || opts.addSkill || opts.removeSkill);

    if (!presetSlug && hasFlags) {
      console.error(pc.red("\n  Error: flags require a preset argument. Usage: loom init <preset> [flags]\n"));
      process.exit(1);
    }

    if (!presetSlug && !hasFlags) {
      await interactiveInit(opts.target, opts.targetExplicit);
    } else {
      await nonInteractiveInit(presetSlug!, opts);
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
  p.intro(pc.bgCyan(pc.black(" loom init ")));

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
        validate: (v) => (!v || v.length === 0 ? "Required" : undefined),
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
  });

  if (p.isCancel(presetSlug)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const preset = await getPreset(presetSlug as string);
  const allAgents = await listAgents();
  const allSkillSlugs = (await listSkills()).map((s) => s.slug);

  // Agent selection — orchestrator always included, not shown
  const nonOrchestratorAgents = allAgents.filter((a) => a.slug !== "orchestrator");
  const presetAgentSet = new Set(preset.agents);

  const selectedAgents = await p.multiselect({
    message: "Select agents",
    options: nonOrchestratorAgents.map((a) => ({
      value: a.slug,
      label: a.name,
      hint: a.description,
    })),
    initialValues: nonOrchestratorAgents
      .filter((a) => presetAgentSet.has(a.slug))
      .map((a) => a.slug),
    required: true,
  });

  if (p.isCancel(selectedAgents)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const agentSlugs = ["orchestrator", ...(selectedAgents as string[])];

  // Skill selection
  const skillOptions = computeAvailableSkills(preset, selectedAgents as string[], allAgents, allSkillSlugs);

  const selectedSkills = await p.multiselect({
    message: "Select skills",
    options: skillOptions.map((s) => ({
      value: s.slug,
      label: s.slug,
      hint: s.preSelected ? "recommended" : undefined,
    })),
    initialValues: skillOptions.filter((s) => s.preSelected).map((s) => s.slug),
    required: false,
  });

  if (p.isCancel(selectedSkills)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const skillSlugs = selectedSkills as string[];

  // Confirmation
  const confirmed = await p.confirm({
    message: `Scaffold with ${agentSlugs.length} agents and ${skillSlugs.length} skills?`,
  });

  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const s = p.spinner();
  s.start("Generating project files...");

  await generateAndWrite(preset, agentSlugs, skillSlugs, target);

  saveConfig(target);
  s.stop("Project files generated.");

  p.outro(pc.green(`Done! ${agentSlugs.length} agent(s), ${skillSlugs.length} skill(s), ${target.contextFile} ready.`));
}

// --- Non-Interactive Mode ---

async function nonInteractiveInit(presetSlug: string, opts: InitOptions): Promise<void> {
  const target = opts.target;
  const preset = await getPreset(presetSlug);
  const allAgents = await listAgents();

  // Compute agents: preset ± flags (orchestrator always included)
  let agentSlugs = [...preset.agents];

  if (opts.addAgent) {
    for (const slug of opts.addAgent) {
      if (!agentSlugs.includes(slug)) agentSlugs.push(slug);
    }
  }

  if (opts.removeAgent) {
    agentSlugs = agentSlugs.filter(
      (s) => s === "orchestrator" || !opts.removeAgent!.includes(s)
    );
  }

  // Compute skills: remove orphans from removed agents, then apply flags
  const selectedNonOrch = agentSlugs.filter((s) => s !== "orchestrator");
  const linkedToSelected = new Set<string>();
  const linkedToRemoved = new Set<string>();

  for (const agent of allAgents) {
    if (selectedNonOrch.includes(agent.slug)) {
      for (const sk of agent.skills) linkedToSelected.add(sk);
    }
    if (opts.removeAgent?.includes(agent.slug)) {
      for (const sk of agent.skills) linkedToRemoved.add(sk);
    }
  }

  // Orphan skills: linked to a removed agent but NOT linked to any remaining agent
  const orphanSkills = new Set<string>();
  for (const sk of linkedToRemoved) {
    if (!linkedToSelected.has(sk)) orphanSkills.add(sk);
  }

  let skillSlugs = preset.skills.filter((s) => !orphanSkills.has(s));

  if (opts.addSkill) {
    for (const slug of opts.addSkill) {
      if (!skillSlugs.includes(slug)) skillSlugs.push(slug);
    }
  }

  if (opts.removeSkill) {
    skillSlugs = skillSlugs.filter((s) => !opts.removeSkill!.includes(s));
  }

  console.log(pc.bold(pc.cyan(`\n  Initializing preset "${preset.name}"...\n`)));

  await generateAndWrite(preset, agentSlugs, skillSlugs, target);
  saveConfig(target);

  console.log(
    pc.bold(
      pc.cyan(
        `\n  Done! ${agentSlugs.length} agent(s), ${skillSlugs.length} skill(s), ${target.contextFile} ready.\n`
      )
    )
  );
}

// --- Shared Generation Logic ---

async function generateAndWrite(preset: Preset, agentSlugs: string[], skillSlugs: string[], target: TargetConfig): Promise<void> {
  // Fetch all agents and skills in parallel
  const agentResults = await Promise.allSettled(
    agentSlugs.map((slug) => getAgent(slug))
  );
  const skillResults = await Promise.allSettled(
    skillSlugs.map((slug) => getSkillWithFiles(slug))
  );

  // Write agents (skip orchestrator — it will be generated separately)
  const agentInfos: { slug: string; name: string; role: string; description: string }[] = [];
  const agentsWithSkills: AgentWithSkills[] = [];
  let orchestratorTemplate: string | null = null;

  for (let i = 0; i < agentSlugs.length; i++) {
    const slug = agentSlugs[i];
    const result = agentResults[i];
    if (result.status === "fulfilled") {
      const { data } = matter(result.value.rawContent);
      const fm = data as Record<string, unknown>;

      if (slug === "orchestrator") {
        orchestratorTemplate = result.value.rawContent;
      } else {
        writeAgent(target, slug, result.value.rawContent);
        console.log(pc.green(`  ✓ Agent: ${slug}`));
      }

      agentInfos.push({
        slug,
        name: (fm.name as string) || slug,
        role: (fm.role as string) || "",
        description: (fm.description as string) || "",
      });

      agentsWithSkills.push({
        slug,
        name: (fm.name as string) || slug,
        description: (fm.description as string) || "",
        skills: Array.isArray(fm.skills) ? (fm.skills as string[]) : [],
      });
    } else {
      console.log(pc.yellow(`  ⚠ Agent "${slug}" skipped: ${result.reason}`));
    }
  }

  // Generate and write orchestrator
  if (orchestratorTemplate) {
    const orchestratorContent = generateOrchestrator(
      orchestratorTemplate,
      agentsWithSkills,
      skillSlugs
    );
    writeOrchestrator(target, orchestratorContent);
    console.log(pc.green(`  ✓ ${target.orchestratorFile} generated`));
  }

  // Write skills
  for (let i = 0; i < skillSlugs.length; i++) {
    const slug = skillSlugs[i];
    const result = skillResults[i];
    if (result.status === "fulfilled") {
      writeSkillDir(target, slug, result.value.files);
      const fileCount = result.value.files.length;
      console.log(pc.green(`  ✓ Skill: ${slug} (${fileCount} file${fileCount !== 1 ? "s" : ""})`));
    } else {
      console.log(pc.yellow(`  ⚠ Skill "${slug}" skipped: ${result.reason}`));
    }
  }

  // Generate context file
  const contextContent = generateContextFile(preset, agentInfos, target, skillSlugs);
  writeContextFile(target, contextContent);
  console.log(pc.green(`  ✓ ${target.contextFile} generated`));
}

// --- Skill Filtering Algorithm ---

interface SkillOption {
  slug: string;
  preSelected: boolean;
}

function computeAvailableSkills(
  preset: Preset,
  selectedAgentSlugs: string[],
  allAgents: AgentSummary[],
  allSkillSlugs: string[]
): SkillOption[] {
  // 1. Skills linked to selected agents
  const linkedToSelected = new Set<string>();
  for (const agent of allAgents) {
    if (selectedAgentSlugs.includes(agent.slug)) {
      for (const sk of agent.skills) linkedToSelected.add(sk);
    }
  }

  // 2. Skills linked to ANY agent
  const linkedToAny = new Set<string>();
  for (const agent of allAgents) {
    for (const sk of agent.skills) linkedToAny.add(sk);
  }

  const presetSkillSet = new Set(preset.skills);

  // 3. For each skill in the library
  return allSkillSlugs.map((slug) => {
    const preSelected =
      linkedToSelected.has(slug) ||
      (presetSkillSet.has(slug) && !linkedToAny.has(slug));

    return { slug, preSelected };
  });
}
