# @loomcraft/cli

AI workflow preset manager — **7 universal agents**, **skills.sh integration**, **10 presets**.

Loomcraft scaffolds production-ready presets into your project. Each preset bundles 7 stack-agnostic agents, skills from the [skills.sh](https://skills.sh) ecosystem, and a workflow pipeline with TDD hybrid patterns.

## Quick start

```bash
# Interactive — pick a preset
npx @loomcraft/cli init

# One-liner with a preset
npx @loomcraft/cli init saas
npx @loomcraft/cli init api
```

## Commands

### `loomcraft init [preset]`

Scaffold a preset with agents, skills.json, and a context file.

```bash
loomcraft init                    # interactive wizard
loomcraft init saas               # scaffold the SaaS preset
loomcraft init landing            # scaffold the landing preset
```

| Flag | Description |
|------|-------------|
| `--add-agent <slugs...>` | Add extra agents to the preset |
| `--remove-agent <slugs...>` | Remove agents from the preset |
| `--overwrite` | Overwrite existing context file instead of merging |

**Context file merge:** When `CLAUDE.md` already exists, `init` preserves your custom content and only updates the Loomcraft-managed sections. Use `--overwrite` to replace the entire file.

### `loomcraft list [type]`

```bash
loomcraft list           # everything
loomcraft list agents    # agents only
loomcraft list presets   # presets only
```

### `loomcraft import`

Import an existing project setup into Loomcraft format.

```bash
loomcraft import
```

### `loomcraft marketplace`

Browse and install community-contributed presets.

```bash
loomcraft marketplace search              # list all
loomcraft marketplace search tailwind     # search by keyword
loomcraft marketplace install ticket-craft
```

Alias: `lc mp search`

## What's generated

Running `loomcraft init saas` creates:

```
.claude/
  agents/
    database.md          # schema design, migrations, queries
    backend.md           # APIs, auth, business logic
    frontend.md          # components, state, accessibility
    ux-ui.md             # design system, usability, responsive
    tester.md            # unit, integration, e2e, TDD
    review-qa.md         # code review, quality assurance
    security.md          # OWASP Top 10, audit, hardening
CLAUDE.md                # project context (auto-read by Claude Code)
skills.json              # skills.sh references
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
