# @loomcraft/cli

AI workflow preset manager — **7 universal agents**, **skills.sh integration**, **10 presets**.

Loomcraft scaffolds production-ready presets into your project. Each preset bundles 7 stack-agnostic agents, skills from the [skills.sh](https://skills.sh) ecosystem, and a workflow pipeline with TDD hybrid patterns.

## Quick start

```bash
# Interactive — pick a preset or agents
npx @loomcraft/cli add

# One-liner with a preset
npx @loomcraft/cli add loomcrafthq/presets/saas
npx @loomcraft/cli add loomcrafthq/presets/api
```

## Commands

### `loomcraft add [ref]`

Add a preset or agent from a GitHub repo.

```bash
loomcraft add                              # interactive wizard
loomcraft add loomcrafthq/presets/saas     # add the SaaS preset
loomcraft add loomcrafthq/agents/backend   # add a single agent
```

| Flag | Description |
|------|-------------|
| `--agent` | Force treating ref as an agent |
| `--preset` | Force treating ref as a preset |
| `--claude` | Use Claude Code target (.claude/ + CLAUDE.md) |
| `--cursor` | Use Cursor target (.cursor/ + .cursorrules) |
| `--target <name>` | Output target (claude-code, cursor, custom) |
| `--target-dir <dir>` | Custom target directory |
| `--context-file <file>` | Custom context file name |
| `--overwrite` | Overwrite existing context file instead of merging |

**Context file merge:** When `CLAUDE.md` already exists, `add` preserves your custom content and only updates the Loomcraft-managed sections. Use `--overwrite` to replace the entire file.

### `loomcraft find [query]`

Search community presets and agents.

```bash
loomcraft find                # list all
loomcraft find tailwind       # search by keyword
loomcraft find --type agent   # agents only
```

| Flag | Description |
|------|-------------|
| `--type <type>` | Filter: agent or preset |
| `--sort <sort>` | Sort: popular, recent (default: popular) |

### `loomcraft sync`

Re-install skills and update the context file.

```bash
loomcraft sync
```

| Flag | Description |
|------|-------------|
| `--target <name>` | Output target |
| `--target-dir <dir>` | Custom target directory |
| `--context-file <file>` | Custom context file name |

### `loomcraft clean`

Remove all files created by Loomcraft.

```bash
loomcraft clean
loomcraft clean --dry-run    # preview without deleting
```

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview without deleting |
| `--target <name>` | Output target |
| `--target-dir <dir>` | Custom target directory |
| `--context-file <file>` | Custom context file name |

## What's generated

Running `loomcraft add loomcrafthq/presets/saas` creates:

```
.claude/
  agents/
    database/AGENT.md    # schema design, migrations, queries
    backend/AGENT.md     # APIs, auth, business logic
    frontend/AGENT.md    # components, state, accessibility
    ux-ui/AGENT.md       # design system, usability, responsive
    tester/AGENT.md      # unit, integration, e2e, TDD
    review-qa/AGENT.md   # code review, quality assurance
    security/AGENT.md    # OWASP Top 10, audit, hardening
  skills/
    brainstorming/SKILL.md
    ticket-craft/SKILL.md
    ...16 more            # installed from skills.sh
CLAUDE.md                 # project context (auto-read by Claude Code)
skills.json               # skills.sh references
```

Claude Code discovers agents in `.claude/agents/` automatically. The `skills.json` file references external skills from the [skills.sh](https://skills.sh) ecosystem.

## Agents (7)

All agents are **stack-agnostic**. They read your project's `CLAUDE.md` to adapt to whatever framework, language, or tooling you use.

| Agent | Role |
|-------|------|
| `database` | Schema design, migrations, query optimization, data integrity |
| `backend` | API design, business logic, auth, clean architecture |
| `frontend` | UI components, state management, accessibility (WCAG 2.1 AA), performance |
| `ux-ui` | Design system, usability heuristics, responsive design, animation |
| `tester` | Unit/integration/e2e tests, TDD, Arrange-Act-Assert |
| `review-qa` | Code review, quality audit, security and performance checks |
| `security` | OWASP Top 10, vulnerability audit, secure coding patterns |

## Skills (skills.sh)

Skills are external packages from the [skills.sh](https://skills.sh) ecosystem. Each preset references the skills it needs in `skills.json`.

### Core skills (included in all presets)

| Skill | Source |
|-------|--------|
| Brainstorming | `obra/superpowers/brainstorming` |
| Writing Plans | `obra/superpowers/writing-plans` |
| Executing Plans | `obra/superpowers/executing-plans` |
| Systematic Debugging | `obra/superpowers/systematic-debugging` |
| Code Review | `obra/superpowers/requesting-code-review` |
| Receiving Review | `obra/superpowers/receiving-code-review` |
| Conventional Commits | `github/awesome-copilot/conventional-commit` |
| Ticket Craft | `loomcrafthq/skills/ticket-craft` |
| Testing Patterns | `loomcrafthq/skills/testing-patterns` |

### Ecosystem skills (per preset)

| Skill | Source |
|-------|--------|
| TDD | `obra/superpowers/test-driven-development` |
| Frontend Design | `anthropics/skills/frontend-design` |
| Web App Testing | `anthropics/skills/webapp-testing` |
| Web Design | `vercel-labs/web-design-guidelines` |
| React Best Practices | `vercel-labs/react-best-practices` |
| Next.js Best Practices | `vercel-labs/next-best-practices` |
| React Native | `vercel-labs/react-native-skills` |
| Better Auth | `better-auth/skills` |
| Supabase | `supabase/agent-skills` |

## Workflow Pipeline

Each preset defines a workflow with 4 phases:

```
1. PREPARATION → 2. PIPELINE → 3. VERIFICATION → 4. FINALIZATION
```

### Example: TDD Hybrid Pipeline

```yaml
workflow:
  preparation:
    source: linear          # ticket source (linear, github-issues, manual)
  pipeline:
    - agent: database
    - agent: tester
      mode: tdd             # write tests first (red)
    - agent: backend
    - agent: ux-ui
    - agent: frontend
    - agent: tester
      mode: test-after      # write tests after implementation
  verification:
    - review-qa
    - security
  finalization:
    commits: conventional
    branch: feat/{{ticket}}
```

## Presets (10)

| Preset | Use case |
|--------|----------|
| `saas` | Full-stack SaaS with auth, billing, TDD pipeline |
| `api` | Backend API service |
| `landing` | Marketing landing page |
| `mobile` | React Native / Expo mobile app |
| `ecommerce` | Online store with Stripe |
| `cli` | Node.js command-line tool |
| `extension` | Chrome browser extension |
| `ai-app` | AI-powered app (chatbot, RAG) |
| `realtime` | Real-time app (chat, collaboration) |
| `blog` | Blog / CMS with MDX |

Every preset includes the 7 universal agents and core skills.sh references.

## License

MIT
