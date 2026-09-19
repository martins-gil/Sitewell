import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;

export type PasswordProblem = "TOO_SHORT" | "TOO_LONG" | "CONTAINS_EMAIL" | "REPEATED";

/**
 * The rules for a new password: long rather than complicated (12+ characters),
 * and not something trivially guessable from the account itself. Returns a
 * code (the caller turns it into a translated message) or null if it's fine.
 */
export function checkNewPassword(password: string, email: string): PasswordProblem | null {
  if (password.length < MIN_PASSWORD_LENGTH) return "TOO_SHORT";
  if (password.length > MAX_PASSWORD_LENGTH) return "TOO_LONG";
  const lower = password.toLowerCase();
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (lower === email.toLowerCase() || (local.length >= 4 && lower.includes(local))) return "CONTAINS_EMAIL";
  if (/^(.)\1+$/.test(password)) return "REPEATED";
  return null;
}

// A real bcrypt hash to compare against when the email doesn't exist, so an
// unknown account takes as long to reject as a wrong password (no timing tell).
let dummyHash: Promise<string> | null = null;
export function spendPasswordCheckTime(password: string): Promise<boolean> {
  dummyHash ??= hashPassword("not-a-real-account-password");
  return dummyHash.then((hash) => verifyPassword(password, hash));
}
