---
name: cms-patterns
description: "Content modeling, MDX integration, admin panel patterns, draft/publish workflows, and media management. Use when building blogs, documentation sites, or content-driven apps."
---

# CMS Patterns

## Critical Rules

- **Content model first** — design the content schema before building the UI.
- **Separate content from presentation** — content should be renderable in any format.
- **Draft/publish workflow** — content is never published without explicit action.
- **MDX for rich content** — use MDX when content needs embedded components.
- **Media optimization** — always process and optimize images on upload.

## Content Modeling

### Schema Design

```ts
// drizzle schema
export const posts = pgTable("posts", {
  id: text("id").primaryKey().$defaultFn(cuid),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull(),
  excerpt: text("excerpt"),
  coverImage: text("cover_image"),
  status: text("status", { enum: ["draft", "published", "archived"] })
    .notNull()
    .default("draft"),
  publishedAt: timestamp("published_at"),
  authorId: text("author_id").notNull().references(() => users.id),
  categoryId: text("category_id").references(() => categories.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: text("id").primaryKey().$defaultFn(cuid),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  parentId: text("parent_id").references((): AnyPgColumn => categories.id),
});

export const tags = pgTable("tags", {
  id: text("id").primaryKey().$defaultFn(cuid),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
});

export const postTags = pgTable("post_tags", {
  postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (t) => ({ pk: primaryKey({ columns: [t.postId, t.tagId] }) }));
```

## MDX Integration

### Setup with Next.js

```ts
// next.config.ts
import createMDX from "@next/mdx";

const withMDX = createMDX({
  options: { remarkPlugins: [], rehypePlugins: [] },
});

export default withMDX(nextConfig);
```

### Custom Components in MDX

```tsx
// mdx-components.tsx
import type { MDXComponents } from "mdx/types";
import { Callout } from "@/components/callout";
import { CodeBlock } from "@/components/code-block";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    Callout,
    pre: CodeBlock,
    img: (props) => <Image {...props} width={800} height={400} />,
  };
}
```

### File-based MDX Content

```
content/
  posts/
    my-first-post.mdx
    getting-started.mdx
```

```ts
// lib/content.ts
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const CONTENT_DIR = path.join(process.cwd(), "content/posts");

export function getPostBySlug(slug: string) {
  const filePath = path.join(CONTENT_DIR, `${slug}.mdx`);
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  return { frontmatter: data, content };
}

export function getAllPosts() {
  const files = fs.readdirSync(CONTENT_DIR);
  return files
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => getPostBySlug(f.replace(".mdx", "")))
    .sort((a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime());
}
```

## Draft/Publish Workflow

```ts
// Status transitions
type Status = "draft" | "published" | "archived";

const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  draft: ["published"],
  published: ["draft", "archived"],
  archived: ["draft"],
};

async function transitionPost(postId: string, newStatus: Status) {
  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) });
  if (!post) throw new Error("Post not found");

  const allowed = ALLOWED_TRANSITIONS[post.status as Status];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot transition from ${post.status} to ${newStatus}`);
  }

  await db.update(posts).set({
    status: newStatus,
    publishedAt: newStatus === "published" ? new Date() : post.publishedAt,
  }).where(eq(posts.id, postId));
}
```

## SEO for Content

```tsx
// app/blog/[slug]/page.tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPostBySlug(params.slug);
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: post.coverImage ? [post.coverImage] : [],
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
    },
  };
}

// Generate static paths
export async function generateStaticParams() {
  const posts = await getAllPublishedPosts();
  return posts.map((post) => ({ slug: post.slug }));
}
```

## Media Management

- Store uploads in object storage (S3, Cloudflare R2, Supabase Storage)
- Generate responsive image variants on upload (thumbnail, medium, large)
- Use `next/image` with a custom loader for CDN-hosted images
- Store metadata (dimensions, alt text, MIME type) in the database
- Validate file type and size on the server side

## Do

- Generate slugs automatically from titles (with collision handling)
- Use `generateStaticParams` for static generation of content pages
- Implement full-text search for content discovery
- Add reading time estimation based on word count
- Support scheduled publishing (publishedAt in the future)

## Don't

- Don't store HTML in the database — store MDX or structured content
- Don't skip slug uniqueness validation
- Don't serve unoptimized images
- Don't allow direct publish without a draft step
- Don't hardcode content in components — always use a content layer
