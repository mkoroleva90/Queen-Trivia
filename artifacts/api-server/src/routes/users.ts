
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
 CreateUserBody,
 CreateUserResponse,
 GetUserParams,
 GetUserResponse,
} from "@workspace/api-zod";
import { toJsonSafe } from "../lib/serialize.ts";
import { requireAdmin } from "../middleware/requireAdmin.ts";


const router: IRouter = Router();


router.post("/users", requireAdmin, async (req, res): Promise<void> => {
 const parsed = CreateUserBody.safeParse(req.body);
 if (!parsed.success) {
     res.status(400).json({ error: parsed.error.message });
     return;
 }
 const [user] = await db
     .insert(usersTable)
     .values({ name: parsed.data.name.trim() })
     .returning();


 res.status(201).json(CreateUserResponse.parse(toJsonSafe(user)));
});


router.get("/users/:userId", requireAdmin, async (req, res): Promise<void> => {
 const params = GetUserParams.safeParse(req.params);
 if (!params.success) {
     res.status(400).json({ error: params.error.message });
     return;
 }


 const [user] = await db
     .select()
     .from(usersTable)
     .where(eq(usersTable.id, params.data.userId));


 if (!user) {
     res.status(404).json({ error: "User not found" });
     return;
 }


 res.json(GetUserResponse.parse(toJsonSafe(user)));
});


export default router;


