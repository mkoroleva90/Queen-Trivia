/**
 * @workspace/copy — Shared UI terminology for Trivia Night
 *
 * Single source of truth for all user-facing strings that must stay
 * identical across the web app (artifacts/trivia-game) and the mobile
 * app (artifacts/mobile).
 *
 * RULES
 * ─────
 * 1. Core noun: the thing a host creates is a "game," never a "quiz."
 * 2. Sentence case for all labels, headings, and button text.
 *    e.g. "Save changes" not "Save Changes", "New game" not "New Game".
 * 3. Questions are always "questions" in full — never "Qs".
 * 4. Difficulty values: "Easy", "Medium", "Hard" (capitalized).
 *    On SELECTORS include point value: "Easy (5 pts)", "Medium (10 pts)", "Hard (15 pts)".
 *    On DISPLAY cards: just the capitalized word, no point value.
 * 5. Access codes: always "Trivia access code" and "Admin access code" in full.
 * 6. Question source database: always "Open Trivia Database" — never "OpenTDB".
 * 7. Status labels: "Draft", "Live", "Done".
 *
 * HOW TO USE
 * ──────────
 * import { COPY } from '@workspace/copy';
 * <Button>{COPY.btn.newGame}</Button>
 * <Badge>{COPY.source.openTriviaDatabase}</Badge>
 */

