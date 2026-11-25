import { describe, expect, it } from "vitest";
import { isKnownTimezone, validateSignup } from "@/lib/signup-validation";

const valid = {
  name: "Sarah Chen",
  email: "sarah@acme.health",
  password: "Strong-Signup-Pass-1",
  organizationName: "Acme Health Technologies",
  timezone: "Asia/Kolkata",
};

describe("organization signup validation", () => {
  it("accepts a complete organization signup", () => {
    expect(validateSignup(valid)).toEqual({});
  });

  it("requires every field", () => {
    const errors = validateSignup({ name: " ", email: "", password: "", organizationName: "", timezone: "" });
    expect(Object.keys(errors).sort()).toEqual(["email", "name", "organization_name", "password", "timezone"]);
  });

  it("rejects an invalid email and a password that misses the policy", () => {
    expect(validateSignup({ ...valid, email: "not-an-email" }).email).toBeDefined();
    expect(validateSignup({ ...valid, password: "alllowercaseletters" }).password).toMatch(/Missing: .*uppercase/);
  });

  it("checks the workspace name length and content", () => {
    expect(validateSignup({ ...valid, organizationName: "A" }).organization_name).toMatch(/2 to 120/);
    expect(validateSignup({ ...valid, organizationName: "!!! ###" }).organization_name).toMatch(/letters or numbers/);
    expect(validateSignup({ ...valid, organizationName: "x".repeat(121) }).organization_name).toBeDefined();
    expect(validateSignup({ ...valid, organizationName: "  Acme   Labs  " })).toEqual({});
  });

  it("only accepts real IANA timezones", () => {
    expect(isKnownTimezone("America/New_York")).toBe(true);
    expect(validateSignup({ ...valid, timezone: "Mars/Olympus" }).timezone).toBeDefined();
  });
});
