import { PASSWORD_POLICY_MESSAGE, unmetPasswordRules } from "@/lib/password-policy";

/**
 * Client checks for the organization signup form. They mirror the server (AuthService.signup and PasswordPolicy),
 * which re-validates everything. Keys match the server's field_errors names so both kinds of message share a slot.
 */

export const WORKSPACE_NAME_MIN = 2;
export const WORKSPACE_NAME_MAX = 120;

export interface SignupFormValues {
  name: string;
  email: string;
  password: string;
  organizationName: string;
  timezone: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignup(v: SignupFormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  const name = v.name.trim();
  if (!name) errors.name = "Enter your full name.";
  else if (name.length > 200) errors.name = "Use at most 200 characters.";

  const email = v.email.trim();
  if (!email) errors.email = "Enter your work email.";
  else if (!EMAIL_PATTERN.test(email)) errors.email = "Enter a valid email address.";

  const unmet = unmetPasswordRules(v.password);
  if (!v.password) errors.password = "Choose a password.";
  else if (unmet.length > 0) {
    errors.password = `${PASSWORD_POLICY_MESSAGE} Missing: ${unmet.map((r) => r.label.toLowerCase()).join(", ")}.`;
  }

  const org = v.organizationName.trim().replace(/\s+/g, " ");
  const alphanumerics = (org.match(/[\p{L}\p{Nd}]/gu) ?? []).length;
  if (!org) errors.organization_name = "Enter your organization or workspace name.";
  else if (org.length < WORKSPACE_NAME_MIN || org.length > WORKSPACE_NAME_MAX) {
    errors.organization_name = `Use ${WORKSPACE_NAME_MIN} to ${WORKSPACE_NAME_MAX} characters.`;
  } else if (alphanumerics < WORKSPACE_NAME_MIN) errors.organization_name = "Use letters or numbers in the name.";

  if (!v.timezone) errors.timezone = "Choose the workspace timezone.";
  else if (!isKnownTimezone(v.timezone)) errors.timezone = "Choose a valid timezone.";

  return errors;
}

export function isKnownTimezone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** Common workspace timezones (IANA ids, as the server stores them). */
export const WORKSPACE_TIMEZONES: readonly { value: string; label: string }[] = [
  { value: "America/New_York", label: "America/New_York (EST / EDT)" },
  { value: "America/Chicago", label: "America/Chicago (CST / CDT)" },
  { value: "America/Denver", label: "America/Denver (MST / MDT)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST / PDT)" },
  { value: "America/Sao_Paulo", label: "America/Sao_Paulo (BRT)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "Europe/London (GMT / BST)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET / CEST)" },
  { value: "Africa/Johannesburg", label: "Africa/Johannesburg (SAST)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST / AEDT)" },
];

/** The visitor's own timezone when the browser reports one; otherwise UTC. */
export function browserTimezone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && isKnownTimezone(zone) ? zone : "UTC";
  } catch {
    return "UTC";
  }
}