export const COPY = {
  /** The singular and plural noun for the thing a host creates. */
  entity: {
    singular: 'game',
    plural: 'games',
    /** Capitalised for headings */
    singularCap: 'Game',
    pluralCap: 'Games',
  },

  /** Difficulty values and their point weights. */
  difficulty: {
    /** For selectors — includes point value */
    selector: {
      easy:   'Easy (5 pts)',
      medium: 'Medium (10 pts)',
      hard:   'Hard (15 pts)',
    },
    /** For display-only labels on cards */
    display: {
      easy:   'Easy',
      medium: 'Medium',
      hard:   'Hard',
    },
    /** Point values keyed by difficulty slug */
    points: {
      easy:   5,
      medium: 10,
      hard:   15,
    } as Record<string, number>,
  },

  /** Game status labels shown in chips and badges. */
  status: {
    waiting:   'Draft',
    active:    'Live',
    completed: 'Done',
  } as Record<string, string>,

  /** Access code terminology — always use the full term. */
  accessCode: {
    trivia: 'Trivia access code',
    /** Card / section heading */
    sectionTitle: 'Access codes',
    /** Validation errors */
    validationTrivia: 'Trivia access code must be at least 8 characters',
  },

  /** Question-source labels. */
  source: {
    /** Always use this exact string — never "OpenTDB" */
    openTriviaDatabase: 'Open Trivia Database',
    ai:                 'AI Generated',
    manual:             'Manual',
    /**
     * Name of the AI question source as shown in host-facing summaries
     * (e.g. the "Ready to go live" source line). Both platforms.
     */
    geminiAi:           'Gemini AI',
    /**
     * Compact badge forms shown on question cards in the mobile game editor,
     * where the full source name does not fit beside the type tag.
     */
    aiTag:              'AI',
    openTriviaDatabaseTag: 'OpenTDB',
  },

  /** Helper text shown under source-specific input fields. */
  sourceHelper: {
    /** Shown under the "Topic" field that feeds Gemini AI generation. */
    topic:    'Gemini AI generates questions based on this topic.',
    /** Shown under the "Category" field that feeds Open Trivia Database import. */
    category: 'Questions are pulled from Open Trivia Database.',
  },

  /** Open Trivia Database question-mix selector labels. */
  openTdbQuestionMix: {
    title:    'Question mix',
    standard: 'Multiple choice & true/false only',
    extended: 'Multiple choice, true/false, write-in, ordering & multi-select',
    surprise: 'Surprise me',
    hint:     'Choose a question mix',
  },

  /** Common button labels. */
  btn: {
    newGame:       'New game',
    createGame:    'Create game',
    /** Setup-form submit when questions come from Open Trivia Database. */
    saveGame:      'Save game',
    saveChanges:   'Save changes',
    addQuestion:   'Add question',
    saveQuestion:  'Save changes',
    deleteAccount: 'Delete account',
  },

  /** Common headings and empty-state copy. */
  heading: {
    yourGames:       'Your games',
    createNewGame:   'Create a new game',
    createNewGame2:  'Create new game',   // for the dashed tile
    buildAGame:      'Build a game',
    importFromOtdb:  'Import from Open Trivia Database',
    generateWithAi:  'Generate with AI',
    accessCodes:     'Access codes',
    dangerZone:      'Danger zone',
  },

  /** Navigation labels. */
  nav: {
    games:   'Games',
    live:    'Live',
    build:   'Build a game',
    /**
     * Short form of `build` for bottom tab bars (web mobile-width nav and
     * the native AdminTabBar), where the full label does not fit.
     */
    buildShort: 'Build',
    results: 'Results',
    rooms:   'Account',
  },

  /**
   * Create-game (build) form strings — the setup form where a host names a
   * new quiz (web Admin.tsx create form; mobile BuildTab.tsx setup form).
   * Both platforms must use these keys so wording stays in sync.
   */
  build: {
    /** Placeholder for the quiz title / topic input, which starts blank. */
    titlePlaceholder: 'Name your quiz',
    /** Step-indicator labels on the mobile Build tab (web has no step indicator). */
    stepSetup:  'Setup',
    stepReview: 'Review',
    /** Validation error when the AI topic field is blank (mobile setup form). */
    enterTopic: 'Enter a topic',
    /** Category selector option that switches the source to Gemini AI. Both platforms. */
    customTopicOption: 'Custom topic — Gemini AI generates questions',
    /** Category selector placeholder before a category is chosen (mobile). */
    selectCategory: 'Select a category',
    /** Accessibility labels for the Build tab back buttons (mobile). */
    backToGameMode:    'Back to game mode',
    backToJoinCode:    'Back to join code',
    backToReadyScreen: 'Back to ready screen',
    backToSetup:       'Back to setup',
    /**
     * Fallback error messages for the Build flow, used when the API response
     * carries no message of its own.
     */
    error: {
      /** Both platforms. */
      fetchOpenTdb:    'Could not fetch questions from Open Trivia Database',
      /** Mobile setup / review flow. */
      goLive:          'Could not go live — please retry',
      importQuestions: 'Could not import questions — please retry',
      createGame:      'Failed to create game — please retry',
      generate:        'Generation failed — try again or add questions manually',
      regenerate:      'Regeneration failed — try again',
      saveRegenerated: 'Could not save regenerated question',
      enhance:         'Enhancement failed — try again',
      saveEnhanced:    'Could not save enhanced question',
    },
    /** Setup-form working labels shown on the submit button while a request is in flight. */
    working: {
      creating:  'Creating game…',
      generating: 'Generating questions…',
      importing: 'Importing questions…',
      default:   'Working…',
    },
    /** Go-live button label while the status PATCH is in flight. Both platforms. */
    goingLive:        'Going live…',
    /** Setup-form field labels (mobile). */
    categoryLabel:    'Category',
    topicLabel:       'Topic',
    briefLabel:       'Brief',
    /** Placeholder for the optional AI brief. Both platforms. */
    briefPlaceholder: 'e.g. Focus on the 1990s. Players are experts — skip the obvious. No chart position questions.',
    difficultyLabel:  'Difficulty',
    amountLabel:      'Questions to Import',
    /** Accessibility label for the run-mode screen back button (mobile). */
    backToGames:      'Back to games',
    /** Review step (mobile). */
    reviewHeading:        'Review questions',
    regenAllBtn:          'Regen all',
    nothingToReviewTitle: 'Nothing to review',
    nothingToReviewBody:  'Create a game and add questions first.',
    selectGameLabel:      'Select game',
    noQuestionsHint:      'No questions yet — add some from the game detail screen.',
    addQuestionsBtn:      'Add questions',
    liveBanner:           'This game is live — changes save instantly',
    publishBtn:           'Publish & go live',
    /** "{n} question(s) · {pts} pts total" summary line on the review step. */
    summaryQuestions:     (n: number, pts: number) => `${n} question${n === 1 ? '' : 's'} · ${pts} pts total`,
    /** Suffixes appended to the question meta line ("{type} · {pts} pts{suffix}"). */
    metaAiSuffix:         ' · AI',
    metaOpenTdbSuffix:    ' · Open Trivia Database',
    /** Amount stepper hint ("questions (max 20)"). */
    stepperHint:          (max: number) => `questions (max ${max})`,
    /** Generate-with-AI sheet on the review step (mobile). */
    aiSheet: {
      title:           'Generate with AI',
      generatedResult: (n: number) => `${n} question${n === 1 ? '' : 's'} generated`,
      generateMore:    'Generate more',
      topicLine:       (topic: string, difficulty: string) => `Topic: ${topic} · ${difficulty}`,
      howManyLabel:    'How many',
      briefLabel:      'Brief (optional)',
      briefPlaceholder: 'Extra guidance for the AI',
      generating:      'Generating questions…',
      generateBtn:     (n: number) => `Generate ${n} questions`,
    },
    /** Import-from-Open-Trivia-Database sheet on the review step (mobile). */
    tdbSheet: {
      importedResult: (n: number) => `${n} question${n === 1 ? '' : 's'} imported`,
      importMore:     'Import more',
      categoryLabel:  'Category',
      difficultyLabel: 'Difficulty',
      howManyLabel:   'How many',
      importBtn:      (n: number) => `Import ${n} questions`,
    },
    /** Regenerate-question sheet (mobile review step). */
    regenSheet: {
      title:            'Regenerate question',
      newQuestionLabel: 'New question',
      answerLabel:      'Answer',
      acceptBtn:        'Accept',
      generateBtn:      'Generate',
    },
    /** Enhance-question sheet (mobile review step). */
    enhanceSheet: {
      title:                'Enhance question',
      improvedQuestionLabel: 'Improved question',
      improvedOptionsLabel: 'Improved options',
      applyBtn:             'Apply improvements',
      keepOriginalBtn:      'Keep original',
      enhanceBtn:           'Enhance with AI',
    },
    /** Regenerate-all confirmation sheet (mobile review step). */
    regenAll: {
      title:      'Regenerate all AI questions?',
      body:       (n: number) => `All ${n} AI-generated questions will be deleted and new ones generated for this game.`,
      confirmBtn: 'Regenerate all',
    },
  },

  /**
   * Admin games-list strings — host-facing labels on the games list screen
   * (web Admin.tsx GamesView and mobile GamesTab.tsx).
   * Both platforms must use these keys so wording stays in sync.
   */
  admin: {
    /** Label for the filter tab that shows all games regardless of status. */
    filterAll: 'All',
    /** Filter tab that shows only live games. */
    filterLive: 'Live',
    /** Filter tab that shows only draft (waiting) games. */
    filterDrafts: 'Drafts',
    /**
     * Rename-quiz flow — host-facing errors and success messages.
     * Used in web GamesView (Admin.tsx) and mobile GamesTab.tsx.
     * Both platforms must use these keys so wording stays in sync.
     */
    renameEmpty:    'Name cannot be empty',
    renameFailed:   'Failed to rename quiz',
    /** Dynamic toast shown when a join code is saved successfully. */
    codeUpdated:    (code: string) => `Room code updated to ${code}`,
    /** Toast shown when the clipboard write fails. */
    copyCodeFailed: "Couldn't copy code",
    /** Sub-text on the dashed empty-state tile (mobile GamesTab). */
    emptyCardSub:   'Tap to set up your first trivia game',
    /** Error state when the games list fails to load (mobile GamesTab). */
    loadFailedTitle: "Couldn't load games",
    loadFailedBody:  'Something went wrong. Check your connection and try again.',
    /** Empty state when a filter tab has no games (mobile GamesTab). */
    noneRightNow:   (what: string) => `No ${what} right now`,
    liveGamesNoun:  'live games',
    draftsNoun:     'drafts',
    /** "{n} questions" meta on game cards / pickers (mobile). Always plural. */
    questionsCount: (n: number) => `${n} questions`,
    /** "{n} player(s)" meta on completed game cards (mobile ResultsTab). */
    playersCount:   (n: number) => `${n} player${n === 1 ? '' : 's'}`,
    /** Start-game confirmation sheet (mobile GamesTab). */
    startGameTitle: 'Start game?',
    goLiveBtn:      'Go live',
    /** Per-game action chips (mobile GamesTab and game editor header). */
    startBtn:       'Start',
    liveBtn:        'Live',
    endBtn:         'End',
    resultsBtn:     'Results',
    /** Pill shown beside the header title while a game is live (mobile AdminHeader). */
    livePill:       'LIVE',
  },

  /**
   * Host play-along strings — shown on the host's live control screen (web
   * admin panel and mobile live tab) when the host is playing along with their
   * own game.  Both platforms must use these keys so wording stays in sync.
   */
  hostPlayAlong: {
    /** Button that skips the current question — records a zero-point blank answer so the host can move on. */
    skipBtn:            'Skip for now',
    /** CTA shown after answering when there are more questions to go. */
    nextQuestionBtn:    'Next question →',
    /** CTA shown after answering the last question. */
    seeResultsBtn:      'See results →',
    /** Primary CTA on the last question — ends the game instead of releasing a next question (web and mobile). */
    endGameBtn:         'End game',
    /** Shown when the host has answered every question. */
    allAnsweredMsg:     "You've answered every question! End the game when your players are done.",
    /** Shown in place of the answer form when the server already has the host's answer for the current question (e.g. the screen reloaded mid-game). */
    alreadyAnsweredMsg: 'You already answered this question — your saved answer counts.',
    /** Heading of the play-along toggle shown on every go-live screen (web and mobile). */
    playAlongLabel:     'Play along',
    /** Description beneath the play-along toggle heading. */
    playAlongDesc:      "Answer questions from this screen — you'll appear in the standings alongside your players",
    /**
     * Heading of the advance popup when there is no answer result to show — a
     * monitoring host, or a playing host whose answer the server holds without
     * feedback. When the host has just answered or skipped the released question
     * the popup shows the result instead: gameplay.feedbackCorrect /
     * gameplay.feedbackWrongHeading / results.skipped as the heading, the points line
     * (gameplay.scorePtsSuffix + gameplay.feedbackTotalLabel), any AI feedback,
     * then nextQuestionBtn / endGameBtn (web and mobile).
     */
    nextPromptTitle:    'Ready for the next question?',
    /** Secondary button on that popup — closes it without advancing; the host can reopen it from the small next-question button in the question card. */
    nextPromptDismiss:  'Not yet',
    /** Banner on the host's live screen while they look back at a question that is not the released one (web and mobile). */
    viewingEarlier:     'Viewing an earlier question',
    /** Link in that banner — jumps the view back to the released question. Same wording as gameplay.backToCurrent. */
    backToCurrent:      'Back to current question',
    /** Screen-reader label for the chevron that steps the view back one question (host live screen and player screen). */
    viewBackLabel:      'Back',
    /** Screen-reader label for the chevron that steps the view forward, up to the released question (host live screen and player screen). */
    viewForwardLabel:   'Forward',
    /** Shown when releasing the next question fails. Both platforms. */
    releaseNextError:   'Could not release the next question — please retry',
    /** Shown when the host's own play-along answer fails to submit (mobile). */
    submitAnswerError:  'Could not submit your answer — please retry',
  },

  /**
   * Run-mode choice screen — shown immediately after a host creates a game,
   * before the "Ready to Go!" success screen, on BOTH web and mobile.
   * Replaces the old "Play along" checkbox on that screen; the chosen mode
   * feeds the same host-plays-along flag the checkbox used to set.
   * Wording must be identical on both platforms — always read these keys.
   */
  runMode: {
    /** Screen title. */
    title:        'How do you want to run this game?',
    /** Subtitle beneath the title. */
    subtitle:     "Pick a mode, then continue. You can't change this once the game is live.",
    /** Label of the host-only option. */
    hostOnlyLabel: 'Host only',
    /** Description of the host-only option. */
    hostOnlyDesc:  'You run the game. Players answer on their phones.',
    /** Label of the host-and-play option. */
    hostPlayLabel: 'Host & play',
    /** Description of the host-and-play option. */
    hostPlayDesc:  "You run the game AND answer along from your own screen. You'll appear in the standings with your players.",
    /** Continue button — disabled until an option is selected. */
    continueBtn:   'Continue',
  },

  /**
   * Join-code choice step — shown after the run-mode screen and before the
   * "Ready to Go!" success screen, on BOTH web and mobile. The code input
   * starts blank — leaving it blank keeps the game's auto-assigned code;
   * a typed code is saved via the existing PATCH /games/:id.
   * Also carries a "Quiz title" field (pre-filled with the game's topic) so the
   * host can rename the quiz in the same PATCH. Blocked-content errors reuse
   * COPY.contentFilter.accessCode (code) and COPY.contentFilter.gameTopic
   * (title); an empty title reuses COPY.admin.renameEmpty.
   * Wording must be identical on both platforms — always read these keys.
   */
  joinCode: {
    /** Screen title. */
    title:        'Choose your join code',
    /** Subtitle beneath the title. */
    subtitle:     "Players type this code to join your game. Pick something they'll remember.",
    /** Label above the quiz-title input, shown above the code input. */
    titleLabel:   'Quiz title',
    /** Label above the code input. */
    inputLabel:   'Player join code',
    /** Helper text beneath the input once the host starts typing a code. */
    helper:       '8–12 letters or numbers. No spaces.',
    /** Helper text beneath the input while it is empty — names the auto-assigned code that will be kept. */
    blankHelper:  (code: string) => `Leave blank to use ${code}`,
    /** Continue button. */
    continueBtn:  'Continue',
    /** Field-level error for a code that fails the 8–12 A–Z 0–9 format. */
    invalidError: 'Use 8–12 letters and numbers only.',
    /** Field-level error when another game already uses the code (409 code_taken). */
    takenError:   "That code's taken — try another.",
  },

  /**
   * "Ready to go live" confirmation — the final screen before a host starts
   * the game, on BOTH web and mobile. Replaces the old "Ready to Go!" success
   * screen. Title and button labels are identical on both platforms; only the
   * host-and-play mode description differs (web mentions the standings).
   */
  readyToGoLive: {
    /** Screen title — identical on web and mobile. */
    title:            'Ready to go live',
    /**
     * Dynamic subtitle: `{category} — {n} questions imported from {source}.`
     * `source` is a display name, e.g. "Gemini AI" or "Open Trivia Database".
     */
    subtitle:         (category: string, count: number, source: string) =>
                        `${category} — ${count} question${count === 1 ? '' : 's'} imported from ${source}.`,
    /** Label above the join-code value in the summary row. */
    joinLabel:        'Players join with',
    /** Link that returns to the Choose-join-code step. */
    editLink:         'Edit',
    /** Link that returns to the run-mode choice step. */
    changeLink:       'Change',
    /** Host & play mode description — WEB wording. */
    hostPlayDescWeb:  "You'll answer from your own screen and appear in the standings.",
    /** Host & play mode description — MOBILE wording. */
    hostPlayDescMobile: "You'll answer from your own screen.",
    /** Host-only mode description — both platforms. */
    hostOnlyDesc:     "You won't appear in the standings.",
    /** Secondary button — opens the question list. */
    reviewBtn:        'Review questions',
    /** Primary button — starts the game. Identical on both platforms. */
    goLiveBtn:        'Go Live',
  },

  /**
   * Player gameplay strings — shown to players while they answer questions.
   * Both platforms must use these keys so wording stays in sync.
   *
   * Notes on capitalisation:
   *   • Web hint labels are wrapped in CSS `uppercase` — sentence-case values
   *     here display correctly on both platforms.
   *   • Mobile hint labels use `textTransform: 'uppercase'` in StyleSheet —
   *     same rule applies.
   *   • Web action buttons marked with ↑ use CSS `uppercase`; raw string is
   *     sentence-case so web display is unchanged.
   */
  gameplay: {
    // ── Instructional hint labels ──────────────────────────────────────────
    /** Shown above multi-select choices. */
    hintSelectAll:   'Select all that apply',
    /** Shown above ordering items before submission. */
    hintArrangeOrder: 'Drag to put in the correct order',
    /** Shown above image-recognition text input. */
    hintTypeBelow:   'Type your answer below',
    /** Shown beneath an image when its Commons licence requires attribution. */
    imageCredit:     'Image credit: {credit} · {license}',
    /** Shown inside the image-hotspot tappable area before the player taps. */
    hintTapImage:    'Tap to mark your answer',
    /**
     * Shown above the mobile matching board (two-column tap UI).
     * The web matching UI uses a dropdown and shows hintMatchBoard instead.
     */
    hintMatchPairs:  'TAP LEFT THEN RIGHT TO MATCH',
    /** Shown as helper text inside the web matching board (dropdown UI). */
    hintMatchBoard:  'Match each item on the left with its answer on the right.',

    // ── Submit / confirm buttons ───────────────────────────────────────────
    /** Write-in and image-recognition answer submit button. */
    btnLockItIn:        'Lock It In',
    /** Short-response (AI-graded) submit button. */
    btnSubmitAnswer:    'Submit answer →',
    /** Ordering question submit button. */
    btnLockInOrder:     'Lock in order →',
    /** Matching question submit button. */
    btnLockInMatches:   'Lock In Matches',
    /** Image-hotspot confirm-location button. */
    btnConfirmLocation: 'Confirm location →',

    // ── Loading / pending states ───────────────────────────────────────────
    /** Spinner label while a standard answer is being submitted. */
    pendingSubmitting: 'Submitting…',
    /** Spinner label while a short-response answer is being AI-graded. */
    pendingGrading:    'Grading with AI…',
    /**
     * Heading shown when the player is in the game but the host has not yet
     * added any questions. The screen polls automatically (10 s refetch).
     * Both platforms must use this key.
     */
    noQuestionsTitle: 'Questions loading soon',
    /**
     * Body text shown beneath noQuestionsTitle.
     * Both platforms must use this key.
     */
    noQuestionsBody:  "The host hasn't added questions yet — this page checks automatically.",

    // ── True/False button labels ───────────────────────────────────────────
    /** Label on the True button. Sentence-case; platforms apply styling. */
    tfTrue:  'True',
    /** Label on the False button. Sentence-case; platforms apply styling. */
    tfFalse: 'False',

    // ── Post-answer feedback ───────────────────────────────────────────────
    /** Shown when the player answered correctly. */
    feedbackCorrect: 'Correct!',
    /**
     * Shown when the player answered incorrectly.
     * Web: used inline, immediately followed by the points value on the same line
     *      (e.g. "Not quite — 0 pts").  The trailing em dash is intentional.
     * Mobile: used as a standalone FeedbackCard title; the trailing em dash is
     *         a known structural difference flagged for review.
     */
    feedbackWrong:   'Not quite —',
    /**
     * Standalone-heading form of feedbackWrong, without the trailing em dash.
     * Used as the wrong-answer heading of the host result popup on web
     * (NextQuestionPrompt) and mobile (admin live screen). Inline feedback
     * keeps using feedbackWrong.
     */
    feedbackWrongHeading: 'Not quite',
    /**
     * Neutral replacement for AI grader feedback. The API server substitutes
     * this for the grader's sentence whenever that sentence would reveal the
     * correct answer during an active game. Web and mobile render whatever
     * `feedback` the submit-answer response carries, so both platforms show
     * this text verbatim when the substitution happens.
     */
    feedbackNeutral: 'Your answer has been graded.',
    /**
     * "Next question" navigation button text.
     * Web button has CSS `uppercase` — sentence-case value displays correctly.
     */
    feedbackNext:       'Next →',
    /**
     * "See results" navigation button text (last question).
     * Web button has CSS `uppercase` — sentence-case value displays correctly.
     */
    feedbackSeeResults: 'See results →',
    /**
     * Suffix appended directly to the time-taken value in post-answer feedback
     * (e.g. "8.2s"). No leading space.
     */
    feedbackSecondsSuffix: 's',
    /**
     * Label preceding the player's running total in post-answer feedback
     * (e.g. "Total: 340").
     */
    feedbackTotalLabel: 'Total:',
    /** Pulsing hint shown below the question while waiting for the player to answer. */
    clockHint: "Tap your answer — the clock's ticking",
    /** Placeholder for the single-line write-in answer input. Both platforms. */
    answerPlaceholder: 'Type your answer',
    /** Placeholder for the multi-line short-response answer input (mobile). */
    answerPlaceholderMultiline: 'Your answer...',
    /** Alert title when the content filter rejects a typed answer (mobile). */
    answerRejectedTitle: 'Answer not submitted',
    /**
     * Suffix appended after the player's score in the compact gameplay header
     * (e.g. "4/10 · 150 pts"). Used on both web and mobile.
     */
    scorePtsSuffix: 'pts',

    // ── All-questions-answered state ───────────────────────────────────────
    /**
     * Heading shown when the player has answered all questions.
     * Stored in all-caps as on web (no CSS transform on that element).
     */
    allDoneTitle: "THAT'S A WRAP!",
    /** Sub-text shown while waiting for other players to finish. */
    allDoneSub:   'Watch the leaderboard — other players are still answering.',
    /**
     * Primary CTA button in the all-done state.
     * Web button has CSS `uppercase` — sentence-case value displays correctly.
     */
    allDoneViewResults: 'View results',
    /** Secondary CTA button in the all-done state (web only; mobile navigates automatically). */
    allDoneBackToLobby: 'Back to Lobby',

    // ── Skip (defer) a question ───────────────────────────────────────────────
    /** Inline button to defer the current question to the end of the queue. */
    skipBtn:          'Skip this question',
    /** Title of the player skip-confirmation dialog. */
    skipDialogTitle:  'Skip this question?',
    /** Body of the player skip-confirmation dialog. */
    skipDialogBody:   'You can come back and answer it with the Back button while the game is live.',
    /** Cancel action in the player skip dialog. */
    skipDialogGoBack:    'Go back',
    /** Confirm action in the player skip dialog. */
    skipDialogConfirm:   'Skip for now',

    // ── Moving between released questions ─────────────────────────────────
    /**
     * "Q3 of 10" indicator beside the Back/Forward chevrons on the player
     * screen (web and mobile). n is 1-based; total is the game's question count.
     */
    questionIndicator: (n: number, total: number) => `Q${n} of ${total}`,
    /** Label above a previously skipped question the player has come back to; it is answerable again. */
    skippedEarlier:    'You skipped this earlier — you can still answer it',
    /** Link shown while looking back at an earlier question when the released one is still unanswered. */
    backToCurrent:     'Back to current question',
    /** Title of the error shown when an answer cannot be submitted (toast on web, alert on mobile). */
    submitErrorTitle:  'Could not submit answer',
    /** Body of that error. */
    submitErrorBody:   'Please try again.',

    // ── Mobile answer controls ─────────────────────────────────────────────
    /** Multiple-choice confirm button ("Confirm: Paris"). */
    confirmSelected:   (choice: string) => `Confirm: ${choice}`,
    /** Multi-select confirm button ("Confirm 2 selections"). */
    confirmSelections: (n: number) => `Confirm ${n} selection${n === 1 ? '' : 's'}`,
    /** Slider submit button ("Submit: 42km"). `unit` is appended as-is (no separator). */
    submitValue:       (value: string | number, unit: string) => `Submit: ${value}${unit}`,
    /** Placeholder for the write-in input (mobile) and web answer input. */
    answerPlaceholderShort: 'Your answer…',
    /** "+{n} pts" line in post-answer feedback (mobile). */
    feedbackPointsLine: (earned: number) => `+${earned} pts`,
    /** " · 8.2s" time-taken suffix in post-answer feedback (mobile). */
    timeTakenSuffix:   (seconds: string | number) => ` · ${seconds}s`,
    /** "{n} pts" question meta line (mobile player and host screens). */
    ptsLine:           (pts: number | null | undefined) => `${pts} pts`,
    /** Leave-game confirmation (mobile). */
    leaveTitle:        'Leave game?',
    leaveBody:         "You'll lose your progress on the current question. You can rejoin with a room code.",
    leaveStay:         'Stay',
    leaveConfirm:      'Leave',
    /** Shown while the host has not yet released the next question. Both platforms. */
    waitingHostTitle:  'Waiting for the host',
    waitingHostBody:   'The next question will appear here when the host releases it.',
    /** Quiz-complete modal (mobile). */
    quizCompleteTitle: 'Quiz complete!',
    quizCompleteBody:  "You've reached the end of the game and answered all the questions in this quiz.",
  },

  /**
   * AI question generation strings — host-facing.
   * Both platforms must use these keys so wording stays in sync.
   */
  aiGenerate: {
    /** Validation error when the topic field is blank (mobile generate panel). */
    topicRequired: 'Topic is required',
    /** Validation error for the question-count field (mobile generate panel). */
    amountRange: 'Enter a number between 1 and 20',
    /** Bulk-generate dialog / sheet. Both platforms. */
    title:              'Generate Questions with AI',
    topicLabel:         'Topic',
    topicPlaceholder:   'e.g. 90s Pop Music',
    difficultyLabel:    'Difficulty',
    amountLabel:        'Number of questions (1–20)',
    generatingLong:     'Generating… this may take a moment',
    generateBtn:        'Generate',
    /** Result lines after a bulk generation (mobile). */
    addedResult:        (n: number) => `${n} question${n === 1 ? '' : 's'} added`,
    discardedResult:    (n: number) => `${n} discarded (invalid or duplicate)`,
    /** Fallback errors when the API response carries no message (mobile). */
    failed:             'Generation failed',
    formFailed:         'AI generation failed — try again',
    rateLimited:        'AI rate limit reached — wait a moment and try again.',
    requestFailed:      'Request failed',
    requestRateLimited: 'Rate limit reached — wait a moment and try again.',
    importFailed:       'Import failed',
    /**
     * Shown to the host when Gemini's built-in safety filter blocks the
     * requested topic entirely (finishReason === "SAFETY" or promptFeedback
     * blockReason set). The topic is not repeated in the message because it
     * may itself be the reason for the block.
     */
    safetyBlock: "This topic couldn't be generated — it may contain content that can't appear in a trivia game. Please try a different topic or rephrase it.",

    /**
     * Shown when EVERY question in a Gemini batch was removed by the content
     * filter before saving. Returned as HTTP 422 with code "content_filtered_all".
     * Tone is neutral — the host did nothing wrong, the AI produced the content.
     * Displayed as a destructive toast on web and as setAiError/setSetupError on mobile.
     */
    contentFilteredAll:
      "None of the questions could be saved — they contained content that can't be used in a trivia game. Please try a different topic.",

    /**
     * Shown when SOME (but not all) questions in a Gemini batch were removed
     * by the content filter. The server calls this function and embeds the
     * formatted string in the "contentFilteredMessage" field of the success
     * response body so both clients read a pre-formatted string from the API.
     * Displayed as a destructive toast on web and alongside the success count on mobile.
     */
    contentFilteredPartial: (saved: number, removed: number): string =>
      `${removed} of ${saved + removed} question${(saved + removed) === 1 ? '' : 's'} were removed because they contained content that can't be used. ${saved} question${saved === 1 ? '' : 's'} saved.`,
  },

  /**
   * Content filtering strings — shown when a user-submitted field is blocked
   * because it contains a slur or hate-speech term.
   *
   * IMPORTANT: both platforms must surface these strings from the server
   * response body (err.data.error / res.json().error), not from a raw thrown
   * error or its message property.  The server always sends the exact string
   * from this object so phrasing stays consistent across web and mobile.
   *
   * Each message tells the user their text cannot be used and to try different
   * wording.  It does NOT quote the flagged word, does NOT identify which word
   * triggered the filter, and uses neutral tone so an innocent false-positive
   * does not feel like an accusation.
   */
  contentFilter: {
    /**
     * Shown when a player's chosen display name is blocked at login.
     * Set as an inline field-level error beneath the name input — do not use
     * a toast for this case (the user needs to correct the field directly).
     */
    playerName:
      "This name can't be used here. Please choose a different name.",
    /**
     * Shown when a host's question text or answer options are blocked on
     * create or edit.  Displayed as a destructive toast on both platforms.
     */
    questionContent:
      "One or more fields contain text that can't be used in a question. Please change your wording and try again.",
    /**
     * Shown when a host's game title (topic) is blocked on create or update.
     * Displayed as a destructive toast on both platforms, and as the
     * field-level error under the title input on the join-code step.
     */
    gameTopic:
      "This game title can't be used. Please choose a different title.",
    /**
     * Shown when a host's custom player join code is blocked on game create
     * or update. Displayed wherever the host edits the code.
     */
    accessCode:
      "This join code can't be used. Please choose a different code.",
    /**
     * Shown when a player's free-text answer is blocked on submission.
     * Displayed as a destructive toast on web and an Alert on mobile.
     */
    playerAnswer:
      "This answer can't be submitted. Please try different wording.",
    /**
     * Shown when the optional free-text note in a content report is blocked.
     * Displayed inline in the report form on both platforms.
     */
    reportNote:
      "Your note contains content that can't be submitted. Please change your wording.",
  },

  /**
   * Player results-screen strings — shown after the game ends.
   * Both platforms must use these keys so wording stays in sync.
   */
  results: {
    /**
     * Page header label above the game topic.
     * Both platforms apply `textTransform: 'uppercase'` via CSS / StyleSheet,
     * so the sentence-case value here renders correctly on both.
     */
    headerLabel: 'Final Scores',
    /** Title of the collapsible question-breakdown section. */
    breakdown:   'Question-by-Question Breakdown',
    /** Player sign-out confirmation on the results screen (mobile). */
    signOutTitle:   'Sign out?',
    signOutBody:    "You'll need to rejoin with a room code to play again.",
    signOutConfirm: 'Sign out',
    signOutCancel:  'Cancel',
    /** Numbered pill at the top-left of each question card in the breakdown ("Q1", "Q2", …). */
    questionBadge: (n: number) => `Q${n}`,
    /**
     * "Your answer" label in the per-question answer detail.
     * Both platforms apply `textTransform: 'uppercase'` via CSS / StyleSheet.
     */
    yourAnswer:    'Your answer',
    /**
     * "Correct answer" label in the per-question answer detail.
     * Both platforms apply `textTransform: 'uppercase'` via CSS / StyleSheet.
     */
    correctAnswer: 'Correct answer',
    /** Shown in place of an answer detail when the player skipped a question. */
    unanswered:    "You didn't answer this question.",
    /** Status label shown in the per-question breakdown when the player skipped a question (blank answer recorded). */
    skipped:       'Skipped',
    /**
     * Primary footer action button.
     * Web: "Play again" (navigates to lobby).
     * Mobile was "Back to Lobby" — aligned to web text in this pass.
     */
    playAgain:   'Play again',
    /** Generic "back to lobby" label — used in gameplay all-done and wherever needed. */
    backToLobby: 'Back to Lobby',
    /** Loading spinner label while results fetch is in flight. */
    loadingResults: 'Loading results…',
    /** Error state message when results cannot be fetched. */
    couldNotLoad:   'Could not load results.',
    /** Retry link text in the error state. */
    tryAgain:       'Try again',
    /**
     * Bridge button shown on mobile results when the same host has another game
     * that is live or waiting. Tapping it takes the player directly into that game.
     */
    nextGameLive:   'Next game is live — join →',
    /** Sub-text under couldNotLoad (mobile). */
    loadFailedBody: 'Something went wrong fetching the game results.',
    /** "{q} question(s) · {p} player(s)" header meta (mobile). */
    headerMeta:     (questions: number, players: number) =>
                      `${questions} question${questions === 1 ? '' : 's'} · ${players} player${players === 1 ? '' : 's'}`,
    /** Host summary banner (mobile, admins only). */
    hostSummaryLabel: 'HOST SUMMARY',
    playersLabel:   'players',
    avgScoreLabel:  'avg score',
    hardestLabel:   (pct: number | null) => `hardest · ${pct}% correct`,
    /** "{correct}/{total} correct" accuracy line. */
    correctOf:      (correct: number, total: number) => `${correct}/${total} correct`,
    /** Empty leaderboard (mobile). */
    noScores:       'No scores to show yet',
    /** Tag appended after the current player's own name on the leaderboard. Both platforms. */
    youTag:         '(you)',
    /** " · 62% got it right" suffix on the per-question meta line. Both platforms. */
    gotItRightSuffix: (pct: number) => ` · ${pct}% got it right`,
    /** Share button and share-sheet text. */
    shareBtn:       'Share results',
    /** Share text when the viewer did not play. Both platforms. */
    shareFallback:  (topic: string) => `Check out the results for "${topic}" trivia!`,
    copiedTitle:    'Copied!',
    copiedBody:     'Your results were copied to the clipboard.',
    shareTitle:     'Share',
  },
  /**
   * Content reporting flow — available to players on in-game and results screens.
   * Apple App Store guideline 1.2 requires a visible report mechanism plus a
   * stated review commitment; confirmBody fulfils the commitment requirement.
   * Both platforms must use these keys — do not inline strings in screens.
   */
  report: {
    /** Label on the trigger button shown to players. */
    button: 'Report',
    /** Title of the report form dialog / modal. */
    title: 'Report content',
    /** Instructional subtitle above the reason selector. */
    subtitle: "What's the problem?",
    /** Placeholder for the optional free-text note field. */
    notePlaceholder: 'Add details (optional)',
    /** Primary submit button label. */
    submit: 'Submit report',
    /** Cancel / close button label. */
    cancel: 'Cancel',
    /** Heading shown after a successful submission. */
    confirmTitle: 'Report received',
    /**
     * Body shown after a successful submission.
     * The "24 hours" commitment is what Apple's guideline 1.2 looks for — do not remove it.
     */
    confirmBody:
      'Thank you. We review all reports and will take action within 24 hours if the content violates our guidelines.',
    /** Generic submission error shown when the server call fails. */
    submitError: 'Something went wrong submitting your report. Please try again.',
    /**
     * Reason options shown to the player in the order they appear.
     * Values correspond to the `reason` enum in the API schema.
     */
    reasons: {
      hateful:    'Hateful or offensive content',
      sexual:     'Sexual content',
      harassment: 'Harassment',
      spam:       'Spam or misleading',
      other:      'Other',
    },
  },

  /**
   * Host-initiated player removal flow.
   * Apple App Store guideline 1.2 requires the ability to block abusive users.
   * All wording here must match exactly between web and mobile — do not inline.
   */
  kick: {
    /** Label on the remove button shown beside each player in the host screen. */
    button: 'Remove',
    /** Confirmation dialog / alert title shown to the host before removing. */
    confirmTitle: 'Remove player?',
    /**
     * Confirmation body. The player name is displayed separately above this line
     * so the host can see exactly who they are removing before confirming.
     */
    confirmBody: 'will be removed from the game immediately and will not be able to rejoin.',
    /** Destructive action button in the confirmation. */
    confirmRemove: 'Remove',
    /** Cancel button in the confirmation. */
    confirmCancel: 'Cancel',
    /** Heading shown on the removed player's screen after they are kicked. */
    removedTitle: 'Removed from game',
    /** Body shown on the removed player's screen after they are kicked. */
    removedBody: 'The host has removed you from this game.',
    /** Error returned and shown when a removed player tries to rejoin the same game. */
    rejoinBlocked: 'You have been removed from this game and cannot rejoin.',
    /** Generic error shown to the host if the removal API call fails. */
    removeError: 'Could not remove player. Please try again.',
  },

  /**
   * Player join flow — all user-facing strings on the landing/code/name
   * entry screens on web (Home.tsx, Gate.tsx) and mobile (app/index.tsx).
   * Both platforms must use these keys; web wording is the canonical form
   * where the platforms previously differed.
   */
  join: {
    /** Section label above the code-entry card. Platforms apply uppercase styling. */
    heading:         'JOIN A GAME',
    /** Tagline on the welcome screen. */
    tagline:         'Enter the code. Answer fast. Take the throne.',
    /** Welcome-screen button that opens host login. Both platforms. */
    hostAGame:       'HOST A GAME',
    /** Placeholder for the game-code input. Web Home and Gate step 2; mobile step 2. */
    codePlaceholder: 'CODE',
    /** Aria-label for the code input (web). */
    codeAriaLabel:   'Game code',
    /** Label above the code tile on the Gate welcome screen (web). Styled uppercase. */
    enterRoomCode:   'ENTER ROOM CODE',
    /** Example code shown in the welcome-step preview tile (web Gate step 0). */
    codeExample:     'A1B2…',
    /** Primary CTA on the welcome step. */
    letsPlay:        'JOIN A GAME',
    /** Button on the "how it works" step (web). */
    gotIt:           'Got it →',
    /** Button on the code-entry step. */
    checkIt:         'Check it →',
    /** Pending label while code is being verified. */
    checking:        'Checking…',
    /** Button on the name-entry step (web + mobile). */
    enterLobby:      'Enter the lobby →',
    /** Pending label while the player is joining. */
    joining:         'Joining…',
    /** Heading on the name-entry step. */
    youreIn:         "You're in!",
    /** Sub-heading on the name-entry step. */
    whatsYourName:   "What's your name?",
    /** Placeholder for the display-name input. Platforms apply uppercase styling. */
    yourName:        'YOUR NAME',
    /** Heading on the code-entry step. */
    magicWord:       'Magic word?',
    /** Sub-heading on the code-entry step. */
    punchIn:         "Punch in tonight's access code.",
    /** Heading of the "how it works" screen (web Gate step 1). */
    heresDeal:       "Here's the deal",
    /** Step 1 title in the "how it works" list. */
    howStep1Title:   '1 · Enter the code',
    /** Step 1 subtitle. */
    howStep1Sub:     'Your host shares it at the door.',
    /** Step 2 title. */
    howStep2Title:   '2 · Grab a name',
    /** Step 2 subtitle. */
    howStep2Sub:     "Make it one they'll fear.",
    /** Step 3 title. */
    howStep3Title:   '3 · Go fast',
    /** Step 3 subtitle. */
    howStep3Sub:     'Speed = bonus points.',
    /** Text prompt before the admin login link. */
    hostingTonight:  'Hosting tonight?',
    /** Admin login link text. Web wording is canonical. */
    adminLink:       'Admin login →',
    /** Admin-create link text shown in the Gate footer (web). */
    createGameFree:  'Create a game free →',
    /** Aria-label for the back chevron button. */
    goBack:          'Go back',
    error: {
      /** Blank-code validation error. Web wording is canonical. */
      enterCode:       'Enter your game code',
      /** Invalid-code error. */
      wrongCode:       "That code isn't right — try again",
      /** Expired-code error; shown on code step when name submit returns 401. Web wording. */
      codeExpired:     'Code expired — please re-enter it',
      /** Game-join failure. Web wording is canonical. */
      couldNotJoin:    'Could not join game — please try again',
      /** Blank-name validation error. */
      enterName:       'Enter your display name',
      /** Name-too-long validation error. */
      nameTooLong:     'Name must be 50 characters or fewer',
      /** Unexpected server error on name or code submit. */
      somethingWrong:  'Something went wrong — please retry',
      /** Network failure on code or name submit. */
      connectionError: 'Connection error — please retry',
      /** Shown on mobile when the code belongs to an admin account. */
      adminCode:       'Use the admin app to manage games',
    },
  },

  /**
   * Host login flow — all user-facing strings on the admin sign-in screen
   * on web (AdminLogin.tsx) and mobile (app/admin-login.tsx).
   * Web wording is canonical where the platforms previously differed.
   */
  hostLogin: {
    /** Main heading on the web host-login page. */
    heading:                  'HOST LOGIN',
    /** Card heading inside the login form (web). */
    cardHeading:              'Sign In',
    /** Helper text beneath the heading (web). */
    helper:                   'Sign in with your email and password to manage your games',
    /** Main heading on the mobile host-login page. */
    mobileHeading:            'HOST SIGN IN',
    /** Helper text beneath the mobile heading. */
    mobileHelper:             'Sign in to manage your trivia games',
    /** Email field label. Platforms apply uppercase styling. */
    emailLabel:               'EMAIL',
    /** Email field placeholder (web). */
    emailPlaceholder:         'Email address',
    /** Email field placeholder (mobile). */
    mobileEmailPlaceholder:   'your@email.com',
    /** Password field label. Platforms apply uppercase styling. */
    passwordLabel:            'PASSWORD',
    /** Password field placeholder (web). */
    passwordPlaceholder:      'Password',
    /** Password field placeholder (mobile). */
    mobilePasswordPlaceholder: '••••••••',
    /** Remember-me checkbox label (web). */
    rememberMe:               'Remember me for 30 days',
    /**
     * Sign-in button label. Sentence case is canonical for both platforms.
     * Previously mobile showed all-caps 'SIGN IN'.
     */
    signInBtn:                'Sign in',
    /** Pending label while signing in (web). */
    signingIn:                'Signing in…',
    /** Back link on the web login page. */
    backToPlayer:             'Back to player login',
    /** Create-account link. */
    createAccount:            'Create account',
    /** Forgot-password link. */
    forgotPassword:           'Forgot password?',
    /** Google SSO button label (web + mobile). */
    continueWithGoogle:       'Continue with Google',
    /** Apple SSO button label (web + mobile, iOS-only on mobile). */
    continueWithApple:        'Continue with Apple',
    /** Divider text between the email form and the SSO buttons. */
    orDivider:                'or',
    /** Back button label (mobile). */
    back:                     'Back',
    /** Prompt above the create-account link (mobile). */
    noAccount:                "Don't have an account?",
    /** Create-account link (mobile). */
    createOne:                'Create one →',
    error: {
      /** Shown when email or password field is empty (web). */
      enterBoth:          'Enter your email and password',
      /** Shown when the email field is empty (mobile). */
      enterEmail:         'Enter your email address',
      /** Shown when the password field is empty (mobile). */
      enterPassword:      'Enter your password',
      /**
       * Shown on unverified-account responses. Web wording is canonical.
       * Previously mobile had a shorter, spam-folder-aware variant.
       */
      verifyEmail:        'Please verify your email address before logging in. Check your inbox for the verification link.',
      /** Shown on wrong-credentials responses. Web wording is canonical. */
      invalidCredentials: 'Invalid email or password',
      /** Shown on unexpected server errors. */
      somethingWrong:     'Something went wrong — please retry',
      /** Shown on network failure. */
      connectionError:    'Connection error — please retry',
    },
  },

  /**
   * Forgot-password and reset-code screens (mobile only).
   * The web reset flow uses a link and does not share these strings.
   */
  hostForgotPassword: {
    /** Main heading on the request-code screen. */
    heading:              'FORGOT PASSWORD',
    /** Helper text beneath the heading. */
    helper:               "Enter your email and we'll send a 6-digit reset code",
    /** Email field label. */
    emailLabel:           'EMAIL ADDRESS',
    /** Email field placeholder. */
    emailPlaceholder:     'you@example.com',
    /** Submit button while idle. */
    sendBtn:              'SEND CODE',
    /** Submit button while request is in flight. */
    sending:              'Sending…',
    /** Back button label. */
    back:                 'Back',
    /** Footer prompt on the request-code screen. */
    rememberedIt:         'Remembered it?',
    /** Footer sign-in link on the request-code screen. */
    signIn:               'Sign in →',

    /** Main heading on the enter-code + new-password screen. */
    resetHeading:         'RESET PASSWORD',
    /** Helper text beneath the reset heading. */
    resetHelper:          'Enter the 6-digit code from your email and choose a new password',
    /** Code field label. */
    codeLabel:            'RESET CODE',
    /** Code field placeholder. */
    codePlaceholder:      '6-digit code',
    /** New-password field label. */
    newPasswordLabel:     'NEW PASSWORD',
    /** New-password field placeholder. */
    newPasswordPlaceholder: '••••••••',
    /** Confirm-password field label. */
    confirmLabel:         'CONFIRM PASSWORD',
    /** Confirm-password field placeholder. */
    confirmPlaceholder:   'Repeat your password',
    /** Submit button while idle. */
    submitBtn:            'SET NEW PASSWORD',
    /** Submit button while request is in flight. */
    submitting:           'Saving…',

    error: {
      /** Email field is empty. */
      enterEmail:        'Enter your email address',
      /** Email service returned 503. */
      emailServiceDown:  'Email service unavailable — try again later',
      /** Network failure. */
      connectionError:   'Connection error — please retry',
      /** Code field is empty. */
      enterCode:         'Enter the 6-digit code from your email',
      /** Code is not exactly 6 digits. */
      codeLength:        'The code must be exactly 6 digits',
      /** New-password field is empty. */
      enterNewPassword:  'Enter your new password',
      /** Password does not meet the 8-character minimum. */
      passwordTooShort:  'Password must be at least 8 characters',
      /** Confirm-password does not match. */
      passwordsNoMatch:  'Passwords do not match',
      /** API rejected the code (wrong or expired). */
      invalidCode:       'That code is invalid or has expired — request a new one',
      /** Unexpected server error. */
      somethingWrong:    'Something went wrong — please retry',
    },
  },

  /**
   * Host leaderboard name — suffix appended to the resolved name, and the
   * generic fallback used when no name can be derived. The API server reads
   * these at name-generation time; both clients read them if they ever need
   * to display or regenerate the label. Keep them here so the wording is
   * identical everywhere.
   */
  hostName: {
    /** Appended after the resolved name (note the leading space). e.g. "Alice (Host)" */
    suffix:  ' (Host)',
    /** Used when no usable name can be derived. Suffix is NOT appended. */
    generic: 'Host',
  },

  /**
   * Account screen — display name management card.
   * Shown on both the web Account screen (trivia-game) and the mobile
   * Account tab (mobile/components/admin/RoomsTab.tsx).
   * Both platforms must use these keys so wording is identical.
   */
  account: {
    /**
     * Account screen header. Title is nav.rooms; this is the line beneath it.
     * Web AdminSettings.tsx and mobile app/admin/account.tsx.
     */
    subtitle: 'Manage your password and account.',
    /**
     * Sign-out card, shown between the change-password and danger-zone cards
     * on both platforms.
     */
    signOut: {
      sectionTitle: 'Sign out',
      description:  "You'll need to sign in again to manage your games.",
      btn:          'Sign out',
    },
    /**
     * Delete-account confirmation. Web AdminSettings.tsx dialog and mobile
     * app/admin/account.tsx alert. Both platforms must use these keys.
     */
    deleteAccount: {
      confirmTitle:    'Delete account',
      confirmBody:     'This will permanently delete your account and all your games. This cannot be undone.',
      confirmQuestion: 'Are you sure?',
      confirmCancel:   'Cancel',
      confirmAction:   'Delete my account',
      failed:          'Failed to delete account. Please try again.',
    },
    /** Network failure on the account screen (password change, deletion). Both platforms. */
    connectionError: 'Connection error — please retry.',
    /**
     * Change-password card. Web AdminSettings.tsx and mobile
     * app/admin/account.tsx. Shown only for accounts that have a password
     * (GET /api/account/profile → hasPassword). Both platforms must use these keys.
     */
    changePassword: {
      sectionTitle:        'Change password',
      description:         'Enter your current password and choose a new one (at least 8 characters).',
      currentLabel:        'Current password',
      currentPlaceholder:  'Current password',
      newLabel:            'New password',
      newPlaceholder:      'New password (min. 8 characters)',
      confirmLabel:        'Confirm new password',
      confirmPlaceholder:  'Confirm new password',
      mismatch:            'Passwords do not match.',
      submitBtn:           'Change password',
      errorCurrentRequired: 'Please enter your current password.',
      errorTooShort:       'New password must be at least 8 characters.',
      errorNoMatch:        'New passwords do not match.',
      success:             'Password changed successfully.',
    },
    /** Body text of the danger-zone card. Both platforms. */
    dangerZoneBody: 'Deleting your account is permanent and cannot be undone. Your account and all associated games will be removed immediately.',
    /** Heading of the legal-links card. Both platforms. */
    legalTitle:     'Legal',
    displayName: {
      /** Card / section heading. */
      sectionTitle:  'Display name',
      /** One-line description beneath the heading. */
      description:   'This is the name players see next to your score on the leaderboard.',
      /** Input placeholder when no display name has been set yet. */
      placeholder:   'Enter your display name',
      /** Save button label. */
      saveBtn:       'Save display name',
      /** Inline success message shown after a successful save. */
      saved:         'Display name saved.',
      /** Validation error: value is empty after trimming. */
      errorEmpty:    'Display name cannot be empty.',
      /** Validation error: value exceeds the maximum length. */
      errorTooLong:  'Display name must be 64 characters or fewer.',
      /** Validation error: content filter blocked the value. */
      errorBlocked:  'That display name is not allowed. Please choose a different one.',
      /** Generic failure (network error or unexpected server response). */
      errorFailed:   'Failed to save display name — please retry.',
      /** Label prefix for the live leaderboard-name preview shown beneath the field. */
      previewLabel:  'Players will see:',
    },
  },

  /**
   * Question editor field labels — host-facing, shown in the create/edit
   * question form and the AI generation panel. Both platforms must use
   * these keys so labels stay in sync.
   */
  questionEditor: {
    /** Create/edit dialog titles. Both platforms. */
    newTitle:  'New Question',
    editTitle: 'Edit Question',
    /** Generic choice-list buttons (multi-select uses specialist.multiSelect). Both platforms. */
    addChoice:    'Add choice',
    removeChoice: 'Remove choice',
    /** Delete-question confirmation (mobile alert). */
    deleteTitle:   'Delete Question',
    deleteBody:    'This cannot be undone.',
    deleteConfirm: 'Delete',
    deleteCancel:  'Cancel',
    /** Form validation errors shared by both platforms' validateForm. */
    validation: {
      questionTextRequired:  'Question text is required',
      addTwoChoices:         'Add at least two choices',
      selectCorrectAnswer:   'Select the correct answer',
      answerMustBeChoice:    'Correct answer must be one of the choices',
      addTwoPairs:           'Add at least two complete pairs',
      imageUrlRequired:      'Image URL is required',
      correctAnswerRequired: 'Correct answer is required',
    },
    /** Field labels and placeholders in the question form (mobile; web shares the ones marked). */
    typeLabel:                'Question type',
    questionLabel:            'Question',
    /** Both platforms. */
    questionPlaceholder:      'Type the question players will see...',
    choicesLabel:             'Choices (tap to mark correct)',
    choicePlaceholder:        (letter: string) => `Choice ${letter}`,
    correctAnswerLabel:       'Correct answer',
    tfTrue:                   'TRUE ✓',
    tfFalse:                  'FALSE ✗',
    writeInPlaceholder:       'The exact correct answer',
    alternateAnswersLabel:    'Alternate answers (comma-separated)',
    alternateAnswersPlaceholder: 'e.g. NYC, The Big Apple',
    matchingPairsLabel:       'Matching pairs',
    pairLeftPlaceholder:      'Left',
    pairRightPlaceholder:     'Right',
    /** Both platforms. */
    addPair:                  'Add pair',
    /** Both platforms. */
    imageUrlLabel:            'Image URL',
    imageUrlPlaceholder:      'https://example.com/image.jpg',
    imageAnswerPlaceholder:   'What is in the image?',
    imageAltPlaceholder:      'Alternate accepted answers',
    hotspotLabel:             'Tap image to set hotspot',
    hotspotHint:              'Enter an image URL above to set the hotspot location.',
    pointsLabel:              'Points',
    sourceLabel:              'Source (optional)',
    sourcePlaceholder:        'e.g. Wikipedia — Capital cities',
    saveQuestionBtn:          'Save Question',
    /** Fill-with-AI button. Both platforms; mobile appends the game topic. */
    fillWithAi:               'Fill with AI',
    fillWithAiTopic:          (topic: string) => `Fill with AI (${topic})`,
    generating:               'Generating…',
    /** Label for the optional fact-check source URL field. */
    factCheckUrl: 'Fact-check URL',
    /** Placeholder for the fact-check URL input. */
    factCheckUrlPlaceholder: 'https://en.wikipedia.org/wiki/…',
    /** Label for the avoid-duplicates toggle in the AI generation panel. */
    avoidDuplicates: 'Avoid duplicating existing questions',
    /** Dedicated host-built fields for specialist question types. */
    specialist: {
      ordering: {
        itemsLabel: 'Items in correct order',
        itemLabel: 'Item',
        itemPlaceholder: 'Enter an item',
        help: 'Arrange the items from first to last. This order is the correct answer.',
        addItem: 'Add item',
        removeItem: 'Remove item',
        moveUp: 'Move item up',
        moveDown: 'Move item down',
        minError: 'Add at least 3 items',
        emptyError: 'Every ordering item must be non-empty',
        uniqueError: 'Ordering items must be unique',
      },
      multiSelect: {
        choicesLabel: 'Choices',
        choiceLabel: 'Choice',
        choicePlaceholder: 'Enter a choice',
        help: 'Mark at least 2 choices as correct and leave at least 1 choice incorrect.',
        correctLabel: 'Correct',
        incorrectLabel: 'Incorrect',
        addChoice: 'Add choice',
        removeChoice: 'Remove choice',
        minError: 'Add at least 3 choices',
        emptyError: 'Every choice must be non-empty',
        uniqueError: 'Choices must be unique',
        correctnessError: 'Choose at least 2 correct choices and leave at least 1 incorrect choice',
      },
      slider: {
        settingsLabel: 'Slider settings',
        help: 'Set the numeric range, increment, unit, and accepted tolerance.',
        minLabel: 'Minimum',
        maxLabel: 'Maximum',
        stepLabel: 'Step',
        unitLabel: 'Unit',
        unitPlaceholder: 'e.g. km, %, years',
        toleranceLabel: 'Tolerance',
        answerLabel: 'Correct answer',
        rangeError: 'Minimum must be less than maximum',
        stepError: 'Step must be greater than 0',
        toleranceError: 'Tolerance must be 0 or greater',
        unitError: 'Unit is required',
        answerError: 'Correct answer must be within the minimum and maximum',
      },
      shortResponse: {
        answerLabel: 'Canonical correct answer',
        answerPlaceholder: 'Enter the ideal answer',
        rubricLabel: 'Grading rubric',
        rubricPlaceholder: 'Describe the essential facts needed for full credit',
        maxWordsLabel: 'Maximum words',
        maxWordsPlaceholder: 'e.g. 30',
        optionalLabel: 'optional',
        answerError: 'Correct answer is required',
        rubricError: 'A grading rubric is required',
        maxWordsError: 'Maximum words must be a positive integer',
      },
    },
  },

  /**
   * Host registration validation. Mobile app/admin-register.tsx; web
   * Register.tsx reuses passwordsNoMatch / passwordTooShort from
   * hostForgotPassword.error. Email / password presence is enforced by the
   * browser on web.
   */
  hostRegister: {
    /**
     * Code-entry step shown after the mobile registration form submits.
     * The server emails a 6-digit code (POST /auth/email/mobile-register);
     * the host types it here (POST /auth/email/mobile-verify) and is signed in.
     */
    verify: {
      heading:        'VERIFY YOUR EMAIL',
      /** Rendered as "{helperPrefix} {email}." */
      helperPrefix:   'Enter the 6-digit code we sent to',
      codeLabel:      'VERIFICATION CODE',
      codePlaceholder: '6-digit code',
      submitBtn:      'VERIFY EMAIL',
      submitting:     'Verifying…',
      /** Footer prompt + link that returns to the registration form. */
      wrongEmail:     'Wrong email?',
      startOver:      'Start over',
    },
    /** Form (mobile). */
    heading:         'CREATE ACCOUNT',
    helper:          'Register as a host to create and manage trivia games',
    /** Both platforms. */
    passwordPlaceholder: 'At least 8 characters',
    /** Both platforms. */
    legalPrefix:     'By creating an account you agree to our',
    legalAnd:        'and',
    submitBtn:       'CREATE ACCOUNT',
    /** Both platforms. */
    haveAccount:     'Already have an account?',
    signInLink:      'Sign in →',
    error: {
      enterPassword: 'Enter a password',
      /** Server rejected the verification code (400). */
      invalidCode:   'That code is invalid or has expired',
      /** Per-account attempt limit or IP limit hit (429). */
      tooManyAttempts: 'Too many attempts — please wait a while and try again',
    },
  },

  /**
   * Question-type display labels, keyed by the API questionType value.
   * Web Admin.tsx TYPE_META / Results.tsx and mobile BuildTab, game editor and
   * results screens. Both platforms must use these keys.
   */
  questionType: {
    multiple_choice:   'Multiple Choice',
    multi_select:      'Multi-Select',
    true_false:        'True / False',
    write_in:          'Write-In',
    short_response:    'Short Response',
    ordering:          'Ordering',
    slider:            'Slider',
    image_recognition: 'Image',
    image_hotspot:     'Image Hotspot',
    matching:          'Matching',
  },

  /**
   * Open Trivia Database category picker entries (id = OpenTDB category id).
   * Web Admin.tsx and mobile BuildTab / game editor. Both platforms.
   */
  openTdbCategories: [
    { id: 9, name: 'General Knowledge' },
    { id: 10, name: 'Books' },
    { id: 11, name: 'Film' },
    { id: 12, name: 'Music' },
    { id: 14, name: 'Television' },
    { id: 15, name: 'Video Games' },
    { id: 17, name: 'Science & Nature' },
    { id: 21, name: 'Sports' },
    { id: 22, name: 'Geography' },
    { id: 23, name: 'History' },
    { id: 25, name: 'Art' },
    { id: 26, name: 'Celebrities' },
    { id: 27, name: 'Animals' },
    { id: 28, name: 'Vehicles' },
  ],

  /**
   * Admin results screen alerts (mobile app/admin/results/[gameId].tsx and
   * live/[gameId].tsx). Web downloads the CSV directly and has no equivalent.
   */
  adminResults: {
    reviewSaveErrorTitle:    'Could not save review',
    reviewSaveErrorBody:     'Please check your connection and try again.',
    exportDialogTitle:       'Export results CSV',
    sharingUnavailableTitle: 'Sharing unavailable',
    sharingUnavailableBody:  'File sharing is not available on this device.',
    exportFailedTitle:       'Export failed',
    exportFailedBody:        'Could not export results.',
    /** Error / empty states. */
    loadFailed:              'Could not load results. Check your connection and try again.',
    backToGames:             '← Back to games',
    /** Summary card labels. */
    playersLabel:            'Players',
    avgScoreLabel:           'Avg Score',
    topScoreLabel:           'Top Score',
    hardestLabel:            (pct: number | null) => `HARDEST · ${pct}% correct`,
    leaderboardLabel:        'LEADERBOARD',
    /** "{c}/{t} correct" line under each player. */
    correctOf:               (correct: number, total: number) => `${correct}/${total} correct`,
    pctSuffix:               (pct: number) => ` · ${pct}%`,
    unansweredSuffix:        (n: number) => ` · ${n} unanswered`,
    needingReviewLabel:      (n: number) => `ANSWERS NEEDING REVIEW · ${n}`,
    /** Per-question breakdown. */
    breakdownToggle:         'Question Breakdown',
    breakdownLoadFailed:     'Could not load question breakdown.',
    correctLabel:            'correct',
    correctAnswerLabel:      'CORRECT ANSWER',
  },

  /**
   * Bullet lists on the legal / support pages that both platforms render
   * item-by-item. Web Support.tsx / Terms.tsx / Privacy.tsx and the mobile
   * support / terms / privacy screens.
   */
  legal: {
    /** "Last updated" line on the terms and privacy pages. Both platforms. */
    lastUpdated: 'Last updated: August 11, 2026',
    support: {
      tagline:      "We're here to help",
      contactTitle: 'Contact Us',
      contactBody:  'For any questions, issues, or feedback about Queen Trivia, reach out to us directly by email. We aim to respond within one business day.',
      email:        'support@queen-trivia.com',
      reportTitle:  'How to Report a Problem',
      reportBody:   "If you've encountered a bug, an unexpected error, or inappropriate content in a game, please include the following in your message so we can investigate quickly:",
      hostAccountsTitle: 'Host Accounts',
      /** Rendered as "{prefix} {email} {suffix}". */
      hostAccountsPrefix: "If you're having trouble with your host account — such as a missing verification email, a password reset that didn't arrive, or difficulty signing in — email us at",
      hostAccountsSuffix: "with your registered email address and we'll get you sorted.",
      contentTitle: 'Content Concerns',
      /** Rendered as "{prefix} {email} {suffix}". */
      contentPrefix: 'Queen Trivia includes a content filter to prevent offensive material from appearing in games. If you see something that slipped through, please report it to',
      contentSuffix: "and we'll review it promptly.",
      reportChecklist: [
        'A brief description of what happened and what you expected to happen',
        'The game code or topic name, if relevant',
        'The device and browser (or app version) you were using',
        'Any error messages you saw on screen',
      ],
    },
    terms: {
      s1Title: '1. Acceptance of Terms',
      s1Body:  'By creating an account or using Queen Trivia (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Service. These Terms apply to all hosts, players, and visitors.',
      s2Title: '2. The Service',
      s2Body:  'Queen Trivia provides a platform for creating and hosting live trivia games. Hosts create quizzes and manage game sessions; players join using a room code and participate via their device. We reserve the right to modify or discontinue the Service at any time with reasonable notice.',
      s3Title: '3. Accounts',
      accounts: [
        'You must provide a valid email address when registering and verify it before signing in.',
        'You are responsible for maintaining the confidentiality of your password and for all activity that occurs under your account.',
        'You must notify us immediately of any unauthorized use of your account.',
        'You must be at least 13 years old to create an account.',
      ],
      s4Title: '4. Acceptable Use',
      s4Intro: 'You agree not to use the Service to:',
      s5Title: '5. Content',
      s5Body:  'You retain ownership of any quiz content you create. By submitting content to the Service, you grant us a non-exclusive, royalty-free license to store, display, and deliver that content as necessary to operate the Service. You are solely responsible for ensuring your content does not infringe third-party intellectual property rights or violate applicable laws.',
      s6Title: '6. Termination',
      s6Body:  'We may suspend or terminate your account at any time for violations of these Terms or for any other reason at our discretion. You may delete your account at any time by contacting us. Provisions of these Terms that by their nature should survive termination shall survive.',
      s7Title: '7. Disclaimer of Warranties',
      s7Body:  'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.',
      s8Title: '8. Limitation of Liability',
      s8Body:  'TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.',
      s9Title: '9. Governing Law',
      s9Body:  'These Terms are governed by and construed in accordance with applicable law. Any disputes arising under these Terms shall be resolved through binding arbitration or in a court of competent jurisdiction.',
      s10Title: '10. Changes to These Terms',
      s10Body: 'We may update these Terms from time to time. We will notify registered hosts by email or in-app notice of material changes. Continued use of the Service after changes take effect constitutes acceptance of the updated Terms.',
      s11Title: '11. Contact Us',
      /** Rendered as "{prefix} {email}." */
      s11Prefix: 'Questions about these Terms? Contact us at',
      email:   'legal@queen-trivia.com',
      acceptableUse: [
        'Post or transmit content that is unlawful, harmful, threatening, abusive, defamatory, or otherwise objectionable',
        'Harass, intimidate, or discriminate against any person or group',
        'Violate any applicable law or regulation',
        'Interfere with or disrupt the integrity or performance of the Service',
        'Attempt to gain unauthorized access to any part of the Service',
        'Use automated tools to scrape, crawl, or otherwise extract data from the Service without our consent',
      ],
    },
    privacy: {
      s1Title: '1. Introduction',
      s1Body:  'Queen Trivia ("we", "us", or "our") operates the Queen Trivia mobile and web application (the "Service"). This Privacy Policy describes how we collect, use, and share information when you use our Service, and your choices regarding that information.',
      s2Title: '2. Information We Collect',
      s2Intro: 'We collect the following types of information:',
      /** Bullets rendered as "<strong>{label}</strong> {body}". */
      collect: [
        { label: 'Account information:', body: 'When you register as a host, we collect your email address and a hashed version of your password. We never store your password in plain text.' },
        { label: 'Game data:',           body: 'Quizzes, questions, and game sessions you create or participate in, including player nicknames and answers submitted during games.' },
        { label: 'Usage data:',          body: 'Basic technical information such as device type, operating system version, and error logs to help us maintain and improve the Service.' },
      ],
      s3Title: '3. How We Use Your Information',
      s3Intro: 'We use the information we collect to:',
      s4Title: '4. Information Sharing',
      s4Intro: 'We do not sell your personal information. We may share your information only in these limited circumstances:',
      sharing: [
        { label: 'Service providers:',  body: 'Third-party vendors who help us operate the Service (e.g. transactional email delivery), subject to confidentiality obligations.' },
        { label: 'Legal requirements:', body: 'When required by law or to protect the rights and safety of our users or the public.' },
      ],
      s4Note:  'Player nicknames and scores entered during a live game session are visible to other participants in that same game session.',
      s5Title: '5. Data Retention',
      s5Body:  'We retain your account information for as long as your account is active. Game session data may be retained to provide score history and analytics to hosts. You may request deletion of your account and associated data by contacting us at the address below.',
      s6Title: "6. Children's Privacy",
      s6Body:  'The Service is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us personal information, please contact us so we can delete it.',
      s7Title: '7. Security',
      s7Body:  'We take reasonable technical and organizational measures to protect your information. Passwords are stored using industry-standard one-way hashing. However, no method of transmission or storage is 100% secure, and we cannot guarantee absolute security.',
      s8Title: '8. Your Rights',
      s8Body:  'Depending on your location, you may have the right to access, correct, or delete your personal information. To exercise any of these rights, contact us at:',
      email:   'privacy@queen-trivia.com',
      s9Title: '9. Changes to This Policy',
      s9Body:  'We may update this Privacy Policy from time to time. We will notify registered hosts by email or in-app notice when we make material changes. Continued use of the Service after changes take effect constitutes acceptance of the updated policy.',
      s10Title: '10. Contact Us',
      /** Rendered as "{prefix} {email}." */
      s10Prefix: 'If you have questions about this Privacy Policy, please contact us at',
      informationUse: [
        'Provide, operate, and maintain the Service',
        'Create and manage your host account',
        'Send account-related emails (verification, password reset)',
        'Diagnose technical issues and improve the Service',
        'Comply with legal obligations',
      ],
    },
  },

  /**
   * Footer link labels — shown in the shared web Footer and the mobile
   * privacy/terms/support link rows. Both platforms must use these keys.
   */
  footer: {
    /** Link to the privacy policy page. */
    privacyPolicy:  'Privacy Policy',
    /** Link to the terms of service page. */
    termsOfService: 'Terms of Service',
    /** Link to the support page. */
    support:        'Support',
  },

  /**
   * Generic single-word actions and labels shared across many screens.
   * Prefer a screen-specific key when the wording carries extra meaning
   * (e.g. kick.confirmCancel); use these for plain buttons and chips.
   */
  common: {
    cancel:   'Cancel',
    save:     'Save',
    done:     'Done',
    retry:    'Retry',
    back:     'Back',
    edit:     'Edit',
    add:      'Add',
    close:    'Close',
    gotIt:    'Got it',
    dismiss:  'Dismiss',
    discard:  'Discard',
    apply:    'Apply',
    /** Muted "(optional)" suffix after a field label. */
    optional: '(optional)',
    /** Generic alert title. */
    error:    'Error',
  },

  /**
   * Free-tier usage limit. The API server prefixes its 429 message with
   * `title`; both clients match on it to show the limit card instead of a
   * plain error, and use `title` as the card heading.
   */
  usageLimit: {
    title:      'Monthly limit reached',
    resetsNote: 'This resets at the start of next month. You can still add questions manually in the meantime.',
  },

  /**
   * Brand wordmark. Web Brand.tsx and the mobile welcome / about screens.
   */
  brand: {
    queen:  'QUEEN',
    trivia: 'TRIVIA',
  },

  /**
   * Per-question AI tools sheet (mobile game editor).
   */
  aiTools: {
    title: 'AI Tools',
    regenerate: {
      label:   'Regenerate',
      desc:    'Replace with a new AI-written question on the same topic',
      loading: 'Generating new question…',
    },
    enhance: {
      label:   'Enhance',
      desc:    'Improve wording, fix options, add a source suggestion',
      loading: 'Enhancing question…',
    },
    factCheck: {
      label:   'Fact-Check',
      desc:    'Verify the question and correct answer with AI',
      loading: 'Fact-checking…',
    },
    applyFailed:          'Failed to apply — please retry.',
    /** Preview-card section labels. Stored upper-case as displayed. */
    newQuestionLabel:     'NEW QUESTION',
    correctAnswerLabel:   'Correct answer',
    optionsLabel:         'OPTIONS',
    improvedQuestionLabel: 'IMPROVED QUESTION',
    improvedOptionsLabel: 'IMPROVED OPTIONS',
    notesLabel:           'NOTES',
    suggestedSourceLabel: 'SUGGESTED SOURCE',
    explanationLabel:     'EXPLANATION',
    correctAnswerShouldBeLabel: 'CORRECT ANSWER SHOULD BE',
    sourceLabel:          'SOURCE',
    /** "{level} confidence" beside the fact-check verdict. */
    confidence:           (level: string) => `${level} confidence`,
  },

  /**
   * Import-from-Open-Trivia-Database sheet (mobile game editor).
   */
  openTdbImport: {
    categoryLabel:     'Category',
    selectPlaceholder: 'Select…',
    difficultyLabel:   'Difficulty',
    amountLabel:       'Number of questions (1–50)',
    amountError:       'Enter a number between 1 and 50',
    importing:         'Importing…',
    importBtn:         'Import',
    importedResult:    (n: number) => `${n} question${n === 1 ? '' : 's'} imported`,
    errorNetwork:      'No internet connection — check your network and try again.',
    errorRateLimit:    'Open Trivia DB rate limit reached — wait a few seconds and try again.',
    errorNoQuestions:  'No questions available for this combination — try a different difficulty.',
  },

  /**
   * Game editor screen (mobile app/admin/[gameId].tsx).
   */
  gameEditor: {
    /** Placeholder / aria-label of the inline quiz-title input. Both platforms. */
    quizNamePlaceholder: 'Quiz name',
    /** "{n} Question(s)" list title above the toolbar. */
    questionCountTitle: (n: number) => `${n} Question${n === 1 ? '' : 's'}`,
    aiGenerateBtn:     'AI Generate',
    /** Both platforms. */
    emptyTitle:        'No questions yet',
    addManuallyBtn:    'Add manually',
    dragHint:          'Long-press any question card to drag and reorder',
    noFilterMatch:     'No questions match this filter',
  },

  /**
   * Admin results list tab (mobile ResultsTab.tsx).
   */
  adminResultsList: {
    heading:           'Game results',
    subheading:        'Leaderboards and question analytics for completed games.',
    loadFailed:        'Could not load games. Check your connection.',
    emptyTitle:        'No completed games yet',
    emptyBody:         'Finish a game to see its leaderboard and score history here.',
    statGames:         'Games',
    statPlayerSessions: 'Player sessions',
    statQuestionsAsked: 'Questions asked',
  },

  /**
   * Host live-control screen (mobile app/admin/live/[gameId].tsx).
   */
  adminLive: {
    notFoundTitle:      'Game not found',
    notFoundBody:       'This game may have ended or is no longer available.',
    goBack:             'Go back',
    answerProgressLabel: 'ANSWER PROGRESS',
    noQuestions:        'No questions in this game.',
    answeredCount:      (n: number, total: number) => `${n}/${total} answered`,
    correctCount:       (n: number) => `${n} correct`,
    needsReviewLabel:   (n: number) => `NEEDS REVIEW · ${n}`,
    endGameBtn:         'End Game',
    endGameError:       'Failed to end the game. Please try again.',
    /** "+{earned} pts · total {total}" under the host's own answer feedback. */
    feedbackPts:        (earned: number, total: number) => `+${earned} pts · total ${total}`,
  },

  /**
   * Manual answer-review card shown when AI grading was unavailable
   * (mobile host live and admin results screens).
   */
  answerReview: {
    aiUnavailable:     'AI UNAVAILABLE',
    playerAnswerLabel: 'PLAYER ANSWER',
    rubricLabel:       'RUBRIC',
    suggested:         (earned: number, points: number) => `Suggested score: ${earned}/${points} points · awaiting your decision`,
    denyBtn:           'Deny',
    awardBtn:          (points: number) => `Award ${points} pts`,
  },

  /**
   * Crash screen (mobile ErrorFallback.tsx).
   */
  errorFallback: {
    title:        'Something went wrong',
    body:         'Please reload the app to continue.',
    tryAgain:     'Try Again',
    detailsTitle: 'Error Details',
    viewDetails:  'View error details',
    closeDetails: 'Close error details',
  },

  /**
   * Unmatched-route screen (mobile app/+not-found.tsx).
   */
  notFound: {
    title: 'Oops!',
    body:  "This screen doesn't exist.",
    link:  'Go to home screen!',
  },

  /**
   * About screen (mobile app/about.tsx).
   */
  about: {
    title:             'About',
    legalSupportLabel: 'LEGAL & SUPPORT',
    privacySub:        'How we handle your data',
    termsSub:          'Our rules and your rights',
    supportSub:        'Get help or report an issue',
  },
} as const;

/**
 * Build the player results share message.
 * Both platforms must call this so the wording stays in sync.
 * Matches the mobile format: rank, score, topic, correct count.
 */
export function buildShareText(params: {
  score: number;
  rank: number;
  playerCount: number;
  topic: string;
  correct: number;
  questions: number;
}): string {
  return `I scored ${params.score} points (#${params.rank} of ${params.playerCount}) in "${params.topic}" trivia — ${params.correct}/${params.questions} correct! 🎯`;
}
