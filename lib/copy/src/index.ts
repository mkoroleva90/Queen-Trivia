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
    yourAnswerPrompt: 'YOUR ANSWER — tap a choice below',
  },
} as const;
