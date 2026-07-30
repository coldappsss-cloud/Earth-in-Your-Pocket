---
name: Expo dark-only theme
description: Earth in Your Pocket uses a dark-only palette; constants/colors.ts has only a `dark` key.
---

# Expo dark-only theme

## The rule
`constants/colors.ts` exports an object with only a `dark` key (no `light` key). `hooks/useColors.ts` always returns `colors.dark` without checking the device color scheme.

**Why:** Earth in Your Pocket is a dark-mode-only app (deep space aesthetic). A light theme would break the design.

**How to apply:** If a future feature adds a `light` key to colors.ts, also update useColors.ts to re-enable the scheme check. Currently it ignores `useColorScheme()`.
