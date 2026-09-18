---
name: Mobile and web font parity
description: Why matching the Manrope family name was insufficient for visual parity.
---

For font parity, compare the actual font assets and their release metadata, not only their family names.

**Why:** The mobile Google Fonts Manrope and web's self-hosted Manrope had different font versions (fontconfig reported 295174 versus 131072). A title-weight-only correction still looked different to the user. Keep mobile on the web's exact assets rather than replacing them with the similarly named package.

**How to apply:** When changing fonts, preserve matching assets across both products and verify body text, inputs, bold labels, and nested text—not just hero headings. Individually registered Expo font aliases need actual weight-specific face selection rather than relying on synthetic fontWeight.