---
name: nextjs-conventions
description: "Next.js 15+ / React 19 / TypeScript conventions for App Router, RSC, route groups, and file naming. Use when creating pages, components, layouts, or structuring a Next.js application."
---

# Next.js Conventions

## Critical Rules

- **RSC by default** — only add `"use client"` when strictly needed.
- **Functional over OOP** — pure functions, composition, immutability. Never class components.
- **kebab-case for all new files** — `user-profile.tsx`, `format-date.ts`.
- **Top-down design** — extract sub-functions/sub-components when >100 lines.
- **Never use `any`** — use `unknown` if the type is truly unknown.

## App Router

- Use the App Router (`src/app/`) exclusively. Never use the Pages Router.
- Every route segment should have a `page.tsx`. Use `layout.tsx` for shared UI.
- Use `loading.tsx` for Suspense boundaries and `error.tsx` for error boundaries.
- Use `not-found.tsx` for 404 pages at the appropriate route level.

## Route Groups

Organize routes by access level using route groups:

```
src/app/
  (public)/        # No auth required — landing, login, register
    login/
    register/
  (auth)/          # Auth required, any role — onboarding
    onboarding/
  (app)/           # Auth required, active user — main app
    dashboard/
    settings/
  admin/           # Admin only — user management, app settings
    users/
    settings/
```

- `(public)` routes are accessible without authentication.
- `(auth)` routes require a session but no specific role.
- `(app)` routes require an active, verified user.
- `admin` routes require admin role — not a route group so the URL reflects `/admin/`.

## Server vs Client Components

- **RSC by default**. Only add `"use client"` when strictly needed:
  - Event handlers (`onClick`, `onChange`, etc.)
  - React hooks (`useState`, `useEffect`, `useRef`, etc.)
  - Browser-only APIs (`window`, `localStorage`, etc.)
- Never import server-only modules in client components.
- Pass server data to client components via props, not by importing server functions.
- Wrap async data in `<Suspense>` boundaries for streaming and progressive rendering.

## Data Fetching

- Fetch data in Server Components using `async/await` directly.
- Use Server Actions (`"use server"`) for mutations. Define them in `src/actions/`.
- Always revalidate with `revalidatePath()` or `revalidateTag()` after mutations.
- Use `Suspense` boundaries for streaming and progressive rendering.

## File Naming

- **All new files: `kebab-case`** (e.g., `user-profile.tsx`, `format-date.ts`).
- Types: define in `src/types/` with `.ts` extension.
- Server Actions: `src/actions/{entity}.actions.ts`.
- Schemas: `src/schemas/{entity}.schema.ts`.

## TypeScript

- Enable `strict: true` in `tsconfig.json`.
- Prefer `interface` over `type` for object shapes.
- Never use `any`. Use `unknown` if the type is truly unknown.
- Use `satisfies` operator for type-safe object literals.

## Styling

- Use Tailwind CSS utility classes as the primary styling method.
- Use `cn()` from `@/lib/utils` to merge conditional classes.
- Avoid inline styles. Avoid CSS modules unless absolutely necessary.
- Follow mobile-first responsive design: base styles for mobile, `md:` and `lg:` for larger screens.

## Imports

- Use the `@/` path alias for all imports from `src/`.
- Group imports: React/Next.js first, then external libs, then internal modules.
- Prefer named exports over default exports (except for page/layout components).

## Performance

- Use `next/image` for all images with proper `width`, `height`, and `alt`.
- Use `next/link` for internal navigation. Never use `<a>` for internal links.
- Use `next/font` for font loading.
- Lazy load heavy client components with `dynamic()` from `next/dynamic`.

## Code Design

- **Functional over OOP** — pure functions, composition, immutability. Never use class components.
- **Top-down design** — if a function or component exceeds ~100 lines, extract sub-functions or sub-components.
- Prefer named exports over default exports (except for page/layout components).
- Group imports: React/Next.js first, then external libs, then internal modules.
