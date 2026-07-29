# Memory index

- [PDF code restore](pdf-code-restore.md) — how the Trivia Night app was reconstructed from a PDF code export; wrap-join loses spaces, YAML indentation must come from bbox coords.
- [Codegen tooling quirks](codegen-tooling-quirks.md) — orval codegen broken on Node 24: hand-patch all 3 generated locations; drizzle push needs TTY, apply DDL via SQL instead.
- [Admin code source of truth](admin-auth-code-source.md) — /api/admin/login checks ADMIN_ACCESS_KEY env before the DB code; the two can disagree. Socket singleton: one hook cleanup disconnects all.
