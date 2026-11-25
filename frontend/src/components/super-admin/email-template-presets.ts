/**
 * Built-in starting points for the "New Template" dialog. Picking one only fills the editor; nothing is stored
 * until the admin clicks Save, and nothing here is ever inserted automatically.
 *
 * The server stores templates as structured parts (subject, headline, body paragraphs, CTA). `html` and `text` are
 * built from the same parts so the preset reads the same in an HTML mail client and a plain-text one. They use only
 * the placeholders in PRESET_VARIABLES; no scripts, no external assets, inline styles only.
 */
import type { EmailBannerColor, EmailTemplateCategory } from "@/app/(platform)/super-admin/_types";

export const PRESET_VARIABLES = [
  "userName",
  "userEmail",
  "organizationName",
  "organizationOwner",
  "operatorName",
  "invitationLink",
  "verificationLink",
  "resetPasswordLink",
  "planName",
  "subscriptionId",
  "invoiceNumber",
  "invoiceAmount",
  "dueDate",
  "supportEmail",
  "platformName",
  "currentYear",
] as const;

export interface EmailTemplatePreset {
  /** Stable id of the preset (not a server id). */
  id: string;
  name: string;
  /** Suggested template key (the server lower-cases it). */
  key: string;
  /** Suggested display code. */
  code: string;
  category: EmailTemplateCategory;
  bannerColor: EmailBannerColor;
  headerBadge: string;
  triggerDescription: string;
  subject: string;
  headline: string;
  paragraphs: string[];
  ctaLabel: string | null;
  ctaUrl: string | null;
  /** Inline-styled HTML body built from the parts above. */
  html: string;
  /** Plain-text alternative built from the parts above. */
  text: string;
}

type PresetDef = Omit<EmailTemplatePreset, "html" | "text">;

