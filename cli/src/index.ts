import { createRequire } from "node:module";
import { Command } from "commander";
import { listCommand } from "./commands/list.js";
import { addCommand } from "./commands/add.js";
import { initCommand } from "./commands/init.js";
import { syncCommand } from "./commands/sync.js";
import {
  marketplaceSearchCommand,
  marketplaceInstallCommand,
  marketplaceUpdateCommand,
} from "./commands/marketplace.js";
import { importCommand } from "./commands/import.js";
import { resolveTarget, DEFAULT_TARGET, listTargetNames, BUILTIN_TARGETS } from "./lib/target.js";
import { loadConfig } from "./lib/config.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const program = new Command();

program
  .name("loomcraft")
  .description("Integrate Loomcraft library (agents, skills, presets) into your project")
  .version(version);

program
  .command("list")
  .description("List available agents, skills, and presets")
  .argument("[type]", "Filter by type: agents, skills, or presets")
  .action(async (type?: string) => {
    await listCommand(type);
  });

program
  .command("add")
  .description("Download an agent or skill from the library")
  .argument("<type>", "Type: agent or skill")
  .argument("<slug>", "Slug of the agent or skill")
  .option("--target <name>", `Output target: ${[...listTargetNames(), "custom"].join(", ")}`, DEFAULT_TARGET)
  .option("--target-dir <dir>", "Custom target directory")
  .option("--context-file <file>", "Custom context file name")
  .action(async (type: string, slug: string, opts: Record<string, string>) => {
    const savedConfig = loadConfig();
    const target = opts.target !== DEFAULT_TARGET || opts.targetDir || opts.contextFile
      ? resolveTarget(opts.target, opts.targetDir, opts.contextFile)
      : savedConfig ?? BUILTIN_TARGETS[DEFAULT_TARGET];
    await addCommand(type, slug, target);
  });

program
  .command("init")
  .description("Initialize a project with a preset (agents + skills + context file)")
  .argument("[preset]", "Preset slug (interactive if omitted)")
  .option("--add-agent <slugs...>", "Add extra agents")
  .option("--remove-agent <slugs...>", "Remove agents from preset")
  .option("--add-skill <slugs...>", "Add extra skills")
  .option("--remove-skill <slugs...>", "Remove skills from preset")
  .option("--claude", "Use Claude Code target (.claude/ + CLAUDE.md)")
  .option("--cursor", "Use Cursor target (.cursor/ + .cursorrules)")
  .option("--target <name>", `Output target: ${[...listTargetNames(), "custom"].join(", ")}`)
  .option("--target-dir <dir>", "Custom target directory")
  .option("--context-file <file>", "Custom context file name")
  .option("--overwrite", "Overwrite existing context file instead of merging")
  .action(async (preset: string | undefined, opts: Record<string, unknown>) => {
    // Resolve target: shortcut flags > --target > default
    let target: ReturnType<typeof resolveTarget>;
    let targetExplicit = false;

    if (opts.claude) {
      target = BUILTIN_TARGETS["claude-code"];
      targetExplicit = true;
    } else if (opts.cursor) {
      target = BUILTIN_TARGETS["cursor"];
      targetExplicit = true;
    } else if (opts.target) {
      target = resolveTarget(
        opts.target as string,
        opts.targetDir as string | undefined,
        opts.contextFile as string | undefined
      );
      targetExplicit = true;
    } else {
      target = BUILTIN_TARGETS[DEFAULT_TARGET];
    }

    await initCommand(preset, {
      addAgent: opts.addAgent as string[] | undefined,
      removeAgent: opts.removeAgent as string[] | undefined,
      addSkill: opts.addSkill as string[] | undefined,
      removeSkill: opts.removeSkill as string[] | undefined,
      target,
      targetExplicit,
      overwrite: !!opts.overwrite,
    });
  });

program
  .command("sync")
  .description("Regenerate the orchestrator based on currently installed agents and skills")
  .option("--target <name>", `Output target: ${[...listTargetNames(), "custom"].join(", ")}`, DEFAULT_TARGET)
  .option("--target-dir <dir>", "Custom target directory")
  .option("--context-file <file>", "Custom context file name")
  .action(async (opts: Record<string, string>) => {
    const savedConfig = loadConfig();
    const target = opts.target !== DEFAULT_TARGET || opts.targetDir || opts.contextFile
      ? resolveTarget(opts.target, opts.targetDir, opts.contextFile)
      : savedConfig ?? BUILTIN_TARGETS[DEFAULT_TARGET];
    await syncCommand(target);
  });

program
  .command("import")
  .description("Import agents and skills from an existing project (.claude/ or .cursor/)")
  .argument("[path]", "Project directory (defaults to cwd)")
  .option("--dry-run", "Preview without writing")
  .option("--json", "Output scan result as JSON")
  .action(async (targetPath: string | undefined, opts: { dryRun?: boolean; json?: boolean }) => {
    await importCommand(targetPath, opts);
  });

const mp = program
  .command("marketplace")
  .alias("mp")
  .description("Browse and install community resources");

mp.command("search")
  .description("Search the marketplace")
  .argument("[query]", "Search query")
  .option("--type <type>", "Filter by type: agent, skill, preset")
  .option("--sort <sort>", "Sort: popular, recent", "popular")
  .action(
    async (query: string | undefined, opts: { type?: string; sort?: string }) => {
      await marketplaceSearchCommand(query, opts);
    }
  );

mp.command("install")
  .description("Install a resource from the marketplace")
  .argument("<slug>", "Resource slug to install")
  .action(async (slug: string) => {
    await marketplaceInstallCommand(slug);
  });

mp.command("update")
  .description("Check and apply updates for marketplace-installed resources")
  .argument("[slug]", "Resource slug to update (all if omitted)")
  .action(async (slug?: string) => {
    await marketplaceUpdateCommand(slug);
  });

program.parse();
