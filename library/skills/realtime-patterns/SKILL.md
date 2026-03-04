---
name: realtime-patterns
description: "WebSockets, Server-Sent Events, presence tracking, conflict resolution, and optimistic UI. Use when building real-time features like chat, collaboration, or live updates."
---

# Realtime Patterns

## Critical Rules

- **Choose the right transport** — SSE for one-way, WebSockets for bidirectional.
- **Optimistic UI first** — update the UI immediately, reconcile with server later.
- **Handle disconnections** — always implement reconnection with exponential backoff.
- **Conflict resolution** — define a strategy (last-write-wins, CRDTs, operational transform) before building.
- **Presence is ephemeral** — never persist presence state in the main database.

## Transport Selection

| Feature | SSE | WebSocket | Supabase Realtime |
|---------|-----|-----------|-------------------|
| Direction | Server → Client | Bidirectional | Bidirectional |
| Protocol | HTTP | WS | WS (managed) |
| Auto-reconnect | Built-in | Manual | Built-in |
| Best for | Notifications, feeds | Chat, collaboration | DB-driven updates |

## Server-Sent Events (SSE)

```ts
// app/api/events/route.ts
export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const interval = setInterval(() => {
        const data = JSON.stringify({ time: new Date().toISOString() });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }, 1000);

      return () => clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

```ts
// Client
const eventSource = new EventSource("/api/events");
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Update UI
};
eventSource.onerror = () => {
  // Auto-reconnects by default
};
```

## Supabase Realtime

```ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(url, key);

// Listen to database changes
const channel = supabase
  .channel("posts")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "posts" },
    (payload) => {
      console.log("Change:", payload);
    }
  )
  .subscribe();

// Presence tracking
const presenceChannel = supabase.channel("room-1");
presenceChannel
  .on("presence", { event: "sync" }, () => {
    const state = presenceChannel.presenceState();
    console.log("Online users:", Object.keys(state));
  })
  .subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await presenceChannel.track({ user_id: userId, online_at: new Date() });
    }
  });
```

## Optimistic UI

```tsx
"use client";
import { useOptimistic, useTransition } from "react";

function MessageList({ messages }: { messages: Message[] }) {
  const [optimisticMessages, addOptimistic] = useOptimistic(
    messages,
    (state, newMessage: Message) => [...state, { ...newMessage, pending: true }]
  );
  const [, startTransition] = useTransition();

  async function sendMessage(content: string) {
    const tempMessage = { id: crypto.randomUUID(), content, pending: true };
    startTransition(() => addOptimistic(tempMessage));
    await postMessage(content); // Server action
  }

  return (
    <ul>
      {optimisticMessages.map((msg) => (
        <li key={msg.id} className={msg.pending ? "opacity-50" : ""}>
          {msg.content}
        </li>
      ))}
    </ul>
  );
}
```

## Conflict Resolution Strategies

| Strategy | Complexity | Best For |
|----------|-----------|----------|
| **Last-write-wins** | Low | Non-critical data (presence, cursors) |
| **Server authority** | Low | Turn-based interactions |
| **Operational Transform** | High | Real-time text editing (Google Docs) |
| **CRDTs** | High | Offline-first, peer-to-peer |

### Last-Write-Wins Example
```ts
// Server: always accept the latest timestamp
async function updateDocument(id: string, content: string, updatedAt: Date) {
  await db
    .update(documents)
    .set({ content, updatedAt })
    .where(
      and(eq(documents.id, id), lt(documents.updatedAt, updatedAt))
    );
}
```

## Reconnection

```ts
function createReconnectingWebSocket(url: string) {
  let ws: WebSocket;
  let retryCount = 0;
  const maxRetry = 5;

  function connect() {
    ws = new WebSocket(url);
    ws.onopen = () => { retryCount = 0; };
    ws.onclose = () => {
      if (retryCount < maxRetry) {
        const delay = Math.min(1000 * 2 ** retryCount, 30000);
        setTimeout(connect, delay);
        retryCount++;
      }
    };
  }

  connect();
  return { send: (data: string) => ws.send(data) };
}
```

## Do

- Debounce high-frequency events (typing indicators: 300ms)
- Use channels/rooms to scope subscriptions
- Show connection status to the user (connected/reconnecting/offline)
- Clean up subscriptions on component unmount
- Batch updates when receiving many events in rapid succession

## Don't

- Don't poll when real-time is available
- Don't persist presence/cursor data in the main database
- Don't send full documents — send diffs/patches
- Don't ignore disconnection states — users need feedback
- Don't subscribe to all changes — filter by relevance
