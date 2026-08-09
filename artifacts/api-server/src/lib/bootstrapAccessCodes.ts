import { randomBytes } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, adminSettingsTable } from "@workspace/db";
import { logger } from "./logger.ts";
import { isBcryptHash } from "./accessCodeValidation.ts";

// Unambiguous alphabet for access codes (no 0/O, 1/I/L).
const GAME_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Generate a random per-game access code.
 * Uses an unambiguous alphabet (no 0/O, 1/I/L) that reads clearly aloud.
 */
export function generateGameCode(length = 6): string {
	const bytes = randomBytes(length);
	let code = "";
	for (let i = 0; i < length; i++) {
		code += GAME_CODE_ALPHABET[bytes[i]! % GAME_CODE_ALPHABET.length];
	}
	return code;
}

/** @deprecated Use generateGameCode instead */
export const generateTriviaCode = generateGameCode;

/**
 * Generate a random admin access code (plaintext).
 * 20 characters from a wide alphabet — well above the 12-char minimum and
 * free of sequential runs that would fail the strength check.
 * The caller is responsible for hashing this before storing.
 */
export function generateAdminCodePlaintext(length = 20): string {
	// Wider alphabet including lower-case + digits for entropy
	const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
	const bytes = randomBytes(length * 2); // extra bytes so rejection-sampling is safe
	let code = "";
	for (let i = 0; i < bytes.length && code.length < length; i++) {
		const ch = alphabet[bytes[i]! % alphabet.length]!;
		// Avoid 3-in-a-row repeats during generation
		if (code.length >= 2 && code[code.length - 1] === ch && code[code.length - 2] === ch) {
			continue;
		}
		code += ch;
	}
	return code;
}

// Arbitrary but stable application-level lock key for admin_settings seeding.
const SEED_LOCK_KEY = 727_461_001;

/**
 * Ensure the admin_settings row exists with a properly secured admin access code.
 *
 * - If no row exists, seed one with a random admin code; log the plaintext so
 *   the operator can record it before the plaintext is discarded.
 * - If the admin code is NOT a bcrypt hash (i.e. was stored in plain text
 *   before this hardening), rotate it and hash the replacement.
 */
export async function bootstrapAccessCodes(): Promise<void> {
	await db.transaction(async (tx) => {
		// Serialize concurrent instance startups so exactly one instance
		// seeds/rotates; the lock is released when the tx commits.
		await tx.execute(sql`SELECT pg_advisory_xact_lock(${SEED_LOCK_KEY})`);

		const [row] = await tx
			.select()
			.from(adminSettingsTable)
			.orderBy(asc(adminSettingsTable.id))
			.limit(1);

		if (!row) {
			// ── Fresh install ───────────────────────────────────────────────────
			const adminPlaintext = generateAdminCodePlaintext();
			const adminAccessCode = await bcrypt.hash(adminPlaintext, 12);
			await tx.insert(adminSettingsTable).values({ adminAccessCode });
			logger.warn(
				{ adminAccessCode: "[hashed — see plaintext below]", adminPlaintext },
				"No admin_settings row found — seeded random admin access code. " +
					"Record the admin plaintext NOW; the plaintext " +
					"will not be stored and cannot be recovered later.",
			);
			return;
		}

		const updates: Partial<{ adminAccessCode: string }> = {};
		let logPayload: Record<string, string> = {};

		// ── Admin code: migrate plain-text to bcrypt hash ──────────────────────
		if (!isBcryptHash(row.adminAccessCode)) {
			const adminPlaintext = generateAdminCodePlaintext();
			updates.adminAccessCode = await bcrypt.hash(adminPlaintext, 12);
			logPayload["adminPlaintext"] = adminPlaintext;
			logPayload["note"] =
				"Admin access code was stored in plain text and has been rotated + hashed. " +
				"Record the new plaintext above; it will not be stored.";
		}

		if (Object.keys(updates).length === 0) return;

		await tx
			.update(adminSettingsTable)
			.set(updates)
			.where(eq(adminSettingsTable.id, row.id));

		logger.warn(
			logPayload,
			"Access code(s) rotated during bootstrap. Record any plaintext values now.",
		);
	});
}
