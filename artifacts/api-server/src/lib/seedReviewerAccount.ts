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
 * Idempotent startup seed for the App Store reviewer demo account.
 *
 * Behaviour:
 *  - If REVIEWER_ACCOUNT_PASSWORD is not set, logs and returns immediately.
 *  - If the reviewer account already exists, returns immediately (no-op).
 *  - Otherwise creates the account (pre-verified, no email gate), one sample
 *    game, and six questions — all inside a serialised transaction so
 *    concurrent cold-start replicas cannot double-create.
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
      // Serialise concurrent startups (e.g. rolling deploy with multiple
      // instances) so exactly one creates the account.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${SEED_LOCK_KEY})`);

      const [existing] = await tx
        .select({ id: adminAccountsTable.id })
        .from(adminAccountsTable)
        .where(eq(adminAccountsTable.email, REVIEWER_EMAIL))
        .limit(1);

      if (existing) {
        logger.info(
          { email: REVIEWER_EMAIL },
          "Reviewer account already exists — seed skipped.",
        );
        return;
      }

      // Create pre-verified account — emailVerified: true bypasses the
      // email-verification gate in the login route so the reviewer can log
      // in immediately with just email + password.
      const passwordHash = await bcrypt.hash(password, 12);
      const [account] = await tx
        .insert(adminAccountsTable)
        .values({
          email: REVIEWER_EMAIL,
          passwordHash,
          emailVerified: true,
          displayName: REVIEWER_DISPLAY_NAME,
        })
        .returning({ id: adminAccountsTable.id });

      // Create the sample game.
      const [game] = await tx
        .insert(gamesTable)
        .values({
          topic: DEMO_GAME_TOPIC,
          difficulty: "easy",
          questionCount: SAMPLE_QUESTIONS.length,
          status: "waiting",
          accessCode: DEMO_ACCESS_CODE,
          createdByAdmin: true,
          ownerAdminId: account!.id,
        })
        .returning({ id: gamesTable.id });

      // Insert all questions in one batch.
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
          email: REVIEWER_EMAIL,
          gameId: game!.id,
          accessCode: DEMO_ACCESS_CODE,
          questions: SAMPLE_QUESTIONS.length,
        },
        "Reviewer account seeded successfully.",
      );
    });
  } catch (err) {
    // Log but do not re-throw — a seed failure must never prevent the server
    // from starting and serving real traffic.
    logger.error({ err }, "seedReviewerAccount failed — server will still start.");
  }
}
