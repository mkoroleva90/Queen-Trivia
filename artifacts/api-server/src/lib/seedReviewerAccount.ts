import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  db,
  adminAccountsTable,
  gamesTable,
  questionsTable,
} from "@workspace/db";
import { logger } from "./logger.ts";

const REVIEWER_EMAIL = "reviewer@queen-trivia.com";
const REVIEWER_DISPLAY_NAME = "App Store Reviewer";
const DEMO_GAME_TOPIC = "Queen Trivia Demo";
const DEMO_ACCESS_CODE = "QTDEMO";
const DEMO_ACCESS_CODE_FALLBACK = "QTDEMO2";

// Distinct from the bootstrapAccessCodes lock (727_461_001).
const SEED_LOCK_KEY = 727_461_002;

const SAMPLE_QUESTIONS: Array<{
  questionText: string;
  correctAnswer: string;
  choices: [string, string, string, string];
  orderIndex: number;
}> = [
  {
    questionText: "What is the capital of France?",
    correctAnswer: "Paris",
    choices: ["Paris", "London", "Berlin", "Madrid"],
    orderIndex: 0,
  },
  {
    questionText: "Which planet is known as the Red Planet?",
    correctAnswer: "Mars",
    choices: ["Mars", "Venus", "Jupiter", "Saturn"],
    orderIndex: 1,
  },
  {
    questionText: "How many sides does a hexagon have?",
    correctAnswer: "6",
    choices: ["6", "5", "7", "8"],
    orderIndex: 2,
  },
  {
    questionText: "What is the chemical symbol for gold?",
    correctAnswer: "Au",
    choices: ["Au", "Ag", "Fe", "Cu"],
    orderIndex: 3,
  },
  {
    questionText: "Which ocean is the largest?",
    correctAnswer: "Pacific",
    choices: ["Pacific", "Atlantic", "Indian", "Arctic"],
    orderIndex: 4,
  },
  {
    questionText: "In what year did the first iPhone launch?",
    correctAnswer: "2007",
    choices: ["2007", "2005", "2008", "2010"],
    orderIndex: 5,
  },
];

/**
 * Insert the demo game + questions for `ownerAdminId` inside transaction `tx`.
 * Picks DEMO_ACCESS_CODE if available, falls back to DEMO_ACCESS_CODE_FALLBACK.
 */
async function insertDemoGame(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ownerAdminId: number,
): Promise<void> {
  // Check whether the preferred access code is already taken.
  const [takenCode] = await tx
    .select({ id: gamesTable.id })
    .from(gamesTable)
    .where(eq(gamesTable.accessCode, DEMO_ACCESS_CODE))
    .limit(1);

  const accessCode = takenCode ? DEMO_ACCESS_CODE_FALLBACK : DEMO_ACCESS_CODE;
  if (takenCode) {
    logger.info(
      { preferred: DEMO_ACCESS_CODE, using: accessCode },
      "QTDEMO is already taken — using fallback access code.",
    );
  }

  const [game] = await tx
    .insert(gamesTable)
    .values({
      topic: DEMO_GAME_TOPIC,
      difficulty: "easy",
      questionCount: SAMPLE_QUESTIONS.length,
      status: "waiting",
      accessCode,
      createdByAdmin: true,
      ownerAdminId,
    })
    .returning({ id: gamesTable.id });

  await tx.insert(questionsTable).values(
    SAMPLE_QUESTIONS.map((q) => ({
      gameId: game!.id,
      questionText: q.questionText,
      questionType: "multiple_choice" as const,
      correctAnswer: q.correctAnswer,
      options: { choices: q.choices } as Record<string, unknown>,
      points: 10,
      orderIndex: q.orderIndex,
    })),
  );

  logger.info(
    {
      ownerAdminId,
      gameId: game!.id,
      accessCode,
      questions: SAMPLE_QUESTIONS.length,
    },
    "Reviewer demo game seeded.",
  );
}

/**
 * Idempotent startup seed for the App Store reviewer demo account.
 *
 * Behaviour:
 *  - If REVIEWER_ACCOUNT_PASSWORD is not set, logs and returns immediately.
 *  - If the reviewer account already exists AND its demo game exists → no-op.
 *  - If the reviewer account already exists but its demo game is missing →
 *    creates the demo game for the existing account (self-healing).
 *  - Otherwise creates the account (pre-verified, no email gate), demo game,
 *    and questions — all inside a serialised transaction.
 *
 * Safe to run on every server startup.
 */
export async function seedReviewerAccount(): Promise<void> {
  const password = process.env["REVIEWER_ACCOUNT_PASSWORD"];
  if (!password) {
    logger.info(
      "REVIEWER_ACCOUNT_PASSWORD is not set — skipping reviewer account seed.",
    );
    return;
  }

  try {
    await db.transaction(async (tx) => {
      // Serialise concurrent startups so exactly one instance seeds.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${SEED_LOCK_KEY})`);

      const [existing] = await tx
        .select({ id: adminAccountsTable.id })
        .from(adminAccountsTable)
        .where(eq(adminAccountsTable.email, REVIEWER_EMAIL))
        .limit(1);

      if (existing) {
        // Account exists — check whether the demo game is also present.
        const [existingGame] = await tx
          .select({ id: gamesTable.id })
          .from(gamesTable)
          .where(eq(gamesTable.ownerAdminId, existing.id))
          .limit(1);

        if (existingGame) {
          logger.info(
            { email: REVIEWER_EMAIL },
            "Reviewer account and demo game already exist — seed skipped.",
          );
          return;
        }

        // Account exists but game was deleted — recreate just the game.
        logger.info(
          { email: REVIEWER_EMAIL },
          "Reviewer account exists but demo game is missing — recreating game.",
        );
        await insertDemoGame(tx, existing.id);
        return;
      }

      // Fresh install: create account + game together.
      const passwordHash = await bcrypt.hash(password, 12);
      const [account] = await tx
        .insert(adminAccountsTable)
        .values({
          email: REVIEWER_EMAIL,
          passwordHash,
          // emailVerified: true bypasses the email-verification gate in the
          // login route so the reviewer can log in with just email + password.
          emailVerified: true,
          displayName: REVIEWER_DISPLAY_NAME,
        })
        .returning({ id: adminAccountsTable.id });

      await insertDemoGame(tx, account!.id);

      logger.info(
        { email: REVIEWER_EMAIL },
        "Reviewer account seeded successfully.",
      );
    });
  } catch (err) {
    // Log but do not re-throw — a seed failure must never prevent the server
    // from starting and serving real traffic.
    logger.error({ err }, "seedReviewerAccount failed — server will still start.");
  }
}
