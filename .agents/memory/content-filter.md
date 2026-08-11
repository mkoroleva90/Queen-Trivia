---
name: Content filter architecture
description: Server-side slur/hate-speech filter — word list source, normalization design decision, enforcement points, and client-side error surfacing pattern.
---

# Content filter

## Word list source
Curated slur-only list in `artifacts/api-server/src/lib/slurList.ts` — 29 entries after normalisation.
Slurs and hate speech targeting groups ONLY. General profanity (dick, cock, ass, sex, etc.) is explicitly excluded.
naughty-words package removed entirely from api-server dependencies.

## Critical normalization design decisions

**1. Non-destructive leet-speak substitution.**
Each token produces TWO forms: plain (digits stripped as-is) and leet (digits substituted then stripped). BOTH are checked against the banned set. This prevents digits in trivia (years, arithmetic) from ever producing letter fragments that cause false positives. "1945" → plain="" (empty, skipped); "n1gger" → plain="ngger" (not banned) + leet="nigger" (banned) → BLOCKED.

**2. Collapse 3+ repeated chars to 2, NOT to 1.**  
`(.)\1{2,}` → `$1$1`
Collapsing to 1 makes "nigger" (2 g's) normalize to "niger" (1 g), false-positiving on Niger the country. Collapsing to 2 keeps them distinct.

**3. Single-letter-run only accumulates plain-form single letters.**
Tokens whose plain form is empty (pure digits/symbols) BREAK the run rather than being included. "5 + 3 - 1" produces no single-letter run.

## Enforcement points (all before any db write)
1. `session.ts` POST /auth/login — player display name, before `db.insert(usersTable)`
2. `questions.ts` POST /games/:gameId/questions — host create, before `db.insert(questionsTable)`
3. `questions.ts` PATCH /questions/:questionId — host edit, before `db.update(questionsTable)`
4. `play.ts` POST /games/:gameId/answers — player answer, before `db.insert(answersTable)`
5. `gemini.ts` bulk generate — AI questions filtered out of `result.questions` array before `db.insert(questionsTable)`

## Error format
HTTP 422, `{ "error": "<COPY string>", "code": "content_filtered" }`

## Client surfacing pattern
- Web Gate.tsx (player name): raw fetch, reads `res.json().code/error` on !ok, sets field error inline (no toast)
- Web Admin.tsx (question): react-query onError receives err, reads `err.data.error`/`err.data.code`, shows toast
- Web GamePlay.tsx (answer): react-query onError, reads `err.data.error`/`err.data.code`, shows destructive toast
- Mobile index.tsx (player name): raw fetch, reads `res.json().code/error` on !ok, sets nameError inline
- Mobile game/[id].tsx (answer): react-query onError, reads `err.data.error`/`err.data.code`, Alert.alert()
- Mobile BuildTab.tsx (regen/enhance updates): already uses extractApiError(err) which reads err.data.error ✓
