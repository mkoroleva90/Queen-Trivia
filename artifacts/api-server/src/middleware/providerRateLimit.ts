
import rateLimit from "express-rate-limit";


/**
* Strict limit for the bulk Gemini question-generation endpoint.
* Each call may retry across multiple models and consume significant quota.
* 5 requests per 10 minutes per IP.
*/
export const geminiGenerateRateLimit = rateLimit({
 windowMs: 10 * 60 * 1000,
 limit: 5,
 standardHeaders: "draft-8",
 legacyHeaders: false,
 message: { error: "Too many generation requests. Please wait before generating again." },
});


/**
* Moderate limit for single-question Gemini operations (regenerate, enhance, fact-check).
* 20 requests per 10 minutes per IP.
*/
export const geminiOperationRateLimit = rateLimit({
 windowMs: 10 * 60 * 1000,
 limit: 20,
 standardHeaders: "draft-8",
 legacyHeaders: false,
 message: { error: "Too many AI requests. Please wait before trying again." },
});


/**
* Limit for the OpenTDB import endpoint.
* Prevents scripted upstream fetches and DB insert floods.
* 10 requests per 10 minutes per IP.
*/
export const opentdbRateLimit = rateLimit({
 windowMs: 10 * 60 * 1000,
 limit: 10,
 standardHeaders: "draft-8",
 legacyHeaders: false,
 message: { error: "Too many import requests. Please wait before importing again." },
});


