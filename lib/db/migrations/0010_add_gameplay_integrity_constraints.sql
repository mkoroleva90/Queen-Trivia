-- Reconcile legacy duplicate submissions and participants before enforcing
-- the one-player-per-game and one-answer-per-question invariants.
BEGIN;

WITH ranked_answers AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, game_id, question_id
      ORDER BY answered_at ASC, id ASC
    ) AS duplicate_rank
  FROM answers
)
DELETE FROM answers
WHERE id IN (
  SELECT id
  FROM ranked_answers
  WHERE duplicate_rank > 1
);

UPDATE game_participants AS participant
SET total_score = COALESCE((
  SELECT SUM(answer.points_earned)::INTEGER
  FROM answers AS answer
  WHERE answer.game_id = participant.game_id
    AND answer.user_id = participant.user_id
), 0);

WITH ranked_participants AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY game_id, user_id
      ORDER BY joined_at ASC, id ASC
    ) AS duplicate_rank
  FROM game_participants
)
DELETE FROM game_participants
WHERE id IN (
  SELECT id
  FROM ranked_participants
  WHERE duplicate_rank > 1
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'game_participants_game_id_user_id_unique'
      AND conrelid = 'game_participants'::regclass
  ) THEN
    ALTER TABLE game_participants
      ADD CONSTRAINT game_participants_game_id_user_id_unique
      UNIQUE (game_id, user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'answers_user_id_game_id_question_id_unique'
      AND conrelid = 'answers'::regclass
  ) THEN
    ALTER TABLE answers
      ADD CONSTRAINT answers_user_id_game_id_question_id_unique
      UNIQUE (user_id, game_id, question_id);
  END IF;
END $$;

COMMIT;