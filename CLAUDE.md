# CLAUDE.md

Rules for working in this repository. These apply to every task unless the user explicitly says otherwise.

## Web/mobile parity

- The web and mobile apps must have **identical flows, features, and wording**. Any change to a flow, feature, or user-facing text in one platform must be made in the other in the same task.

## User-facing text

- All user-facing text goes through the shared **COPY module** — never hardcode strings in components or screens. If new copy is needed, add it to the COPY module and reference it from both platforms.

## Database

- **Never run `drizzle push`** (or `drizzle-kit push`).
- **Never truncate, drop, or delete tables**, and never delete data from them.
- Schema changes are **additive only**: new tables, new columns, new indexes. No destructive or renaming migrations.

## Naming

- Do **not** rename existing variables, functions, or files unless explicitly asked to.

## Gameplay integrity

- Players must **never see correct answers during gameplay** — not in the UI, and not in API responses or payloads sent to player clients mid-game. Correct answers are revealed only in the **end-of-game results**.

## Workflow

- Work on **one task at a time** — do not bundle unrelated changes.
- When a task is done, **show the diff** of the changes.
