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
    admin:  'Admin access code',
    /** Card / section heading */
    sectionTitle: 'Access codes',
    /** Description shown under the section heading */
    description:
      'Players use the trivia access code to join games. ' +
      'Both codes must be at least 8 characters and must differ from each other.',
    /** Validation errors */
    validationTrivia: 'Trivia access code must be at least 8 characters',
    validationAdmin:  'Admin access code must be at least 8 characters',
    validationSame:   'Trivia access code and admin access code must be different',
  },

  /** Question-source labels. */
  source: {
    /** Always use this exact string — never "OpenTDB" */
    openTriviaDatabase: 'Open Trivia Database',
    ai:                 'AI Generated',
    manual:             'Manual',
  },

  /** Helper text shown under source-specific input fields. */
  sourceHelper: {
    /** Shown under the "Topic" field that feeds Gemini AI generation. */
    topic:    'Gemini AI generates questions based on this topic.',
    /** Shown under the "Category" field that feeds Open Trivia Database import. */
    category: 'Questions are pulled from Open Trivia Database.',
  },

  /** Common button labels. */
  btn: {
    newGame:       'New game',
    createGame:    'Create game',
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
    results: 'Results',
    rooms:   'Account',
  },

  /**
   * Admin games-list strings — host-facing labels on the games list screen
   * (web Admin.tsx GamesView and mobile GamesTab.tsx).
   * Both platforms must use these keys so wording stays in sync.
   */
  admin: {
    /** Label for the filter tab that shows all games regardless of status. */
    filterAll: 'All',
  },

  /**
   * Host play-along strings — shown on the host's live control screen (web
   * admin panel and mobile live tab) when the host is playing along with their
   * own game.  Both platforms must use these keys so wording stays in sync.
   */
  hostPlayAlong: {
    /** Inline button that opens the skip-confirmation dialog. */
    skipBtn:          'Skip this question',
    /** Title line of the skip-confirmation dialog. */
    skipDialogTitle:  'Skip this question?',
    /** Body paragraph of the skip-confirmation dialog. */
    skipDialogBody:   "You haven't answered this question yet. If you continue, it will be counted as not answered and scored as 0 points.",
    /** "Cancel" action in the skip dialog — keeps the host on the question. */
    skipDialogGoBack: 'Go back',
    /** "Confirm skip" action in the skip dialog. */
    skipDialogSkip:   'Skip anyway',
    /** Label shown above multiple-choice options before the host has answered. */
    yourAnswerPrompt: 'YOUR ANSWER — select a choice below',
    /** Short badge shown when the host hasn't yet answered the current question. */
    unansweredBadge:  "You haven't answered this question yet",
    /** Heading of the play-along toggle shown on every go-live screen (web and mobile). */
    playAlongLabel:   'Play along',
    /** Description beneath the play-along toggle heading. */
    playAlongDesc:    "Answer questions from this screen — you'll appear in the standings alongside your players",
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
   * "Ready to Go!" success screen, on BOTH web and mobile. Pre-filled with the
   * game's auto-assigned code; saved via the existing PATCH /games/:id.
   * Blocked-content errors reuse COPY.contentFilter.accessCode.
   * Wording must be identical on both platforms — always read these keys.
   */
  joinCode: {
    /** Screen title. */
    title:        'Choose your join code',
    /** Subtitle beneath the title. */
    subtitle:     "Players type this code to join your game. Pick something they'll remember.",
    /** Label above the code input. */
    inputLabel:   'Player join code',
    /** Helper text beneath the input. */
    helper:       '4–12 letters or numbers. No spaces.',
    /** Continue button. */
    continueBtn:  'Continue',
    /** Field-level error for a code that fails the 4–12 A–Z 0–9 format. */
    invalidError: 'Use 4–12 letters and numbers only.',
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
   * First-run reassurance banner on the live control screen — shown only when
   * the host chose "Host & play", dismissible, and persisted per host so it
   * never reappears once dismissed. Both platforms read this key.
   */
  liveBanner: {
    /** Banner text. */
    text: "Your questions appear right here once you're live.",
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
    skipDialogBody:   'This question will move to the end. You can come back and answer it after the others.',
    /** Cancel action in the player skip dialog. */
    skipDialogGoBack:    'Go back',
    /** Confirm action in the player skip dialog. */
    skipDialogConfirm:   'Skip for now',
  },

  /**
   * AI question generation strings — host-facing.
   * Both platforms must use these keys so wording stays in sync.
   */
  aiGenerate: {
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
     * Displayed as a destructive toast on both platforms.
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
   * Question editor field labels — host-facing, shown in the create/edit
   * question form and the AI generation panel. Both platforms must use
   * these keys so labels stay in sync.
   */
  questionEditor: {
    /** Label for the optional fact-check source URL field. */
    factCheckUrl: 'Fact-check URL',
    /** Placeholder for the fact-check URL input. */
    factCheckUrlPlaceholder: 'https://en.wikipedia.org/wiki/…',
    /** Label for the avoid-duplicates toggle in the AI generation panel. */
    avoidDuplicates: 'Avoid duplicating existing questions',
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
