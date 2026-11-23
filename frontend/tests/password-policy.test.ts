import { describe, expect, it } from "vitest";

import { isPasswordAcceptable, passwordStrength, unmetPasswordRules } from "../src/lib/password-policy";

// Same cases as backend PasswordPolicyTest: the browser check must never accept what the server refuses.
describe("password policy (mirror of backend PasswordPolicy)", () => {
  it.each(["Correct-Horse-42!", "Bootstrap-Owner-Pass-7", "Aa1!aaaaaaaa"])("accepts %s", (password) => {
    expect(isPasswordAcceptable(password)).toBe(true);
  });

  it.each([
    ["Short-1!", "length"],
    ["correct-horse-battery-1!", "upper"],
    ["CORRECT-HORSE-BATTERY-1", "lower"],
    ["Correct-Horse-Battery", "digit"],
    ["CorrectHorseBattery1", "special"],
  ])("rejects %s for %s", (password, rule) => {
    expect(isPasswordAcceptable(password)).toBe(false);
    expect(unmetPasswordRules(password).map((r) => r.id)).toContain(rule);
  });

  it("rejects passwords over 200 characters", () => {
    expect(isPasswordAcceptable(`Aa1!${"x".repeat(200)}`)).toBe(false);
  });

  it("only reports good or strong when every rule is met", () => {
    expect(passwordStrength("").level).toBe("empty");
    expect(passwordStrength("abc").level).toBe("weak");
    expect(passwordStrength("Correct-Horse-42!").level).toBe("strong");
    expect(passwordStrength("Aa1!aaaaaaaa").level).toBe("good");
  });
});
