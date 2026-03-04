# @loomcraft/cli

Multi-agent development pipeline for Claude Code and Cursor. **13 agents**, **33 skills**, **10 presets** — from brainstorm to production.

Loomcraft scaffolds a complete AI development workflow into your project. An orchestrator agent runs a pipeline (brainstorm → plan → dev → review → test), delegating to specialized agents that each carry domain-specific skills.

## Quick start

```bash
# Interactive — pick preset, agents, and skills
npx @loomcraft/cli init

# One-liner with a preset
npx @loomcraft/cli init saas --claude
npx @loomcraft/cli init landing --cursor
```

> **Optional global install:** `npm i -g @loomcraft/cli` then use `loomcraft` directly.

## Commands

### `loomcraft init [preset]`

Scaffold a project with agents, skills, and a context file.

```bash
loomcraft init                           # interactive wizard
loomcraft init saas --claude             # Claude Code target
loomcraft init api --cursor              # Cursor target
loomcraft init saas --remove-agent marketing --add-skill prisma-patterns
```

| Flag | Description |
|------|-------------|
| `--claude` | Target Claude Code (`.claude/` + `CLAUDE.md`) |
| `--cursor` | Target Cursor (`.cursor/` + `.cursorrules`) |
| `--add-agent <slugs...>` | Add extra agents to the preset |
| `--remove-agent <slugs...>` | Remove agents from the preset |
| `--add-skill <slugs...>` | Add extra skills |
| `--remove-skill <slugs...>` | Remove skills |
| `--overwrite` | Overwrite existing context file instead of merging |

**Context file merge:** When the context file (`CLAUDE.md` / `.cursorrules`) already exists, `init` preserves your custom content and only updates the Loomcraft-managed sections (agents and skills). In interactive mode, you'll be prompted to choose merge or overwrite. In non-interactive mode, merge is the default — use `--overwrite` to replace the entire file.

### `loomcraft list [type]`

```bash
loomcraft list           # everything
loomcraft list agents    # agents only
loomcraft list skills    # skills only
loomcraft list presets   # presets only
```

### `loomcraft add <type> <slug>`

Add a single agent or skill to an existing project. Automatically regenerates the orchestrator and updates the context file.

```bash
loomcraft add agent devops
loomcraft add skill ai-patterns
```

### `loomcraft sync`

Regenerate the orchestrator and update the context file's agents/skills sections based on currently installed agents and skills. Useful after manual changes.

```bash
loomcraft sync
```

### `loomcraft marketplace`

Browse and install community-contributed resources.

```bash
loomcraft marketplace search              # list all
loomcraft marketplace search tailwind     # search by keyword
loomcraft marketplace install ticket-craft
```

Alias: `lc mp search`

## What's generated

Running `loomcraft init saas --claude` creates:

```
.claude/
  agents/
    orchestrator/AGENT.md    # pipeline coordinator
    brainstormer/AGENT.md    # requirement exploration
    planner/AGENT.md         # task decomposition
    frontend/AGENT.md        # React/Next.js
    backend/AGENT.md         # API, auth, data
    database/AGENT.md        # schemas, migrations
    ...8 more agents
  skills/
    nextjs-conventions/SKILL.md
    tailwind-patterns/SKILL.md
    api-design/SKILL.md
    ...21 more skills
CLAUDE.md                    # project context (auto-read by Claude Code)
```

Claude Code discovers agents in `.claude/agents/` and skills in `.claude/skills/` automatically. The `CLAUDE.md` file provides project-level context and directs Claude to use the orchestrator for any task.

## Pipeline

The orchestrator runs a 5-phase pipeline for every feature:

```
1. BRAINSTORM → 2. PLAN → 3. DEV → 4. REVIEW → 5. TEST
       ↑                                              |
       └──────── iterate if review/tests fail ────────┘
```

1. **Brainstorm** — The brainstormer agent explores requirements via Socratic questioning
2. **Plan** — The planner decomposes the brief into atomic tasks with dependency waves
3. **Dev** — Specialized agents (frontend, backend, database, etc.) execute tasks in parallel
4. **Review** — The review-qa agent checks correctness, security, and code quality
5. **Test** — The tests agent writes and runs tests; failures loop back for fixes

## Agents (13)

### Workflow agents

| Agent | Role |
|-------|------|
| `orchestrator` | Runs the dev pipeline, delegates to specialists |
| `brainstormer` | Socratic questioning, assumption surfacing, briefs |
| `planner` | Atomic task decomposition, dependency waves |

