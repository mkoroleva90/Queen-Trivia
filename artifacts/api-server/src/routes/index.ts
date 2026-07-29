
import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import sessionRouter from "./session";
import usersRouter from "./users";
import gamesRouter from "./games";
import questionsRouter from "./questions";
import playRouter from "./play";
import statsRouter from "./stats";
import settingsRouter from "./settings";
import resultsRouter from "./results";
import opentdbRouter from "./opentdb";
import geminiRouter from "./gemini";
import emailAuthRouter from "./emailAuth";


const router: IRouter = Router();
router.use(healthRouter);
router.use(authRouter);
router.use(sessionRouter);
router.use(emailAuthRouter);
router.use(settingsRouter);
router.use(usersRouter);
router.use(gamesRouter);
router.use(opentdbRouter);
router.use(geminiRouter);
router.use(questionsRouter);
router.use(playRouter);
router.use(resultsRouter);
router.use(statsRouter);


export default router;


