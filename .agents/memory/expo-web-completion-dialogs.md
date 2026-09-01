---
name: Expo web completion dialogs
description: Required cross-platform dialogs should not rely on React Native Alert alone.
---

Use an explicit React Native `Modal` for required completion or confirmation dialogs that must work in both native builds and the Expo web preview.

**Why:** `Alert.alert` did not surface in the Expo web preview during end-to-end testing even though the successful submission callback ran. A shared `Modal` rendered reliably for both player and host flows.

**How to apply:** Reserve `Alert.alert` for nonessential native notices. For behavior the user must see or interact with across platforms, render a controlled, accessible modal in the component tree and guard repeated presentation explicitly.