import { randomBytes } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import { db, adminSettingsTable } from "@workspace/db";
import { logger } from "./logger.ts";

// Historical seeded defaults that were documented publicly. If either is still
// in use, it must be rotated at boot to prevent credential reuse from docs.
const KNOWN_DEFAULT_CODES = new Set(["PLAY2026", "ADMIN2026"]);

// Unambiguous alphabet (no 0/O, 1/I/L) for codes read aloud to players.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateAccessCode(length = 10): string {
	const bytes = randomBytes(length);
	let code = "";
	for (let i = 0; i < length; i++) {
		code += ALPHABET[bytes[i]! % ALPHABET.length];
	}
	return code;
}

/**
 * Ensure the admin_settings row exists with non-default access codes.
 * - If no row exists, seed one with random codes (no documented defaults).
 * - If a row still uses the publicly documented default codes, rotate them.
 * New codes are logged once to the server console so the operator can
 * retrieve them; they are also visible in the admin Settings page.
 */
// Arbitrary but stable application-level lock key for admin_settings seeding.
const SEED_LOCK_KEY = 727_461_001;

export async function bootstrapAccessCodes(): Promise<void> {
	await db.transaction(async (tx) => {
		// Serialize concurrent instance startups (e.g. autoscale) so exactly one
		// instance seeds/rotates; the lock is released when the tx commits.
		await tx.execute(sql`SELECT pg_advisory_xact_lock(${SEED_LOCK_KEY})`);

		// Deterministic lookup: always operate on the lowest-id row.
		const [row] = await tx
			.select()
			.from(adminSettingsTable)
			.orderBy(asc(adminSettingsTable.id))
			.limit(1);

		if (!row) {
			const triviaAccessCode = generateAccessCode();
			const adminAccessCode = generateAccessCode();
			await tx
				.insert(adminSettingsTable)
				.values({ triviaAccessCode, adminAccessCode });
			logger.warn(
				{ triviaAccessCode, adminAccessCode },
				"No admin_settings row found — seeded random access codes. Record these now; they can be changed in the admin Settings page.",
			);
			return;
		}

		const updates: Partial<{
			triviaAccessCode: string;
			adminAccessCode: string;
		}> = {};
		if (KNOWN_DEFAULT_CODES.has(row.triviaAccessCode)) {
			updates.triviaAccessCode = generateAccessCode();
		}
		if (KNOWN_DEFAULT_CODES.has(row.adminAccessCode)) {
			updates.adminAccessCode = generateAccessCode();
		}
		if (Object.keys(updates).length === 0) return;

		await tx
			.update(adminSettingsTable)
			.set(updates)
			.where(eq(adminSettingsTable.id, row.id));
		logger.warn(
			updates,
			"Access codes matched publicly documented defaults and were rotated to random values. Record the new codes; they can be changed in the admin Settings page.",
		);
	});
}
