import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DetectedStack {
  /** Human-readable summary, e.g. "Next.js 15, TypeScript, Tailwind, Drizzle, Supabase" */
  summary: string;
  /** Suggested preset slug based on detection */
  suggestedPreset: string;
  /** Individual detected technologies */
  technologies: string[];
}

// ---------------------------------------------------------------------------
// Detection rules
// ---------------------------------------------------------------------------

interface DetectionRule {
  name: string;
  /** Check package.json dependencies */
  packages?: string[];
  /** Check for file existence */
  files?: string[];
  /** Category for preset suggestion */
  category?: string;
}

const RULES: DetectionRule[] = [
  // Frameworks
  { name: "Next.js", packages: ["next"], category: "web" },
  { name: "Remix", packages: ["@remix-run/react"], category: "web" },
  { name: "Astro", packages: ["astro"], category: "web" },
  { name: "Nuxt", packages: ["nuxt"], category: "web" },
  { name: "SvelteKit", packages: ["@sveltejs/kit"], category: "web" },
  { name: "Express", packages: ["express"], category: "api" },
  { name: "Fastify", packages: ["fastify"], category: "api" },
  { name: "Hono", packages: ["hono"], category: "api" },
  { name: "Expo", packages: ["expo"], category: "mobile" },
  { name: "React Native", packages: ["react-native"], category: "mobile" },

  // Languages & runtimes
  { name: "TypeScript", files: ["tsconfig.json"] },
  { name: "Bun", files: ["bun.lockb", "bunfig.toml"] },

  // Styling
  { name: "Tailwind", packages: ["tailwindcss", "@tailwindcss/vite"] },
  { name: "styled-components", packages: ["styled-components"] },
  { name: "NativeWind", packages: ["nativewind"] },

  // UI libraries
  { name: "shadcn/ui", files: ["components.json"] },
  { name: "Radix UI", packages: ["@radix-ui/react-dialog"] },
  { name: "Gluestack", packages: ["@gluestack-ui/themed"] },

  // ORMs & databases
  { name: "Drizzle", packages: ["drizzle-orm"] },
  { name: "Prisma", packages: ["@prisma/client"], files: ["prisma/schema.prisma"] },
  { name: "Supabase", packages: ["@supabase/supabase-js"] },
  { name: "Mongoose", packages: ["mongoose"] },

  // Auth
  { name: "Auth.js", packages: ["next-auth", "@auth/core"] },
  { name: "Better Auth", packages: ["better-auth"] },
  { name: "Clerk", packages: ["@clerk/nextjs", "@clerk/clerk-react"] },
  { name: "Lucia", packages: ["lucia"] },

  // Payments
  { name: "Stripe", packages: ["stripe"] },
  { name: "LemonSqueezy", packages: ["@lemonsqueezy/lemonsqueezy.js"] },

  // AI
  { name: "Vercel AI SDK", packages: ["ai"] },
  { name: "LangChain", packages: ["langchain"] },
  { name: "OpenAI SDK", packages: ["openai"] },

  // Testing
  { name: "Vitest", packages: ["vitest"] },
  { name: "Jest", packages: ["jest"] },
  { name: "Playwright", packages: ["@playwright/test"] },
  { name: "Cypress", packages: ["cypress"] },

  // CLI
  { name: "Commander", packages: ["commander"] },
  { name: "Yargs", packages: ["yargs"] },
  { name: "Inquirer", packages: ["inquirer", "@inquirer/prompts"] },

  // Email
  { name: "Resend", packages: ["resend"] },
  { name: "Nodemailer", packages: ["nodemailer"] },

  // Real-time
  { name: "Socket.io", packages: ["socket.io"] },
  { name: "Pusher", packages: ["pusher"] },

  // Browser extension
  { name: "Chrome Extension", files: ["manifest.json"] },
  { name: "Plasmo", packages: ["plasmo"] },

  // CMS
  { name: "Contentlayer", packages: ["contentlayer"] },
  { name: "Sanity", packages: ["@sanity/client"] },
  { name: "MDX", packages: ["@next/mdx", "next-mdx-remote"] },
];

// ---------------------------------------------------------------------------
// Preset mapping
// ---------------------------------------------------------------------------

function suggestPreset(techs: string[], categories: Set<string>): string {
  // Specific patterns first
  if (categories.has("mobile")) return "mobile";
  if (techs.some((t) => t === "Chrome Extension" || t === "Plasmo")) return "extension";
  if (techs.some((t) => t === "Commander" || t === "Yargs")) return "cli";
  if (techs.some((t) => t === "Vercel AI SDK" || t === "LangChain" || t === "OpenAI SDK")) return "ai-app";
  if (techs.some((t) => t === "Stripe" || t === "LemonSqueezy")) return "ecommerce";
  if (techs.some((t) => t === "Socket.io" || t === "Pusher")) return "realtime";
  if (techs.some((t) => t === "Contentlayer" || t === "Sanity" || t === "MDX")) return "blog";

  // Category-based
  if (categories.has("api") && !categories.has("web")) return "api";
  if (categories.has("web")) return "saas";

  return "saas"; // default
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function detectStack(cwd = process.cwd()): DetectedStack {
  const technologies: string[] = [];
  const categories = new Set<string>();

  // Read package.json
  let deps = new Set<string>();
  const pkgPath = path.join(cwd, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };
      deps = new Set(Object.keys(allDeps));
    } catch {
      // Invalid package.json
    }
  }

  // Apply rules
  for (const rule of RULES) {
    let matched = false;

    if (rule.packages) {
      if (rule.packages.some((p) => deps.has(p))) matched = true;
    }

    if (rule.files) {
      if (rule.files.some((f) => fs.existsSync(path.join(cwd, f)))) matched = true;
    }

    if (matched) {
      technologies.push(rule.name);
      if (rule.category) categories.add(rule.category);
    }
  }

  const summary = technologies.length > 0
    ? technologies.join(", ")
    : "No specific stack detected";

  const suggestedPreset = suggestPreset(technologies, categories);

  return { summary, suggestedPreset, technologies };
}
