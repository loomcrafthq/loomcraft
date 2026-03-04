---
name: cli-development
description: "CLI tool development patterns for Node.js with Commander.js, terminal UX, error handling, and npm distribution. Use when building command-line tools, adding CLI commands, implementing terminal prompts, or bundling CLI binaries for distribution."
---

# CLI Development Patterns

## Critical Rules

- **Use `stdout` for data, `stderr` for logs** — never mix output channels.
- **Exit with proper codes** — `0` success, `1` runtime error, `2` usage error.
- **Never show raw stack traces** — log them with `--verbose` flag only.
- **Respect `NO_COLOR`** — check `process.env.NO_COLOR` before using colors.
- **Validate config with Zod** — fail fast with clear error on invalid config.
- **Confirm destructive actions** — always prompt before irreversible operations.

## Project Structure

```
src/
  index.ts          # Entry point — program definition and parse()
  commands/         # One file per command/subcommand
    init.ts
    build.ts
    list.ts
  lib/              # Shared utilities
    config.ts       # Config loading and validation
    output.ts       # Formatting and printing helpers
    errors.ts       # Custom error classes
```

## Commander.js Setup

- Define the program with metadata from `package.json`:
  ```ts
  const program = new Command()
    .name('mytool')
    .description('What this tool does')
    .version(version)
  ```
- One file per subcommand — register with `program.addCommand()`.
- Use `.argument()` for required positional args, `.option()` for flags:
  ```ts
  program
    .command('init')
    .description('Initialize a new project')
    .argument('<name>', 'project name')
    .option('-t, --template <template>', 'template to use', 'default')
    .action(async (name, options) => { /* ... */ })
  ```
- Always provide `--help` descriptions for all arguments and options.

## Exit Codes

- `0` — success
- `1` — general error (runtime failure, unhandled exception)
- `2` — usage error (invalid arguments, missing required flags)
- Exit explicitly: `process.exit(code)` after cleanup.
- Catch unhandled errors at the top level:
  ```ts
  program.parseAsync().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
  ```

## Output Conventions

- Use `stdout` for actual output (data, results, formatted tables).
- Use `stderr` for progress, logging, warnings, and errors.
- Support `--json` flag for machine-readable output on data commands.
- Support `--quiet` or `--silent` flag to suppress non-essential output.
- Use colors sparingly — respect `NO_COLOR` environment variable:
  ```ts
  const useColor = !process.env.NO_COLOR && process.stdout.isTTY
  ```

## Terminal UX

- Show a spinner for long operations (use `ora` or `nanospinner`).
- Use progress bars for multi-step or percentage-based operations.
- Confirm destructive actions with a prompt (use `@inquirer/prompts` or `@clack/prompts`):
  ```ts
  const confirmed = await confirm({ message: 'Delete all files?' })
  if (!confirmed) process.exit(0)
  ```
- Use tables for structured data display (use `cli-table3` or `columnify`).
- Truncate long output with `--limit` option or pipe to `less`.

## Input

- Accept input from stdin for piping:
  ```ts
  if (!process.stdin.isTTY) {
    const input = await readStdin()
  }
  ```
- Support both `--flag value` and `--flag=value` syntax (Commander.js handles this).
- Use environment variables as fallback for configuration: `MYTOOL_TOKEN`, `MYTOOL_CONFIG`.

## Error Messages

- Include what went wrong, why, and how to fix it:
  ```
  Error: Config file not found at ./config.yaml
  Run `mytool init` to create a default configuration.
  ```
- Use chalk/picocolors for error formatting:
  - Red for errors
  - Yellow for warnings
  - Dim for secondary info
- Never show raw stack traces to users. Log them with `--verbose` flag.

## Configuration

- Support config file (`.mytoolrc`, `mytool.config.ts`, or field in `package.json`).
- Use `cosmiconfig` or manual lookup for config file discovery.
- Validate config with Zod schema — fail fast with clear error on invalid config.
- Allow CLI flags to override config file values.

## Bundling & Distribution

- Bundle with `tsup` for a single distributable file:
  ```ts
  // tsup.config.ts
  export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    target: 'node20',
    clean: true,
    banner: { js: '#!/usr/bin/env node' },
  })
  ```
- Set `"bin"` in `package.json` pointing to the built file.
- Set `"type": "module"` for ESM.
- Test the built binary locally before publishing: `node dist/index.js`.

## Testing

- Test commands by invoking them programmatically, not by spawning processes:
  ```ts
  import { program } from '../src/index'
  program.parse(['node', 'test', 'init', 'my-project'])
  ```
- Test output by capturing stdout/stderr.
- Test error cases: missing args, invalid flags, missing config.
- Test stdin piping with mock readable streams.
