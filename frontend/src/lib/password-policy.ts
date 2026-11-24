/**
 * Mirrors the backend PasswordPolicy for instant feedback only. The server re-validates every password.
 */
export interface PasswordRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: "12 to 200 characters", test: (p) => p.length >= 12 && p.length <= 200 },
  { id: "upper", label: "An uppercase letter", test: (p) => /\p{Lu}/u.test(p) },
  { id: "lower", label: "A lowercase letter", test: (p) => /\p{Ll}/u.test(p) },
  { id: "digit", label: "A number", test: (p) => /\p{Nd}/u.test(p) },
  { id: "special", label: "A special character", test: (p) => /[^\p{L}\p{Nd}]/u.test(p) },
];

export function unmetPasswordRules(password: string): PasswordRule[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(password));
}

export function isPasswordAcceptable(password: string): boolean {
  return unmetPasswordRules(password).length === 0;
}

export type PasswordStrength = "empty" | "weak" | "fair" | "good" | "strong";

/** Strength for the meter: rules met, plus a bonus for length beyond the minimum. */
export function passwordStrength(password: string): { level: PasswordStrength; score: number } {
  if (!password) return { level: "empty", score: 0 };
  const met = PASSWORD_RULES.length - unmetPasswordRules(password).length;
  const score = met + (password.length >= 16 ? 1 : 0); // 0..6
  if (met < PASSWORD_RULES.length) return { level: met <= 2 ? "weak" : "fair", score };
  return { level: score >= 6 ? "strong" : "good", score };
}
