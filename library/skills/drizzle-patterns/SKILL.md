---
name: drizzle-patterns
description: "Drizzle ORM patterns for schema design, migrations, transactions, and DAO functions. Use when creating database schemas, writing queries, implementing transactions, or working with PostgreSQL via Drizzle."
---

# Drizzle ORM Patterns

## Critical Rules

- **Infer types from schema** — never duplicate type definitions manually.
- **Use `limit()` on all queries** — never fetch unbounded result sets.
- **Select only needed columns** — avoid `select()` with no arguments on large tables.
- **Never nest transactions** — keep transactions short with no external API calls inside.
- **Never edit generated migration files** — review SQL before applying in production.
- **Add indexes** on columns used in `WHERE`, `JOIN`, and `ORDER BY`.

## Schema Design

- Define schemas in `src/schema/` with one file per entity.
- Export all tables from `src/schema/index.ts` barrel file.
- Use `pgTable` for table definitions with typed columns.

```ts
// src/schema/user.ts
import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role", { enum: ["USER", "ADMIN"] }).notNull().default("USER"),
  emailVerified: boolean("email_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

## Relations

- Define relations separately using `relations()`:

```ts
import { relations } from "drizzle-orm";

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  organizations: many(organizationMembers),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
}));
```

## Database Client

```ts
// src/lib/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/schema";

export const db = drizzle(process.env.DATABASE_URL!, { schema });
```

## Query Patterns

- Use the query builder for complex reads:
```ts
const result = await db.query.users.findMany({
  where: eq(users.role, "ADMIN"),
  with: { posts: true },
  orderBy: [desc(users.createdAt)],
  limit: 20,
});
```

- Use `select()` for simple reads with specific columns:
```ts
const result = await db.select({
  id: users.id,
  name: users.name,
}).from(users).where(eq(users.role, "ADMIN"));
```

## Transactions

- Wrap multi-table writes in transactions:
```ts
await db.transaction(async (tx) => {
  const [org] = await tx.insert(organizations).values({ name }).returning();
  await tx.insert(organizationMembers).values({
    organizationId: org.id,
    userId: currentUser.id,
    role: "OWNER",
  });
});
```

## DAO Pattern

- Create DAO functions in `src/dal/` for reusable queries:

```ts
// src/dal/user.dal.ts
export async function findUserById(id: string) {
  return db.query.users.findFirst({
    where: eq(users.id, id),
  });
}

export async function findUsersByOrg(orgId: string) {
  return db.select()
    .from(users)
    .innerJoin(orgMembers, eq(orgMembers.userId, users.id))
    .where(eq(orgMembers.orgId, orgId));
}

export async function createUser(data: NewUser) {
  const [user] = await db.insert(users).values(data).returning();
  return user;
}

export async function updateUser(id: string, data: Partial<NewUser>) {
  const [user] = await db.update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return user;
}

export async function deleteUser(id: string) {
  await db.delete(users).where(eq(users.id, id));
}
```

## Migrations

- Generate migrations with `npx drizzle-kit generate`.
- Apply with `npx drizzle-kit migrate`.
- Use `drizzle-kit push` only in development for quick iteration.
- Review generated SQL before applying in production.

## Type Inference

```ts
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
```

## Performance

- Add indexes on columns used in `WHERE`, `JOIN`, and `ORDER BY`:
```ts
import { index } from "drizzle-orm/pg-core";

export const posts = pgTable("posts", {
  // columns...
}, (table) => [
  index("posts_author_idx").on(table.authorId),
  index("posts_created_at_idx").on(table.createdAt),
]);
```

- Use `prepare()` for frequently executed queries.
