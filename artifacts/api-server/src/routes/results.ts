
import { Router, type IRouter } from "express";
import { eq, and, sql, asc } from "drizzle-orm";
import { requireAdmin } from "../middleware/requireAdmin";
import { requireAuth } from "../middleware/requireAuth";
import {
 db,
 gamesTable,
 usersTable,
 questionsTable,
 answersTable,
 gameParticipantsTable,
} from "@workspace/db";
import { toJsonSafe } from "../lib/serialize";


const router: IRouter = Router();


// ─── GET /games/:gameId/results ────────────────────────────────────────────
// Returns leaderboard enriched with per-user correct/total counts


router.get("/games/:gameId/results", requireAuth, async (req, res): Promise<void> => {
 const gameId = parseInt(String(req.params.gameId ?? ""), 10);
 if (isNaN(gameId)) { res.status(400).json({ error: "Invalid gameId" }); return; }


 const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId));
 if (!game) { res.status(404).json({ error: "Game not found" }); return; }


 // Participants ordered by score desc
 const participants = await db
  .select({
   id: gameParticipantsTable.id,
   userId: gameParticipantsTable.userId,
   userName: usersTable.name,
   totalScore: gameParticipantsTable.totalScore,
   joinedAt: gameParticipantsTable.joinedAt,
 })
 .from(gameParticipantsTable)
 .innerJoin(usersTable, eq(gameParticipantsTable.userId, usersTable.id))
 .where(eq(gameParticipantsTable.gameId, gameId))
  .orderBy(sql`${gameParticipantsTable.totalScore} DESC`,asc(gameParticipantsTable.joinedAt));


// Aggregate correct / total per user
const answerStats = await db
 .select({
  userId: answersTable.userId,
  totalAnswered: sql<number>`count(*)::int`,
  correctCount: sql<number>`sum(case when ${answersTable.isCorrect} then 1 else 0 end)::int`,
 })
 .from(answersTable)
 .where(eq(answersTable.gameId, gameId))
 .groupBy(answersTable.userId);


const statsMap = new Map(answerStats.map((s) => [s.userId, s]));


const enriched = participants.map((p, i) => {
 const stats = statsMap.get(p.userId);
 return {
  ...p,
  rank: i + 1,
  correctCount: stats?.correctCount ?? 0,
      totalAnswered: stats?.totalAnswered ?? 0,
  };
 });


 const totalQuestions = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(questionsTable)
  .where(eq(questionsTable.gameId, gameId))
  .then((r) => r[0]?.count ?? 0);


 res.json(toJsonSafe({ game, participants: enriched, totalQuestions }));
});


// ─── GET /games/:gameId/questions/stats ────────────────────────────────────
// Per-question analytics: correct count, % who got it right (admin use)


router.get("/games/:gameId/questions/stats", requireAdmin, async (req, res):Promise<void> => {
 const gameId = parseInt(String(req.params.gameId ?? ""), 10);
 if (isNaN(gameId)) { res.status(400).json({ error: "Invalid gameId" }); return; }


 const questions = await db
  .select({
      id: questionsTable.id,
      questionText: questionsTable.questionText,
      questionType: questionsTable.questionType,
  points: questionsTable.points,
  orderIndex: questionsTable.orderIndex,
 })
 .from(questionsTable)
 .where(eq(questionsTable.gameId, gameId))
 .orderBy(asc(questionsTable.orderIndex));


const answerStats = await db
 .select({
  questionId: answersTable.questionId,
  totalAnswered: sql<number>`count(*)::int`,
  correctCount: sql<number>`sum(case when ${answersTable.isCorrect} then 1 else 0 end)::int`,
 })
 .from(answersTable)
 .where(eq(answersTable.gameId, gameId))
 .groupBy(answersTable.questionId);


const statsMap = new Map(answerStats.map((s) => [s.questionId, s]));


const result = questions.map((q) => {
 const s = statsMap.get(q.id);
 const totalAnswered = s?.totalAnswered ?? 0;
 const correctCount = s?.correctCount ?? 0;
 return {
  ...q,
      totalAnswered,
      correctCount,
  percentCorrect: totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) :null,
  };
 });


 res.json(result);
});


// ─── GET /games/:gameId/results/export.csv ─────────────────────────────────
// CSV download for admin


router.get("/games/:gameId/results/export.csv", requireAdmin, async (req, res):Promise<void> => {
 const gameId = parseInt(req.params["gameId"] as string ?? "", 10);
 if (isNaN(gameId)) { res.status(400).json({ error: "Invalid gameId" }); return; }


 const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId));
 if (!game) { res.status(404).json({ error: "Game not found" }); return; }


 const participants = await db
  .select({
      userId: gameParticipantsTable.userId,
      userName: usersTable.name,
      totalScore: gameParticipantsTable.totalScore,
  })
 .from(gameParticipantsTable)
 .innerJoin(usersTable, eq(gameParticipantsTable.userId, usersTable.id))
 .where(eq(gameParticipantsTable.gameId, gameId))
 .orderBy(sql`${gameParticipantsTable.totalScore} DESC`);


const answerStats = await db
 .select({
  userId: answersTable.userId,
  totalAnswered: sql<number>`count(*)::int`,
  correctCount: sql<number>`sum(case when ${answersTable.isCorrect} then 1 else 0 end)::int`,
 })
 .from(answersTable)
 .where(eq(answersTable.gameId, gameId))
 .groupBy(answersTable.userId);


const totalQuestions = await db
 .select({ count: sql<number>`count(*)::int` })
 .from(questionsTable)
 .where(eq(questionsTable.gameId, gameId))
 .then((r) => r[0]?.count ?? 0);


const statsMap = new Map(answerStats.map((s) => [s.userId, s]));


const escapeCsv = (v: string | number) => {
  let s = String(v);
  // Prevent CSV formula injection: prefix cells that start with a spreadsheet
  // formula trigger character with a tab so spreadsheet apps treat the value
  // as plain text (OWASP CSV Injection guidance).
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `\t${s}`;
  }
  return `"${s.replace(/"/g, '""')}"`;
};
 const header = ["Rank", "Player Name", "Total Score", "Correct", "Total Questions","Accuracy %"].map(escapeCsv).join(",");
 const rows = participants.map((p, i) => {
  const s = statsMap.get(p.userId);
  const correct = s?.correctCount ?? 0;
  const accuracy = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;
  return [i + 1, p.userName, p.totalScore, correct, totalQuestions,accuracy].map(escapeCsv).join(",");
 });


 const csv = [header, ...rows].join("\n");
 const filename = `${game.topic.replace(/[^a-z0-9]/gi, "_")}_results.csv`;


 res.setHeader("Content-Type", "text/csv");
 res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
 res.send(csv);
});


export default router;


