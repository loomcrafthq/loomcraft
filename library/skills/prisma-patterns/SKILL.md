---
name: prisma-patterns
description: "Prisma ORM schema design, relations, queries, migrations, middleware, and seeding. Use when working with Prisma for database access."
---

# Prisma Patterns

## Critical Rules

- **Schema is the source of truth** — always modify `schema.prisma`, never raw SQL for schema changes.
- **Generate after every change** — run `npx prisma generate` after modifying the schema.
- **Migrate in dev, deploy in prod** — `prisma migrate dev` locally, `prisma migrate deploy` in CI/CD.
- **Never use raw SQL** unless the ORM cannot express the query.
- **Always include `createdAt` and `updatedAt`** on every model.

## Schema Design

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  role      Role     @default(USER)
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  authorId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([authorId])
  @@map("posts")
}

enum Role {
  USER
  ADMIN
}
```

### Conventions
- Model names: `PascalCase` singular (`User`, not `Users`)
- Field names: `camelCase`
- Table mapping: `@@map("snake_case_plural")`
- Use `cuid()` or `uuid()` for IDs, not auto-increment
- Explicit `onDelete` on every relation

## Relations

```prisma
// One-to-Many
model User {
  posts Post[]
}
model Post {
  author   User   @relation(fields: [authorId], references: [id])
  authorId String
}

// Many-to-Many (explicit join table)
model Post {
  tags PostTag[]
}
model Tag {
  posts PostTag[]
}
model PostTag {
  post   Post   @relation(fields: [postId], references: [id], onDelete: Cascade)
  postId String
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)
  tagId  String

  @@id([postId, tagId])
}

// Self-relation
model Category {
  id       String     @id @default(cuid())
  parent   Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  parentId String?
  children Category[] @relation("CategoryTree")
}
```

## Query Patterns

```ts
// Select specific fields
const users = await prisma.user.findMany({
  select: { id: true, email: true, name: true },
});

// Include relations (avoid N+1)
const posts = await prisma.post.findMany({
  include: { author: { select: { name: true } } },
});

// Pagination
const posts = await prisma.post.findMany({
  skip: (page - 1) * pageSize,
  take: pageSize,
  orderBy: { createdAt: "desc" },
});

// Transaction
const [post, notification] = await prisma.$transaction([
  prisma.post.create({ data: postData }),
  prisma.notification.create({ data: notifData }),
]);

// Interactive transaction
await prisma.$transaction(async (tx) => {
  const user = await tx.user.findUnique({ where: { id } });
  if (!user) throw new Error("User not found");
  await tx.post.create({ data: { ...postData, authorId: user.id } });
});
```

## Migrations

```bash
# Development — create and apply migration
npx prisma migrate dev --name add-user-role

# Production — apply pending migrations
npx prisma migrate deploy

# Reset database (dev only)
npx prisma migrate reset

# Check migration status
npx prisma migrate status
```

## Seeding

```ts
// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin",
      role: "ADMIN",
    },
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

## Middleware

```ts
// Soft delete middleware
prisma.$use(async (params, next) => {
  if (params.action === "delete") {
    params.action = "update";
    params.args.data = { deletedAt: new Date() };
  }
  return next(params);
});
```

## Do

- Use `select` to fetch only needed fields
- Add `@@index` on columns used in WHERE/ORDER BY
- Use transactions for multi-step writes
- Make seeds idempotent with `upsert`
- Review generated SQL in migrations before applying

## Don't

- Don't use `findFirst` without `orderBy` — results are non-deterministic
- Don't fetch all fields when you need only a few — use `select`
- Don't modify migration files after they've been applied
- Don't use `deleteMany` without a `where` clause
- Don't skip `prisma generate` after schema changes
