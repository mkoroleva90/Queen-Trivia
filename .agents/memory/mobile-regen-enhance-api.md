---
name: Mobile regen/enhance API signatures
description: Correct hook signatures and return types for regenerate/enhance/update in mobile api-client-react
---

## useRegenerateQuestion
```ts
regenerate.mutateAsync({ gameId: number, questionId: number, data: {} })
// Returns: RegenerateQuestionPreview
// { questionType, questionText, correctAnswer, options: string[] | null, points, source }
```
Server determines topic/difficulty from the game — do NOT pass topic/difficulty/type in data.

## useEnhanceQuestion
```ts
enhance.mutateAsync({ gameId: number, questionId: number })
// No `data` argument at all
// Returns: EnhanceQuestionResult
// { improvedQuestionText, improvedOptions: string[] | null, suggestedSource }
```
Fields are `improvedQuestionText` and `improvedOptions` — NOT `questionText`/`correctAnswer`/`wrongAnswers`.

## useUpdateQuestion (options pattern)
```ts
updateQuestion.mutateAsync({
  questionId: number,
  data: {
    questionType?: ...,
    questionText?: string,
    correctAnswer?: string,
    options: regenPreview.options?.length ? { choices: regenPreview.options } : null,
    points?: number,
    source?: string,
  }
})
```
Wrong answers go via `options: { choices: string[] }` — there is no `wrongAnswers` field in QuestionUpdate.

**Why:** Discovered when implementing regen/enhance in BuildTab Review step — initial assumptions about the API based on web Admin.tsx were wrong. The mobile [gameId].tsx file is the correct reference for mobile API usage.