### Domain agents

| Agent | Role |
|-------|------|
| `frontend` | React/Next.js components, pages, layouts, client-side |
| `backend` | API routes, server actions, auth, data layer |
| `database` | Schemas, migrations, query optimization |
| `ux-ui` | Design system, accessibility, responsive, animation |
| `marketing` | Copywriting, SEO, conversion |
| `security` | OWASP Top 10, audit, hardening |
| `performance` | Core Web Vitals, bundle size, rendering |
| `tests` | Unit, integration, E2E, TDD |

### Support agents

| Agent | Role |
|-------|------|
| `review-qa` | Code review, quality, constructive feedback |
| `devops` | CI/CD, deployment, monitoring, infra |

## Skills (33)

### Workflow skills

| Skill | Description |
|-------|-------------|
| `brainstorming` | Socratic questioning, brief templates |
| `task-planning` | Atomic decomposition, wave-based execution |
| `code-review` | Review checklist, severity classification |
| `tdd-workflow` | RED-GREEN-REFACTOR cycle |
| `project-bootstrap` | Stack detection, context file enrichment |

### Domain skills

| Skill | Description |
|-------|-------------|
| `nextjs-conventions` | Next.js 15+ / React 19 / App Router patterns |
| `tailwind-patterns` | Tailwind CSS utilities and responsive design |
| `shadcn-ui` | ShadCN UI components, forms, data tables |
| `api-design` | REST API design, validation, error handling |
| `supabase-patterns` | Supabase auth, RLS, storage, real-time |
| `drizzle-patterns` | Drizzle ORM schemas, migrations, queries |
| `prisma-patterns` | Prisma ORM schemas, relations, seeding |
| `layered-architecture` | Presentation → Facade → Service → DAL |
| `server-actions-patterns` | Safe Server Actions with wrappers |
| `form-validation` | Zod dual validation (client + server) |
| `auth-rbac` | CASL authorization with role hierarchy |
| `better-auth-patterns` | Better Auth setup with organizations |
| `i18n-patterns` | next-intl internationalization patterns |
| `testing-patterns` | Vitest role-based testing strategy |
| `tdd-workflow` | RED-GREEN-REFACTOR cycle |
| `env-validation` | Zod environment variable validation |
| `react-query-patterns` | TanStack React Query data fetching |
| `table-pagination` | Server-side pagination with URL state |
| `resend-email` | Resend + React Email transactional emails |
| `stripe-integration` | Stripe checkout, subscriptions, webhooks |
| `ui-ux-guidelines` | Accessibility, interaction, typography |
| `hero-copywriting` | High-converting hero section copy |
| `seo-optimization` | Meta tags, JSON-LD, Core Web Vitals |
| `ai-patterns` | LLM integration, RAG, streaming, tool use |
| `realtime-patterns` | WebSockets, SSE, presence, optimistic UI |
| `cms-patterns` | Content modeling, MDX, draft/publish |
| `chrome-extension-patterns` | Manifest V3, content scripts |
| `cli-development` | Node.js CLI with Commander.js |
| `react-native-patterns` | React Native / Expo mobile patterns |

## Presets (10)

| Preset | Agents | Skills | Use case |
|--------|--------|--------|----------|
| `saas` | 13 | 24 | Full-stack SaaS with auth, billing, testing |
| `api` | 10 | 12 | Backend API service |
| `landing` | 8 | 10 | Marketing landing page |
| `mobile` | 10 | 10 | React Native / Expo mobile app |
| `ecommerce` | 13 | 17 | Online store with Stripe |
| `cli` | 7 | 8 | Node.js command-line tool |
| `extension` | 8 | 9 | Chrome browser extension |
| `ai-app` | 9 | 12 | AI-powered app (chatbot, RAG) |
| `realtime` | 10 | 12 | Real-time app (chat, collaboration) |
| `blog` | 9 | 12 | Blog / CMS with MDX |

Every preset includes the workflow agents (orchestrator, brainstormer, planner) and workflow skills (brainstorming, task-planning, code-review, project-bootstrap).

## Multi-runtime support

| Runtime | Target flag | Agents dir | Context file |
|---------|------------|------------|--------------|
| Claude Code | `--claude` | `.claude/agents/` | `CLAUDE.md` |
| Cursor | `--cursor` | `.cursor/agents/` | `.cursorrules` |
| Custom | `--target custom --target-dir .mydir --context-file CONTEXT.md` | `.mydir/agents/` | `CONTEXT.md` |

## License

MIT