const ACCENT: Record<EmailBannerColor, string> = {
  indigo: "#4338ca",
  sky: "#0284c7",
  emerald: "#047857",
  violet: "#6d28d9",
  rose: "#be123c",
  amber: "#c2410c",
  slate: "#334155",
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderHtml(def: PresetDef): string {
  const accent = ACCENT[def.bannerColor];
  const paragraphs = def.paragraphs
    .map((p) => `<p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:#334155;">${escapeHtml(p)}</p>`)
    .join("");
  const cta =
    def.ctaLabel && def.ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px 0;"><tr><td style="border-radius:8px;background:${accent};">` +
        `<a href="${escapeHtml(def.ctaUrl)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(def.ctaLabel)}</a>` +
        `</td></tr></table>` +
        `<p style="margin:0 0 16px 0;font-size:12px;line-height:18px;color:#64748b;">If the button does not work, copy this link into your browser: ${escapeHtml(def.ctaUrl)}</p>`
      : "";
  return (
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(def.subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;"><tr><td align="center">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">` +
    `<tr><td style="background:${accent};padding:18px 28px;color:#ffffff;">` +
    `<span style="font-size:16px;font-weight:700;">{{platformName}}</span>` +
    `<span style="float:right;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;background:rgba(255,255,255,0.2);padding:4px 10px;border-radius:999px;">${escapeHtml(def.headerBadge)}</span>` +
    `</td></tr>` +
    `<tr><td style="padding:32px 28px 8px 28px;">` +
    `<h1 style="margin:0 0 20px 0;font-size:22px;line-height:30px;color:#0f172a;">${escapeHtml(def.headline)}</h1>` +
    paragraphs +
    cta +
    `</td></tr>` +
    `<tr><td style="padding:20px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;font-size:12px;line-height:18px;color:#64748b;">` +
    `Questions? Contact us at <a href="mailto:{{supportEmail}}" style="color:${accent};">{{supportEmail}}</a>.<br>` +
    `&copy; {{currentYear}} {{platformName}}. All rights reserved.` +
    `</td></tr></table></td></tr></table></body></html>`
  );
}

function renderText(def: PresetDef): string {
  const lines = [def.headline, "", ...def.paragraphs.flatMap((p) => [p, ""])];
  if (def.ctaLabel && def.ctaUrl) lines.push(`${def.ctaLabel}: ${def.ctaUrl}`, "");
  lines.push("Questions? Contact us at {{supportEmail}}.", "(c) {{currentYear}} {{platformName}}");
  return lines.join("\n");
}

function preset(def: PresetDef): EmailTemplatePreset {
  return { ...def, html: renderHtml(def), text: renderText(def) };
}

export const EMAIL_TEMPLATE_PRESETS: EmailTemplatePreset[] = [
  preset({
    id: "welcome",
    name: "Welcome",
    key: "welcome",
    code: "TPL-WELCOME",
    category: "AUTH",
    bannerColor: "indigo",
    headerBadge: "Account Ready",
    triggerDescription: "Sent when a new user account is created.",
    subject: "Welcome to {{platformName}}, {{userName}}",
    headline: "Welcome aboard, {{userName}}",
    paragraphs: [
      "Your {{platformName}} account for {{organizationName}} is ready. You can now plan projects, track delivery and keep your team aligned in one place.",
      "You signed up with {{userEmail}}. Use this address to sign in.",
    ],
    ctaLabel: null,
    ctaUrl: null,
  }),
  preset({
    id: "account-verification",
    name: "Account verification",
    key: "account_verification",
    code: "TPL-VERIFY",
    category: "AUTH",
    bannerColor: "indigo",
    headerBadge: "Verify Email",
    triggerDescription: "Sent when a user must confirm their email address.",
    subject: "Verify your email address for {{platformName}}",
    headline: "Confirm your email address",
    paragraphs: [
      "Hi {{userName}}, please confirm that {{userEmail}} belongs to you so we can activate your account.",
      "If you did not create an account, you can ignore this email.",
    ],
    ctaLabel: "Verify email address",
    ctaUrl: "{{verificationLink}}",
  }),
  preset({
    id: "password-reset",
    name: "Password reset",
    key: "password_reset",
    code: "TPL-PWD-RESET",
    category: "AUTH",
    bannerColor: "indigo",
    headerBadge: "Password Reset",
    triggerDescription: "Sent when a user asks to reset their password.",
    subject: "Reset your {{platformName}} password",
    headline: "Reset your password",
    paragraphs: [
      "Hi {{userName}}, we received a request to reset the password for {{userEmail}}.",
      "The link below can be used once and expires soon. If you did not ask for a reset, ignore this email; your password stays the same.",
    ],
    ctaLabel: "Choose a new password",
    ctaUrl: "{{resetPasswordLink}}",
  }),
  preset({
    id: "password-changed",
    name: "Password changed",
    key: "password_changed",
    code: "TPL-PWD-CHANGED",
    category: "SECURITY",
    bannerColor: "emerald",
    headerBadge: "Security",
    triggerDescription: "Sent after a user's password has been changed.",
    subject: "Your {{platformName}} password was changed",
    headline: "Your password was changed",
    paragraphs: [
      "Hi {{userName}}, the password for {{userEmail}} was just changed.",
      "If you made this change, no action is needed. If you did not, contact {{supportEmail}} immediately so we can secure your account.",
    ],
    ctaLabel: null,
    ctaUrl: null,
  }),
  preset({
    id: "operator-invitation",
    name: "Operator invitation",
    key: "operator_invitation",
    code: "TPL-OP-INVITE",
    category: "AUTH",
    bannerColor: "indigo",
    headerBadge: "Invitation",
    triggerDescription: "Sent when a platform operator is invited.",
    subject: "You have been invited to operate {{platformName}}",
    headline: "Join the {{platformName}} operations team",
    paragraphs: [
      "Hi {{operatorName}}, you have been invited to join {{platformName}} as a platform operator.",
      "Sign in with your email and the temporary password in this email; you will choose your own password at first sign-in. The temporary password works once and expires after 72 hours.",
    ],
    ctaLabel: "Sign in to ProWise",
    ctaUrl: "{{invitationLink}}",
  }),
  preset({
    id: "operator-activation",
    name: "Operator activation",
    key: "operator_activation",
    code: "TPL-OP-ACTIVE",
    category: "AUTH",
    bannerColor: "indigo",
    headerBadge: "Account Active",
    triggerDescription: "Sent when a platform operator account is activated.",
    subject: "Your {{platformName}} operator account is active",
    headline: "Your operator account is active",
    paragraphs: [
      "Hi {{operatorName}}, your operator account on {{platformName}} is now active.",
      "Sign in with {{userEmail}} to get started. Access is limited to the permissions your department grants.",
    ],
    ctaLabel: null,
    ctaUrl: null,
  }),
  preset({
    id: "organization-invitation",
    name: "Organization invitation",
    key: "organization_invitation",
    code: "TPL-ORG-INVITE",
    category: "AUTH",
    bannerColor: "indigo",
    headerBadge: "Invitation",
    triggerDescription: "Sent when a user is invited to an organization.",
    subject: "{{organizationOwner}} invited you to {{organizationName}}",
    headline: "You are invited to {{organizationName}}",
    paragraphs: [
      "Hi {{userName}}, {{organizationOwner}} has invited you to join {{organizationName}} on {{platformName}}.",
      "Accept the invitation to create your account and see the projects shared with you.",
    ],
    ctaLabel: "Accept invitation",
    ctaUrl: "{{invitationLink}}",
  }),
  preset({
    id: "organization-created",
    name: "Organization created",
    key: "organization_created",
    code: "TPL-ORG-CREATED",
    category: "ANNOUNCEMENTS",
    bannerColor: "slate",
    headerBadge: "Workspace Ready",
    triggerDescription: "Sent to the owner when a new organization is created.",
    subject: "{{organizationName}} is ready on {{platformName}}",
    headline: "Your organization is ready",
    paragraphs: [
      "Hi {{organizationOwner}}, the organization {{organizationName}} has been created on {{platformName}}.",
      "Invite your team, set up your first project and choose how work is tracked.",
    ],
    ctaLabel: null,
    ctaUrl: null,
  }),
  preset({
    id: "subscription-activated",
    name: "Subscription activated",
    key: "subscription_activated",
    code: "TPL-SUB-ACTIVE",
    category: "BILLING",
    bannerColor: "violet",
    headerBadge: "Subscription",
    triggerDescription: "Sent when a subscription becomes active.",
    subject: "Your {{planName}} subscription is active",
    headline: "Subscription activated",
    paragraphs: [
      "Hi {{organizationOwner}}, the {{planName}} plan is now active for {{organizationName}}.",
      "Subscription reference: {{subscriptionId}}.",
    ],
    ctaLabel: null,
    ctaUrl: null,
  }),
  preset({
    id: "subscription-renewed",
    name: "Subscription renewed",
    key: "subscription_renewed",
    code: "TPL-SUB-RENEWED",
    category: "RENEWAL",
    bannerColor: "amber",
    headerBadge: "Renewal",
    triggerDescription: "Sent when a subscription renews.",
    subject: "Your {{planName}} subscription has been renewed",
    headline: "Subscription renewed",
    paragraphs: [
      "Hi {{organizationOwner}}, the {{planName}} subscription for {{organizationName}} has been renewed.",
      "Subscription reference: {{subscriptionId}}. Your next billing date is {{dueDate}}.",
    ],
    ctaLabel: null,
    ctaUrl: null,
  }),
  preset({
    id: "subscription-cancelled",
    name: "Subscription cancelled",
    key: "subscription_cancelled",
    code: "TPL-SUB-CANCEL",
    category: "BILLING",
    bannerColor: "violet",
    headerBadge: "Subscription",
    triggerDescription: "Sent when a subscription is cancelled.",
    subject: "Your {{planName}} subscription was cancelled",
    headline: "Subscription cancelled",
    paragraphs: [
      "Hi {{organizationOwner}}, the {{planName}} subscription ({{subscriptionId}}) for {{organizationName}} has been cancelled.",
      "If this was not intended, contact {{supportEmail}} and we will help you restore it.",
    ],
    ctaLabel: null,
    ctaUrl: null,
  }),
  preset({
    id: "payment-successful",
    name: "Payment successful",
    key: "payment_successful",
    code: "TPL-PAY-OK",
    category: "BILLING",
    bannerColor: "violet",
    headerBadge: "Payment Received",
    triggerDescription: "Sent when a payment succeeds.",
    subject: "Payment received for invoice {{invoiceNumber}}",
    headline: "Thank you for your payment",
    paragraphs: [
      "Hi {{organizationOwner}}, we received your payment of {{invoiceAmount}} for invoice {{invoiceNumber}}.",
      "No further action is needed for {{organizationName}}.",
    ],
    ctaLabel: null,
    ctaUrl: null,
  }),
  preset({
    id: "payment-failed",
    name: "Payment failed",
    key: "payment_failed",
    code: "TPL-PAY-FAILED",
    category: "ALERTS",
    bannerColor: "rose",
    headerBadge: "Action Needed",
    triggerDescription: "Sent when a payment attempt fails.",
    subject: "Payment failed for invoice {{invoiceNumber}}",
    headline: "We could not process your payment",
    paragraphs: [
      "Hi {{organizationOwner}}, the payment of {{invoiceAmount}} for invoice {{invoiceNumber}} did not go through.",
      "Please update your payment details before {{dueDate}} to keep {{organizationName}} on the {{planName}} plan.",
    ],
    ctaLabel: null,
    ctaUrl: null,
  }),
  preset({
    id: "invoice-generated",
    name: "Invoice generated",
    key: "invoice_generated",
    code: "TPL-INV-NEW",
    category: "BILLING",
    bannerColor: "violet",
    headerBadge: "Invoice",
    triggerDescription: "Sent when a new invoice is issued.",
    subject: "Invoice {{invoiceNumber}} from {{platformName}}",
    headline: "Your new invoice is ready",
    paragraphs: [
      "Hi {{organizationOwner}}, invoice {{invoiceNumber}} for {{organizationName}} has been issued.",
      "Amount due: {{invoiceAmount}}. Due date: {{dueDate}}.",
    ],
    ctaLabel: null,
    ctaUrl: null,
  }),
  preset({
    id: "invoice-overdue",
    name: "Invoice overdue",
    key: "invoice_overdue",
    code: "TPL-INV-OVERDUE",
    category: "ALERTS",
    bannerColor: "rose",
    headerBadge: "Overdue",
    triggerDescription: "Sent when an invoice passes its due date unpaid.",
    subject: "Invoice {{invoiceNumber}} is overdue",
    headline: "Your invoice is overdue",
    paragraphs: [
      "Hi {{organizationOwner}}, invoice {{invoiceNumber}} for {{invoiceAmount}} was due on {{dueDate}} and is still unpaid.",
      "Please settle it soon to avoid interruption for {{organizationName}}. Questions? Reply to {{supportEmail}}.",
    ],
    ctaLabel: null,
    ctaUrl: null,
  }),
  preset({
    id: "security-alert",
    name: "Security alert",
    key: "security_alert",
    code: "TPL-SEC-ALERT",
    category: "SECURITY",
    bannerColor: "emerald",
    headerBadge: "Security Alert",
    triggerDescription: "Sent when unusual account activity is detected.",
    subject: "Security alert for your {{platformName}} account",
    headline: "We noticed unusual activity",
    paragraphs: [
      "Hi {{userName}}, we detected a sign-in or change on {{userEmail}} that looks unusual.",
      "If this was you, no action is needed. If not, reset your password now and contact {{supportEmail}}.",
    ],
    ctaLabel: "Reset password",
    ctaUrl: "{{resetPasswordLink}}",
  }),
  preset({
    id: "announcement",
    name: "Announcement",
    key: "platform_announcement",
    code: "TPL-ANNOUNCE",
    category: "ANNOUNCEMENTS",
    bannerColor: "slate",
    headerBadge: "Announcement",
    triggerDescription: "Sent for platform-wide announcements by email.",
    subject: "An update from {{platformName}}",
    headline: "News from {{platformName}}",
    paragraphs: [
      "Hi {{userName}}, we have an update for {{organizationName}}.",
      "Replace this paragraph with the announcement details before saving.",
    ],
    ctaLabel: null,
    ctaUrl: null,
  }),
  preset({
    id: "account-suspended",
    name: "Account suspended",
    key: "account_suspended",
    code: "TPL-ACC-SUSPEND",
    category: "ALERTS",
    bannerColor: "rose",
    headerBadge: "Suspended",
    triggerDescription: "Sent when an account or organization is suspended.",
    subject: "{{organizationName}} has been suspended",
    headline: "Your account has been suspended",
    paragraphs: [
      "Hi {{organizationOwner}}, access to {{organizationName}} on {{platformName}} has been suspended.",
      "Your data is kept safe. Contact {{supportEmail}} to resolve the issue and restore access.",
    ],
    ctaLabel: null,
    ctaUrl: null,
  }),
  preset({
    id: "account-restored",
    name: "Account restored",
    key: "account_restored",
    code: "TPL-ACC-RESTORE",
    category: "ANNOUNCEMENTS",
    bannerColor: "slate",
    headerBadge: "Restored",
    triggerDescription: "Sent when a suspended account or organization is restored.",
    subject: "{{organizationName}} has been restored",
    headline: "Your access is restored",
    paragraphs: [
      "Hi {{organizationOwner}}, access to {{organizationName}} on {{platformName}} has been restored.",
      "Your team can sign in again and continue where they left off.",
    ],
    ctaLabel: null,
    ctaUrl: null,
  }),
];
