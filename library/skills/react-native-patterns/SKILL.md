---
name: react-native-patterns
description: "React Native and Expo best practices for navigation, styling, performance, and native features. Use when building mobile apps with Expo, implementing React Native navigation, styling with NativeWind, optimizing mobile performance, or adding push notifications."
---

# React Native & Expo Patterns

## Critical Rules

- **Always try Expo Go first** — only use `npx expo run:ios/android` when custom native modules are required.
- **Functional components only** — never class components.
- **Use `expo-image` instead of React Native's `Image`** — better caching and performance.
- **Use `react-native-safe-area-context`** — never React Native's built-in `SafeAreaView`.
- **Use `FlashList` instead of `FlatList`** for large lists — significantly better performance.
- **Never block the JS thread** — target 60fps, offload heavy computation to native.

## Expo Router

- Use file-based routing in the `app/` directory exclusively.
- Never co-locate components, types, or utilities in the `app/` directory — keep them in `src/`.
- Always ensure a route matches `/` (may be inside a group route).
- Use layout routes (`_layout.tsx`) for shared navigation UI (tabs, stacks, drawers).
- Remove old route files immediately when restructuring navigation.
- Use kebab-case for file names: `comment-card.tsx`.

## Styling with NativeWind

- Use NativeWind (Tailwind for React Native) as the primary styling method.
- Use `className` prop like web Tailwind — NativeWind compiles to StyleSheet.
- Use `cn()` helper for conditional classes.
- Prefer `useWindowDimensions` over `Dimensions.get()` for responsive layouts.
- Use flexbox exclusively for layout — avoid absolute positioning except for overlays.

## Components

- Use functional components only — never class components.
- Use `expo-image` instead of React Native's `Image` — better caching and performance.
- Use `expo-image` with `source="sf:name"` for SF Symbols icons — not `@expo/vector-icons`.
- Use `react-native-safe-area-context` — never React Native's built-in `SafeAreaView`.
- Use `<ScrollView contentInsetAdjustmentBehavior="automatic" />` instead of `<SafeAreaView>` for root scrolling.
- Use `process.env.EXPO_OS` instead of `Platform.OS`.
- Use `React.use` instead of `React.useContext`.

## Navigation

- Use Expo Router's typed routes for type-safe navigation.
- Handle deep linking and universal links from project start.
- Use native tabs (`NativeTabs`) for iOS tab navigation when possible.
- Preload frequently accessed screens for faster navigation.

## Performance

- **Profile before optimizing** — measure with React DevTools and Xcode Instruments.
- Replace `ScrollView` with `FlashList` (not `FlatList`) for large lists.
- Use React Compiler for automatic memoization when available.
- Avoid barrel exports — import directly from source files to reduce bundle size.
- Keep JS thread work minimal — offload to native with Turbo Modules when needed.
- Target 60fps — never block the JS thread with heavy computation.
- Use `useDeferredValue` for expensive computations during rendering.

## Animations

- Use `react-native-reanimated` for performant animations on the UI thread.
- Animate only `transform` and `opacity` — avoid animating layout properties.
- Use shared values and worklets for gesture-driven animations.
- Respect `prefers-reduced-motion` accessibility setting.

## Offline & Storage

- Use `@react-native-async-storage/async-storage` or `react-native-mmkv` for local key-value storage.
- Use `expo-sqlite` for structured offline data.
- Implement optimistic updates for network operations.
- Cache critical data locally for offline-first experience.

## Push Notifications

- Use `expo-notifications` for push notification setup.
- Request permission at a contextual moment — never on first launch.
- Handle notification responses (tap, dismiss) in the app root.
- Store push tokens in your backend database, linked to user profiles.

## App Distribution

- Use EAS Build for creating production builds.
- Use EAS Submit for app store submissions.
- Configure `app.json` / `app.config.ts` thoroughly: icons, splash, permissions, version.
- Test on both iOS and Android — never assume platform parity.
