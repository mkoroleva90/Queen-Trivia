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
    rooms:   'Rooms',
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
    /** Legend label for the player's own pin on a hotspot reveal. */
    hotspotYourGuess:       'Your guess',
    /** Legend label for the correct-location pin on a hotspot reveal. */
    hotspotCorrectLocation: 'Correct location',
    /** Pulsing hint shown below the question while waiting for the player to answer. */
    clockHint: "Tap your answer — the clock's ticking",

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
  },
} as const;
