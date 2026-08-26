---
name: Expo Launch App Store state
description: How to distinguish project configuration failures from stale or removed App Store records in Expo Launch.
---

Expo Launch's guided App Store submission can target a stored App Store Connect app record and bundle identifier that differ from the current static Expo config or local eas.json submit metadata.

**Why:** A build can complete successfully and fail only at altool upload with `INVALID_APP_STATE` when the retained App Store record is removed or deleted. Source edits cannot restore that Apple record.

**How to apply:** Use `getExpoLaunchLogs()` first. Compare the failed launch's App Store ID and identifier with `app.json` and `eas.json`, then restore the Apple record or select the active existing app in the Publish flow. Do not change a bundle identifier merely to chase stale Launch metadata; changing it requires an explicit new-app decision.