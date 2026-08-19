---
name: Commons content filter matching
description: Prevent false positives in Wikimedia Commons image-candidate safety filtering.
---

When checking Wikimedia Commons titles, descriptions, and category labels against unsafe image terms, match complete terms rather than arbitrary substrings.

**Why:** A raw substring check matches `gory` inside the ordinary word `category`, which rejects otherwise safe candidates and makes every lookup appear to fail.

**How to apply:** Use a case-insensitive boundary-aware expression (or equivalent token-aware matcher) for each blocked term when adding or changing image-safety rules.