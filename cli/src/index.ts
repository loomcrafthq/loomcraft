import { createRequire } from "node:module";
import { Command } from "commander";
import { addCommand } from "./commands/add.js";
import { findCommand } from "./commands/find.js";
import { syncCommand } from "./commands/sync.js";
import { cleanCommand } from "./commands/clean.js";
import { resolveTarget, DEFAULT_TARGET, listTargetNames, BUILTIN_TARGETS } from "./lib/target.js";
import { loadTarget } from "./lib/config.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const program = new Command();

program
  .name("loomcraft")
  .description("Preset manager for AI agents and skills — fetch from GitHub, scaffold your project")
  .version(version);

// --- add ---

program
  .command("add")
  .description("Add a preset or agent from a GitHub repo (auto-detected)")
  .argument("[ref]", "Remote ref: org/repo/name (interactive if omitted)")
  .option("--agent", "Force treating ref as an agent")
  .option("--preset", "Force treating ref as a preset")
  .option("--claude", "Use Claude Code target (.claude/ + CLAUDE.md)")
  .option("--cursor", "Use Cursor target (.cursor/ + .cursorrules)")
  .option("--target <name>", `Output target: ${[...listTargetNames(), "custom"].join(", ")}`)
  .option("--target-dir <dir>", "Custom target directory")
  .option("--context-file <file>", "Custom context file name")
  .option("--overwrite", "Overwrite existing context file instead of merging")
  .action(async (ref: string | undefined, opts: Record<string, unknown>) => {
    const target = resolveTargetFromOpts(opts);
    await addCommand(ref, {
      agent: !!opts.agent,
      preset: !!opts.preset,
      target,
      overwrite: !!opts.overwrite,
    });
  });

// --- find ---

program
  .command("find")
  .description("Search community presets and agents")
  .argument("[query]", "Search query")
  .option("--type <type>", "Filter: agent or preset")
  .option("--sort <sort>", "Sort: popular, recent", "popular")
  .action(async (query: string | undefined, opts: { type?: string; sort?: string }) => {
    await findCommand(query, opts);
  });

// --- sync ---

program
  .command("sync")
  .description("Re-install skills and update the context file")
  .option("--target <name>", `Output target: ${[...listTargetNames(), "custom"].join(", ")}`)
  .option("--target-dir <dir>", "Custom target directory")
  .option("--context-file <file>", "Custom context file name")
  .action(async (opts: Record<string, string>) => {
    const target = resolveTargetFromOpts(opts);
    await syncCommand(target);
  });

// --- clean ---

program
  .command("clean")
  .description("Remove all files created by loomcraft")
  .option("--dry-run", "Preview without deleting")
  .option("--target <name>", `Output target: ${[...listTargetNames(), "custom"].join(", ")}`)
  .option("--target-dir <dir>", "Custom target directory")
  .option("--context-file <file>", "Custom context file name")
  .action(async (opts: Record<string, unknown>) => {
    const target = resolveTargetFromOpts(opts);
    await cleanCommand(target, { dryRun: !!opts.dryRun });
  });

// --- Target resolution helper ---

function resolveTargetFromOpts(opts: Record<string, unknown>): ReturnType<typeof resolveTarget> {
  if (opts.claude) return BUILTIN_TARGETS["claude-code"];
  if (opts.cursor) return BUILTIN_TARGETS["cursor"];
  if (opts.target) {
    return resolveTarget(
      opts.target as string,
      opts.targetDir as string | undefined,
      opts.contextFile as string | undefined
    );
  }
  // Try saved config
  const saved = loadTarget();
  if (saved) return saved;
  return BUILTIN_TARGETS[DEFAULT_TARGET];
}

program.parse();
