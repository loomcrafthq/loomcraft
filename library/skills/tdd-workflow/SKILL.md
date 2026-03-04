---
name: tdd-workflow
description: "RED-GREEN-REFACTOR cycle, test-first development strategy, and integration with task planning. Use when writing tests before implementation."
---

# TDD Workflow

## Critical Rules

- **RED first** — write a failing test before writing any production code.
- **Minimal GREEN** — write the simplest code that makes the test pass.
- **REFACTOR only when green** — never refactor with failing tests.
- **One behavior per cycle** — each RED-GREEN-REFACTOR cycle tests one thing.
- **Tests drive design** — if it's hard to test, the design needs improvement.

## RED-GREEN-REFACTOR Cycle

### RED — Write a Failing Test
```ts
// 1. Write the test for the behavior you want
it("should return 401 when user is not authenticated", async () => {
  const result = await deletePost(null, "post-1");
  expect(result.error).toBe("Unauthorized");
});
// 2. Run it — it MUST fail (confirms the test is valid)
// ✗ FAIL: deletePost is not defined
```

### GREEN — Make It Pass
```ts
// 3. Write the MINIMUM code to make the test pass
export async function deletePost(session: Session | null, postId: string) {
  if (!session) return { error: "Unauthorized" };
  // ... actual delete logic comes in next cycles
  return { success: true };
}
// ✓ PASS
```

### REFACTOR — Clean Up
```ts
// 4. Improve the code without changing behavior
// - Extract shared auth check
// - Improve naming
// - Remove duplication
// Run tests again — still green ✓
```

## When to Use TDD

| Scenario | TDD? | Why |
|----------|------|-----|
| Business logic / services | **Yes** | Core correctness matters most |
| API route handlers | **Yes** | Contract validation is critical |
| Auth / authorization | **Yes** | Security bugs are expensive |
| Data transformations | **Yes** | Edge cases are easy to miss |
| UI components | **Sometimes** | TDD for logic, visual testing for layout |
| Database migrations | **No** | Test after — schemas are declarative |
| Config files | **No** | Not behavioral code |

## Integration with Task Planning

When the planner creates tasks, TDD tasks follow this pattern:

```markdown
### Task: Implement deletePost service

- **Agent**: tests → backend (pair)
- **Workflow**:
  1. Tests agent writes failing tests for all cases (RED)
  2. Backend agent implements until all tests pass (GREEN)
  3. Review-QA agent reviews both tests and implementation (REFACTOR)
```

## Test Structure for TDD

```ts
describe("deletePost", () => {
  // Cycle 1: Auth check
  it("should return 401 when unauthenticated", async () => { /* ... */ });

  // Cycle 2: Authorization check
  it("should return 403 when user doesn't own the post", async () => { /* ... */ });

  // Cycle 3: Happy path
  it("should delete the post when user is the author", async () => { /* ... */ });

  // Cycle 4: Edge case
  it("should return 404 when post doesn't exist", async () => { /* ... */ });

  // Cycle 5: Admin override
  it("should allow admin to delete any post", async () => { /* ... */ });
});
```

## Do

- Write one test at a time, not the whole suite upfront
- Run tests after every change — the feedback loop is the point
- Let failing tests guide what code to write next
- Use descriptive test names that read like specifications
- Commit after each green cycle

## Don't

- Don't write production code without a failing test first
- Don't write multiple tests before making any pass
- Don't refactor while tests are red
- Don't test implementation details — test behavior
- Don't skip the refactor step — it's where design emerges

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| **Test-after** | Writing tests after implementation misses design feedback | Discipline: RED before GREEN |
| **Big bang GREEN** | Writing too much code to pass multiple tests at once | One test, one behavior, one cycle |
| **Skipping REFACTOR** | Accumulating technical debt in test code | Schedule refactor as part of every cycle |
| **Testing internals** | Tests break on every refactor | Test public API and observable behavior only |
| **Slow feedback** | Tests take too long to run | Keep unit tests fast (< 1s per suite) |
