
import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import {
 CreateUserBody,
 CreateUserResponse,
} from "@workspace/api-zod";
import { toJsonSafe } from "../lib/serialize.ts";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import { containsBannedContent, logFlaggedContent } from "../lib/contentFilter.ts";
import { COPY } from "@workspace/copy";


const router: IRouter = Router();


router.post("/users", requireAdmin, async (req, res): Promise<void> => {
 const parsed = CreateUserBody.safeParse(req.body);
 if (!parsed.success) {
     res.status(400).json({ error: parsed.error.message });
     return;
 }

 // Content filter: block slurs/hate speech in player display names before saving.
 if (containsBannedContent(parsed.data.name)) {
     logFlaggedContent('player_name_admin');
     res.status(422).json({ error: COPY.contentFilter.playerName, code: "content_filtered" });
     return;
 }

 const [user] = await db
     .insert(usersTable)
     .values({ name: parsed.data.name.trim() })
     .returning();


 res.status(201).json(CreateUserResponse.parse(toJsonSafe(user)));
});


export default router;


