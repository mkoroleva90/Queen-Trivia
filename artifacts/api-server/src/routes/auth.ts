
import { Router, type IRouter } from "express";
import { db, adminSettingsTable } from "@workspace/db";
import {
 VerifyAccessCodeBody,
VerifyAccessCodeResponse,
} from "@workspace/api-zod";
import { authRateLimit } from "../middleware/authRateLimit";


const router: IRouter = Router();


router.post("/auth/verify", authRateLimit, async (req, res): Promise<void> => {
const parsed = VerifyAccessCodeBody.safeParse(req.body);
if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
}


const [settings] = await db.select().from(adminSettingsTable).limit(1);


if (!settings) {
    res.json(VerifyAccessCodeResponse.parse({ valid: false, role: "none" }));
    return;
}


const code = parsed.data.code.trim();


if (code === settings.adminAccessCode) {
    res.json(VerifyAccessCodeResponse.parse({ valid: true, role: "admin" }));
    return;
}
 if (code === settings.triviaAccessCode) {
     res.json(VerifyAccessCodeResponse.parse({ valid: true, role: "player" }));
     return;
 }


 res.json(VerifyAccessCodeResponse.parse({ valid: false, role: "none" }));
});


export default router;


