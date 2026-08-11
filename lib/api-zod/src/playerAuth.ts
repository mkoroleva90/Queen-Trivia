import * as zod from "zod";

// POST /api/auth/login
export const PlayerLoginBody = zod.object({
  code: zod.string().min(1),
  name: zod.string().max(50).optional(),
});
export type PlayerLoginBody = zod.infer<typeof PlayerLoginBody>;
