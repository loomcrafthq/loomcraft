---
name: ai-patterns
description: "LLM integration, RAG pipelines, prompt engineering, streaming responses, and tool use. Use when building AI-powered features like chatbots, RAG, or AI agents."
---

# AI Patterns

## Critical Rules

- **Stream by default** — never make users wait for a complete LLM response.
- **Validate all LLM output** — AI responses are untrusted input; parse and validate.
- **Cost-aware design** — choose the right model size for each task.
- **Graceful degradation** — always have a fallback when the AI fails or is slow.
- **Guard against prompt injection** — sanitize user input before including in prompts.

## LLM Integration

### Basic Chat Completion (Vercel AI SDK)

```ts
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: anthropic("claude-sonnet-4-5-20250514"),
    system: "You are a helpful assistant.",
    messages,
  });

  return result.toDataStreamResponse();
}
```

### Client-Side Streaming

```tsx
"use client";
import { useChat } from "ai/react";

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat();

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>{m.role}: {m.content}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} disabled={isLoading} />
      </form>
    </div>
  );
}
```

## RAG (Retrieval-Augmented Generation)

### Pipeline

```
User Query → Embed Query → Vector Search → Retrieve Chunks → Build Prompt → LLM → Response
```

### Embedding and Storage

```ts
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

async function embedAndStore(text: string, metadata: Record<string, string>) {
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: text,
  });

  await db.insert(documents).values({
    content: text,
    embedding,
    metadata,
  });
}
```

### Retrieval

```ts
async function retrieveContext(query: string, topK = 5) {
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: query,
  });

  const results = await db
    .select()
    .from(documents)
    .orderBy(cosineDistance(documents.embedding, embedding))
    .limit(topK);

  return results.map((r) => r.content).join("\n\n");
}
```

### RAG Prompt Construction

```ts
const context = await retrieveContext(userQuery);

const result = streamText({
  model: anthropic("claude-sonnet-4-5-20250514"),
  system: `Answer based on the following context. If the context doesn't contain the answer, say so.

Context:
${context}`,
  messages: [{ role: "user", content: userQuery }],
});
```

## Prompt Engineering

### System Prompt Structure
```
[Role] — Who the AI is
[Context] — What it knows
[Instructions] — What to do
[Constraints] — What NOT to do
[Output format] — How to respond
```

### Best Practices
- Be specific: "Respond in 2-3 sentences" not "Be concise"
- Use examples (few-shot) for complex output formats
- Separate instructions from user content with clear delimiters
- Put the most important instructions at the beginning and end

## Tool Use

```ts
import { streamText, tool } from "ai";
import { z } from "zod";

const result = streamText({
  model: anthropic("claude-sonnet-4-5-20250514"),
  tools: {
    getWeather: tool({
      description: "Get current weather for a location",
      parameters: z.object({
        city: z.string().describe("City name"),
      }),
      execute: async ({ city }) => {
        const weather = await fetchWeather(city);
        return weather;
      },
    }),
  },
  messages,
});
```

## Cost Optimization

| Task | Recommended Model | Why |
|------|------------------|-----|
| Simple classification | Haiku / GPT-4o-mini | Fast, cheap, sufficient |
| Complex reasoning | Sonnet / GPT-4o | Balance of quality and cost |
| Critical analysis | Opus / o1 | Maximum accuracy needed |
| Embeddings | text-embedding-3-small | Best price/performance |

## Security

- **Prompt injection**: Never insert raw user input into system prompts without sanitization
- **Output validation**: Parse LLM JSON output with Zod, don't trust it blindly
- **Rate limiting**: Limit AI endpoint calls per user to prevent abuse
- **Cost caps**: Set per-user and per-request spending limits
- **PII handling**: Don't send sensitive user data to external AI APIs without consent

## Do

- Stream responses for any generation > 100 tokens
- Cache embeddings and frequent queries
- Log prompts and responses for debugging (redact PII)
- Use structured output (JSON mode) when parsing is needed
- Implement retry with exponential backoff for API failures

## Don't

- Don't block the UI waiting for a complete LLM response
- Don't trust LLM output as valid JSON without parsing
- Don't hardcode API keys — use environment variables
- Don't send entire documents when a summary would suffice
- Don't use the most expensive model for every task
