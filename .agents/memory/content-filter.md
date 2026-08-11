---
name: Content filter architecture
description: Server-side slur/hate-speech filter — word list source, normalization design decision, enforcement points, and client-side error surfacing pattern.
---

# Content filter

## Word list source
`naughty-words@1.2.0` npm package (English list, `naughty-words/en.json`), 383 entries.
Imported server-side only via `createRequire` in `artifacts/api-server/src/lib/contentFilter.ts`.
Never shipped to web or mobile bundles.

## Critical normalization design decision
**Collapse 3+ repeated chars to 2, NOT to 1.**  
`(.)\1{2,}` → `$1$1`

**Why:** Collapsing to 1 makes "nigger" (2 g's) normalize to "niger" (1 g), which then false-positives on "Niger" the country. Collapsing to 2 preserves the double-g distinction: "Niger"→"niger" (1 g, not in banned set), "nigger"→"nigger" (2 g's, in banned set), "niggger"→"nigger" (3 g's→2 g's, caught). This is the same transform applied to both the word list and the input.

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
