# @loomcraft/cli

CLI to scaffold Claude Code projects with curated agents, skills, and presets.

Loomcraft provides a ready-to-use library of **10 specialized agents**, **24 skills**, and **10 presets** that integrate directly into your project's `.claude/` directory — giving Claude Code deep expertise on your stack from day one.

## Install

```bash
npm i -g @loomcraft/cli
```

## Usage

### Initialize a project (interactive)

```bash
loomcraft init
```

Launches an interactive wizard: pick a preset, toggle agents, toggle skills, and generate everything.

### Initialize from a preset

```bash
loomcraft init saas-default
loomcraft init saas-full
```

### Customize with flags

```bash
loomcraft init saas-default --remove-agent marketing --add-skill stripe-integration
loomcraft init mvp-lean --add-agent security --add-skill auth-rbac
```

| Flag | Description |
|------|-------------|
| `--add-agent <slugs...>` | Add extra agents to the preset |
| `--remove-agent <slugs...>` | Remove agents from the preset |
| `--add-skill <slugs...>` | Add extra skills |
| `--remove-skill <slugs...>` | Remove skills |

### List available resources

```bash
loomcraft list           # list everything
loomcraft list agents    # agents only
loomcraft list skills    # skills only
loomcraft list presets   # presets only
```

### Add a single agent or skill

```bash
loomcraft add agent frontend
loomcraft add skill tailwind-patterns
```

Files are written to `.claude/agents/` and `.claude/skills/` in your current directory.

If the resource isn't found in the bundled library, Loomcraft will automatically check your local library (`~/.loom/library/`) for marketplace-installed resources.

### Browse the marketplace

```bash
loomcraft marketplace search              # list all public resources
loomcraft marketplace search tailwind     # search by keyword
loomcraft marketplace search --type skill # filter by type
```

Alias: `lc mp search`

### Install from the marketplace

```bash
loomcraft marketplace install ticket-craft
```

This downloads the resource to your local library (`~/.loom/library/`). You can then use it with `loomcraft add` in any project.

## What's included

### Agents

| Agent | Role |
|-------|------|
| `orchestrator` | Analyzes tasks and delegates to the right agent |
| `frontend` | React/Next.js components, pages, layouts |
| `backend` | API routes, server actions, data layer |
| `database` | Schemas, migrations, query optimization |
| `tests` | Unit, integration, and E2E tests |
| `review-qa` | Code review, quality checks |
| `security` | Vulnerability audits, hardening |
| `performance` | Profiling, optimization |
| `ux-ui` | UI components, design systems |
| `marketing` | Copy, landing pages, SEO |

### Skills

| Skill | Description |
|-------|-------------|
| `nextjs-conventions` | Next.js 15+ / React 19 / TypeScript patterns |
| `tailwind-patterns` | Tailwind CSS utilities and responsive design |
| `shadcn-ui` | ShadCN UI components, forms, data tables |
| `api-design` | REST API design, validation, error handling |
| `supabase-patterns` | Supabase auth, RLS, storage, real-time |
| `ui-ux-guidelines` | Accessibility, interaction, typography, color |
| `layered-architecture` | Presentation → Facade → Service → DAL → Persistence |
| `drizzle-patterns` | Drizzle ORM schemas, migrations, queries |
| `server-actions-patterns` | Safe Server Actions with wrappers and validation |
| `form-validation` | Zod dual validation (client + server) |
| `auth-rbac` | CASL authorization with role hierarchy |
| `i18n-patterns` | next-intl internationalization patterns |
| `testing-patterns` | Vitest role-based testing strategy |
| `resend-email` | Resend + React Email transactional emails |
| `react-query-patterns` | TanStack React Query data fetching |
| `table-pagination` | Server-side pagination with URL state |
| `env-validation` | Zod environment variable validation |
| `better-auth-patterns` | Better Auth setup with organizations |
| `stripe-integration` | Stripe checkout, subscriptions, webhooks |
| `hero-copywriting` | High-converting hero section copy |
| `seo-optimization` | Meta tags, JSON-LD, Core Web Vitals |
| `chrome-extension-patterns` | Manifest V3, content scripts, service workers |
| `cli-development` | Node.js CLI with Commander.js |
| `react-native-patterns` | React Native / Expo mobile patterns |

### Presets

| Preset | Agents | Skills | Best for |
|--------|--------|--------|----------|
| `saas-full` | 10 | 21 | Full SaaS with auth, billing, i18n, testing |
| `saas-default` | 10 | 7 | Standard SaaS starter |
| `fullstack-auth` | 9 | 6 | Fullstack app with authentication |
| `e-commerce` | 10 | 9 | Online store with payments |
| `api-backend` | 7 | 3 | Backend API service |
| `expo-mobile` | 8 | 4 | Mobile app with Expo |
| `landing-page` | 6 | 5 | Marketing landing page |
| `chrome-extension` | 6 | 3 | Browser extension |
| `mvp-lean` | 4 | 3 | Minimal viable product |
| `cli-tool` | 4 | 1 | Command-line tool |

## How it works

Running `loomcraft init <preset>` generates:

- `.claude/agents/*.md` — one file per agent with system prompt and skills
- `.claude/skills/*.md` — reusable knowledge files loaded contextually
- `.claude/orchestrator.md` — dynamic orchestrator aware of all active agents
- `CLAUDE.md` — project-level config with stack, conventions, and principles

Claude Code reads these files automatically. The orchestrator delegates tasks to the right specialized agent, and each agent loads only the skills it needs.

## License

MIT
