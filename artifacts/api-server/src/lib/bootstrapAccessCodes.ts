import { randomBytes } from "node:crypto";

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
