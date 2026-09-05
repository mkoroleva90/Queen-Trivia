---
name: EAS internal iOS credentials
description: Why the real-device development build cannot start non-interactively yet.
---

EAS has no iOS credentials suitable for internal distribution for this project. A registered iPhone alone is not enough; the ad hoc distribution certificate and provisioning profile must be configured interactively before `--non-interactive` can enqueue a development build.

**Why:** Both a standard non-interactive development build and a retry with ad hoc profile refresh stopped before creating a build because EAS could not find suitable internal-distribution credentials.

**How to apply:** Run the interactive EAS credential setup once for the iOS development profile, completing Apple authentication as needed. After that, retry the non-interactive development build and capture its real Expo build URL.