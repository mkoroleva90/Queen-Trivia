/**
 * Access code validation — authoritative server-side rules.
 *
 * TRIVIA ACCESS CODE  — 4–6 alphanumeric characters; case-insensitive on entry.
 *   Players type this on a phone in a noisy room. Kept short and unambiguous.
 *
 * ADMIN ACCESS CODE   — 12–64 characters; spaces allowed (supports passphrases).
 *   Rejects sequential runs, repeated characters, keyboard patterns, and common
 *   passwords so the code cannot be brute-forced regardless of length.
 */

// ── Trivia code ───────────────────────────────────────────────────────────────

/**
 * Characters used when auto-generating a trivia access code.
 * Excludes visually confusable pairs: 0/O  1/I/l
 */
export const TRIVIA_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Returns null if valid, or an error string naming the field. */
export function validateTriviaCode(code: string): string | null {
  const t = code.trim();
  if (t.length < 4 || t.length > 6) {
    return "Trivia access code must be 4–6 characters.";
  }
  if (!/^[A-Za-z0-9]+$/.test(t)) {
    return "Trivia access code may only contain letters and numbers (no spaces or symbols).";
  }
  return null;
}

// ── Admin code ────────────────────────────────────────────────────────────────

/** Top common passwords / base words to reject (normalised: lower-case, no spaces). */
const COMMON_PASSWORDS = new Set([
  "password", "passw0rd", "password1", "password123", "password12",
  "letmein", "welcome", "monkey", "dragon", "master", "iloveyou",
  "sunshine", "princess", "football", "shadow", "superman", "batman",
  "michael", "jessica", "qwerty", "qwerty123", "qwertyuiop", "asdfghjkl",
  "abc123", "abcdef", "123456789", "1234567890", "trustno1",
  "access", "hello", "admin", "administrator", "changeme",
  "passphrase", "correct", "battery", "staple",
]);

const KEYBOARD_ROWS = [
  "qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890",
  // reversed
  "poiuytrewq", "lkjhgfdsa", "mnbvcxz", "0987654321",
];

function hasSequentialRun(s: string, runLen = 4): boolean {
  for (let i = 0; i <= s.length - runLen; i++) {
    let asc = true, desc = true;
    for (let j = 1; j < runLen; j++) {
      const diff = s.charCodeAt(i + j) - s.charCodeAt(i + j - 1);
      if (diff !== 1) asc = false;
      if (diff !== -1) desc = false;
      if (!asc && !desc) break;
    }
    if (asc || desc) return true;
  }
  return false;
}

function hasRepeatedChar(s: string, runLen = 3): boolean {
  for (let i = 0; i <= s.length - runLen; i++) {
    let run = true;
    for (let j = 1; j < runLen; j++) {
      if (s[i + j] !== s[i]) { run = false; break; }
    }
    if (run) return true;
  }
  return false;
}

function hasKeyboardRun(s: string, runLen = 4): boolean {
  for (const row of KEYBOARD_ROWS) {
    for (let i = 0; i <= s.length - runLen; i++) {
      const sub = s.slice(i, i + runLen);
      if (row.includes(sub)) return true;
    }
  }
  return false;
}

/** Returns null if valid, or an error string naming the field. */
export function validateAdminCode(code: string): string | null {
  if (code.length < 12) {
    return "Admin access code must be at least 12 characters.";
  }
  if (code.length > 64) {
    return "Admin access code must be at most 64 characters.";
  }

  // Strip spaces before structural checks (spaces in passphrases are fine)
  const stripped = code.toLowerCase().replace(/\s+/g, "");

  if (COMMON_PASSWORDS.has(stripped)) {
    return "Admin access code is too common. Choose a less predictable passphrase.";
  }
  if (hasSequentialRun(stripped)) {
    return "Admin access code contains a sequential run (e.g. \"abcd\" or \"1234\"). Please choose something less predictable.";
  }
  if (hasRepeatedChar(stripped)) {
    return "Admin access code contains repeated characters (e.g. \"aaa\"). Please choose something less predictable.";
  }
  if (hasKeyboardRun(stripped)) {
    return "Admin access code follows a keyboard pattern (e.g. \"qwerty\"). Please choose something less predictable.";
  }

  return null;
}

/** Whether a code looks like a bcrypt hash (already hashed). */
export function isBcryptHash(s: string): boolean {
  return s.startsWith("$2a$") || s.startsWith("$2b$") || s.startsWith("$2y$");
}
