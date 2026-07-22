
import session from "express-session";


const SESSION_SECRET = process.env["SESSION_SECRET"];
if (!SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required");
}


export const sessionMiddleware = session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
     httpOnly: true,
     secure: process.env["NODE_ENV"] === "production",
     sameSite: "lax",
     maxAge: 7 * 24 * 60 * 60 * 1000,
    },
});


