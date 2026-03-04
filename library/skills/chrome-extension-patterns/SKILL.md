---
name: chrome-extension-patterns
description: "Chrome extension development patterns for Manifest V3, content scripts, popup UI, service workers, messaging, and storage. Use when building browser extensions, creating content scripts, setting up background service workers, or implementing extension popup interfaces."
---

# Chrome Extension Patterns (Manifest V3)

## Critical Rules

- **Always use Manifest V3** — Manifest V2 is deprecated and no longer accepted.
- **Minimal permissions** — request only what the extension needs; use `activeTab` over `<all_urls>`.
- **Never use `setInterval` in service workers** — use `chrome.alarms` for periodic tasks.
- **Never use `innerHTML` with user input** — use `textContent` to prevent XSS.
- **Never include API keys in content scripts** — they are visible to the host page.
- **Never use `localStorage` in content scripts** — it belongs to the host page; use `chrome.storage`.

## Manifest

- Define minimal permissions — request only what the extension needs:
  ```json
  {
    "manifest_version": 3,
    "permissions": ["storage", "activeTab"],
    "host_permissions": ["https://specific-site.com/*"]
  }
  ```
- Use `activeTab` instead of broad `<all_urls>` when possible.
- Declare content scripts and their match patterns explicitly.
- Use `"action"` (not `"browser_action"`) for the extension button.

## Architecture

- **Popup** (`popup.html/tsx`): lightweight UI shown on extension icon click. Keep it fast — no heavy initialization.
- **Options page** (`options.html/tsx`): settings and configuration UI.
- **Background service worker** (`background.ts`): event-driven logic, API calls, alarms, message routing.
- **Content scripts** (`content.ts`): code injected into web pages to read/modify DOM.
- Keep these four concerns strictly separated — never mix responsibilities.

## Service Workers (Background)

- Service workers are **event-driven and ephemeral** — they start on events and stop when idle.
- Never rely on global state persisting between activations. Use `chrome.storage` instead.
- Register event listeners at the top level (not inside async callbacks):
  ```ts
  chrome.runtime.onInstalled.addListener(() => { /* ... */ })
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => { /* ... */ })
  ```
- Use `chrome.alarms` for periodic tasks — never `setInterval`.
- Return `true` from `onMessage` listener to send async responses.

## Content Scripts

- Content scripts run in an **isolated world** — they can access the page DOM but not the page's JS variables.
- Sanitize all DOM manipulation to prevent XSS:
  ```ts
  element.textContent = userInput // Safe
  element.innerHTML = userInput   // DANGEROUS — never do this
  ```
- Minimize content script footprint — inject only what's necessary.
- Use `MutationObserver` for dynamic pages instead of polling.
- Communicate with background via `chrome.runtime.sendMessage()`.

## Storage

- Use `chrome.storage.local` for large data (up to 10MB).
- Use `chrome.storage.sync` for user settings that should sync across devices (100KB limit).
- Never use `localStorage` in content scripts — it belongs to the host page.
- Listen for storage changes:
  ```ts
  chrome.storage.onChanged.addListener((changes, area) => { /* ... */ })
  ```

## Messaging

- Use `chrome.runtime.sendMessage` for popup/options <-> background communication.
- Use `chrome.tabs.sendMessage` for background -> content script communication.
- Define a message type system for type-safe messaging:
  ```ts
  type Message =
    | { type: 'GET_DATA'; payload: { key: string } }
    | { type: 'SAVE_DATA'; payload: { key: string; value: unknown } }
  ```
- Validate all incoming messages — never trust message content blindly.

## Popup UI (React)

- Keep popup bundle small — lazy load heavy features.
- Use React for popup and options page, bundled with tsup or Vite.
- Popup window is destroyed on close — persist state to `chrome.storage`.
- Set a fixed width/height for popup: `min-width: 320px; min-height: 400px`.

## Security

- Never inject user-generated content into web pages without sanitization.
- Use Content Security Policy (CSP) in manifest.
- Validate all data from external sources (APIs, messages, storage).
- Never include API keys or secrets in content scripts — they're visible to the page.
- Audit `host_permissions` — overly broad permissions trigger Chrome Web Store review delays.

## Development

- Use `chrome://extensions` with Developer Mode for loading unpacked extensions.
- Enable "Errors" view for debugging service worker issues.
- Use Chrome DevTools to inspect popup (right-click -> Inspect) and background (service worker link).
- Hot-reload: rebuild with tsup watch, then click "Update" in `chrome://extensions`.
