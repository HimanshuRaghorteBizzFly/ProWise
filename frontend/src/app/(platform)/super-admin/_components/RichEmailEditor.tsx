"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Monitor, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmailBannerColor, EmailTemplate, EmailTemplateCategory } from "../_types";
import { interpolateTemplate } from "../_services/super-admin-service";
import { AdminInput, AdminSelect, AdminTextarea } from "./SuperAdminPrimitives";

export interface EmailBannerTheme {
  label: string;
  gradient: string;
  cta: string;
  eyebrow: string;
  rate: string;
  categoryBadge: string;
  cardBorder: string;
  swatch: string;
}

export const EMAIL_BANNER_THEMES: Record<EmailBannerColor, EmailBannerTheme> = {
  indigo: {
    label: "Indigo",
    gradient: "bg-gradient-to-r from-indigo-700 to-blue-600",
    cta: "bg-indigo-600 hover:bg-indigo-700",
    eyebrow: "text-indigo-600 dark:text-indigo-400",
    rate: "text-indigo-600 dark:text-indigo-400",
    categoryBadge: "border-indigo-500/30 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
    cardBorder: "border-indigo-500/35 hover:border-indigo-500/65",
    swatch: "bg-indigo-600",
  },
  sky: {
    label: "Sky",
    gradient: "bg-gradient-to-r from-sky-700 to-cyan-600",
    cta: "bg-sky-600 hover:bg-sky-700",
    eyebrow: "text-sky-600 dark:text-sky-400",
    rate: "text-sky-600 dark:text-sky-400",
    categoryBadge: "border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300",
    cardBorder: "border-sky-500/35 hover:border-sky-500/65",
    swatch: "bg-sky-600",
  },
  emerald: {
    label: "Emerald",
    gradient: "bg-gradient-to-r from-emerald-700 to-teal-600",
    cta: "bg-emerald-600 hover:bg-emerald-700",
    eyebrow: "text-emerald-600 dark:text-emerald-400",
    rate: "text-emerald-600 dark:text-emerald-400",
    categoryBadge: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    cardBorder: "border-emerald-500/35 hover:border-emerald-500/65",
    swatch: "bg-emerald-600",
  },
  violet: {
    label: "Violet",
    gradient: "bg-gradient-to-r from-violet-700 to-purple-600",
    cta: "bg-violet-600 hover:bg-violet-700",
    eyebrow: "text-violet-600 dark:text-violet-400",
    rate: "text-violet-600 dark:text-violet-400",
    categoryBadge: "border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300",
    cardBorder: "border-violet-500/35 hover:border-violet-500/65",
    swatch: "bg-violet-600",
  },
  rose: {
    label: "Rose",
    gradient: "bg-gradient-to-r from-rose-700 to-red-600",
    cta: "bg-rose-600 hover:bg-rose-700",
    eyebrow: "text-rose-600 dark:text-rose-400",
    rate: "text-rose-600 dark:text-rose-400",
    categoryBadge: "border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300",
    cardBorder: "border-rose-500/35 hover:border-rose-500/65",
    swatch: "bg-rose-600",
  },
  amber: {
    label: "Amber",
    gradient: "bg-gradient-to-r from-amber-600 to-orange-600",
    cta: "bg-amber-600 hover:bg-amber-700",
    eyebrow: "text-amber-700 dark:text-amber-400",
    rate: "text-amber-600 dark:text-amber-400",
    categoryBadge: "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300",
    cardBorder: "border-amber-500/35 hover:border-amber-500/65",
    swatch: "bg-amber-600",
  },
  slate: {
    label: "Slate",
    gradient: "bg-gradient-to-r from-slate-800 to-slate-700",
    cta: "bg-blue-600 hover:bg-blue-700",
    eyebrow: "text-slate-600 dark:text-slate-300",
    rate: "text-blue-600 dark:text-blue-400",
    categoryBadge: "border-cyan-500/30 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    cardBorder: "border-slate-500/40 hover:border-slate-400/70",
    swatch: "bg-slate-700",
  },
};

export const BANNER_COLOR_LIST: EmailBannerColor[] = [
  "indigo",
  "sky",
  "emerald",
  "violet",
  "rose",
  "amber",
  "slate",
];

export function inferEmailBannerColor(
  tpl: Pick<EmailTemplate, "category" | "bannerColor">
): EmailBannerColor {
  if (tpl.bannerColor && EMAIL_BANNER_THEMES[tpl.bannerColor]) {
    return tpl.bannerColor;
  }
  if (tpl.category === "AUTH") return "indigo";
  if (tpl.category === "BILLING") return "violet";
  if (tpl.category === "DELIVERY") return "sky";
  if (tpl.category === "ALERTS") return "rose";
  if (tpl.category === "RENEWAL") return "amber";
  if (tpl.category === "SECURITY") return "emerald";
  return "slate";
}

export function getEmailBannerTheme(
  tpl: Pick<EmailTemplate, "category" | "bannerColor">
): EmailBannerTheme {
  return EMAIL_BANNER_THEMES[inferEmailBannerColor(tpl)];
}

export interface ProWiseEmailPreviewCardProps {
  device: "DESKTOP" | "MOBILE";
  bannerColor: EmailBannerColor;
  senderBrandName?: string;
  headerBadge?: string;
  eyebrowLabel?: string;
  renderedHeadline: string;
  renderedBody: string;
  renderedCtaLabel: string;
  accountEmail?: string;
  organizationName?: string;
  planName?: string;
  showHighlightBox?: boolean;
  footerTimestamp?: string;
  compact?: boolean;
}

export function ProWiseEmailPreviewCard({
  device,
  bannerColor,
  senderBrandName = "ProWise",
  headerBadge = "PROWISE NOTICE",
  eyebrowLabel = "PROWISE PLATFORM NOTIFICATION",
  renderedHeadline,
  renderedBody,
  renderedCtaLabel,
  accountEmail,
  organizationName,
  planName,
  showHighlightBox = true,
  footerTimestamp = "Delivered via ProWise Secure Enterprise Mail",
  compact = false,
}: ProWiseEmailPreviewCardProps) {
  const theme = EMAIL_BANNER_THEMES[bannerColor] || EMAIL_BANNER_THEMES.indigo;
  const isMobile = device === "MOBILE";
  const brandInitials =
    senderBrandName
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "PW";

  return (
    <div
      className={cn(
        "w-full mx-auto bg-[var(--color-surface)] overflow-hidden transition-all duration-200 shadow-lg",
        isMobile
          ? "max-w-[335px] rounded-[30px] border-[3px] border-slate-700 dark:border-slate-500"
          : "max-w-[560px] rounded-2xl border border-[var(--color-border)]"
      )}
    >
      {/* Desktop Mail Client Chrome */}
      {!isMobile && (
        <div className="bg-[var(--color-sidebar)] border-b border-[var(--color-border)] px-4 py-2 flex items-center gap-2">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span className="text-[11px] font-medium text-[var(--color-text-muted)] ml-1 truncate">
            ProWise — Desktop Mail Preview
          </span>
        </div>
      )}

      {/* Mobile Phone Status Bar & Inbox Chrome */}
      {isMobile && (
        <div className="bg-[var(--color-sidebar)] border-b border-[var(--color-border)] px-4 pt-2.5 pb-2 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-bold text-[var(--color-text-primary)]">
            <span>9:41</span>
            <span className="h-3.5 w-16 rounded-full bg-slate-950 border border-slate-800 inline-block" aria-hidden="true" />
            <span className="text-[9px] text-[var(--color-text-secondary)]">5G • 100%</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-blue-600 dark:text-blue-400">&lsaquo; Inbox</span>
            <span className="text-[10px] text-[var(--color-text-muted)]">Today, 9:41 AM</span>
          </div>
        </div>
      )}

      {/* Branded Top Banner */}
      <div
        className={cn(
          "flex items-center justify-between gap-2 text-white",
          theme.gradient,
          compact ? "px-3.5 py-2.5" : "px-5 py-3.5"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-7 w-7 rounded-lg bg-white/20 backdrop-blur-sm border border-white/25 flex items-center justify-center font-extrabold text-xs text-white shrink-0">
            {brandInitials}
          </span>
          <span className="font-bold tracking-tight text-sm text-white truncate">
            {senderBrandName || "Company Name"}
          </span>
        </div>
        {headerBadge && (
          <span className="inline-flex items-center rounded-full bg-white/20 border border-white/25 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shrink-0">
            {headerBadge}
          </span>
        )}
      </div>

      {/* Email Body Surface (Dark-mode safe) */}
      <div className={cn("space-y-4", compact ? "p-4" : isMobile ? "p-5" : "p-6")}>
        <div className="space-y-1.5">
          <p className={cn("text-[10px] font-bold uppercase tracking-wider", theme.eyebrow)}>
            {eyebrowLabel}
          </p>
          {renderedHeadline ? (
            <h4
              className={cn(
                "font-extrabold text-[var(--color-text-primary)] leading-snug break-words",
                isMobile ? "text-base" : "text-lg"
              )}
            >
              {renderedHeadline}
            </h4>
          ) : (
            <h4
              className={cn(
                "font-extrabold text-[var(--color-text-muted)] leading-snug break-words",
                isMobile ? "text-base" : "text-lg"
              )}
            >
              Your Email Subject Headline
            </h4>
          )}
        </div>

        <div className="text-xs sm:text-[13px] text-[var(--color-text-secondary)] space-y-2.5 leading-relaxed break-words">
          {renderedBody.trim() ? (
            renderedBody.split(/\n+/).filter(Boolean).map((para, i) => (
              <p key={i}>{para}</p>
            ))
          ) : (
            <p className="italic text-[var(--color-text-muted)]">
              (Start typing your email message in the form on the left. Changes will appear live right here.)
            </p>
          )}
        </div>

        {showHighlightBox && (organizationName || accountEmail || planName) && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 space-y-1.5 text-xs">
            {organizationName && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Workspace
                </span>
                <span className="font-semibold text-[var(--color-text-primary)] truncate">
                  {organizationName}
                </span>
              </div>
            )}
            {accountEmail && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Recipient
                </span>
                <span className="font-medium text-blue-600 dark:text-blue-400 truncate">
                  {accountEmail}
                </span>
              </div>
            )}
            {planName && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Plan Tier
                </span>
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {planName}
                </span>
              </div>
            )}
          </div>
        )}

        {renderedCtaLabel && (
          <div className="pt-1 flex justify-center">
            <span
              className={cn(
                "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors",
                isMobile ? "w-full" : "min-w-[220px]",
                theme.cta
              )}
            >
              {renderedCtaLabel}
            </span>
          </div>
        )}
      </div>

      {/* Email Branded Footer */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-app-bg)] px-4 py-3 text-center space-y-0.5 text-[11px] text-[var(--color-text-muted)]">
        <p className="font-semibold text-[var(--color-text-secondary)]">
          Sent by {senderBrandName || "Company Name"} for {organizationName || "Target Organization"}
        </p>
        <p className="text-[10px]">{footerTimestamp}</p>
      </div>
    </div>
  );
}

export interface RichEmailEditorProps {
  isEditing: boolean;
  name: string;
  onNameChange: (value: string) => void;
  category: EmailTemplateCategory;
  onCategoryChange: (value: EmailTemplateCategory) => void;
  status: "ACTIVE" | "DRAFT";
  onStatusChange: (value: "ACTIVE" | "DRAFT") => void;
  displayCode: string;
  onDisplayCodeChange: (value: string) => void;
  keyCode: string;
  onKeyCodeChange: (value: string) => void;
  senderBrandName: string;
  onSenderBrandNameChange: (value: string) => void;
  bannerColor: EmailBannerColor;
  onBannerColorChange: (value: EmailBannerColor) => void;
  headerBadge: string;
  onHeaderBadgeChange: (value: string) => void;
  triggerDescription: string;
  onTriggerDescriptionChange: (value: string) => void;
  showHighlightBox: boolean;
  onShowHighlightBoxChange: (value: boolean) => void;
  footerNote: string;
  onFooterNoteChange: (value: string) => void;
  subject: string;
  onSubjectChange: (value: string) => void;
  headline: string;
  onHeadlineChange: (value: string) => void;
  bodyParagraphs: string;
  onBodyParagraphsChange: (value: string) => void;
  ctaLabel: string;
  onCtaLabelChange: (value: string) => void;
  ctaUrl: string;
  onCtaUrlChange: (value: string) => void;
  sampleVars: Record<string, string>;
  onSampleVarsChange: (vars: Record<string, string>) => void;
  organizationSuggestions: string[];
  errors: Record<string, string>;
}

export function RichEmailEditor({
  isEditing,
  name,
  onNameChange,
  category,
  onCategoryChange,
  status,
  onStatusChange,
  displayCode,
  onDisplayCodeChange,
  keyCode,
  onKeyCodeChange,
  senderBrandName,
  onSenderBrandNameChange,
  bannerColor,
  onBannerColorChange,
  headerBadge,
  onHeaderBadgeChange,
  triggerDescription,
  onTriggerDescriptionChange,
  showHighlightBox,
  onShowHighlightBoxChange,
  footerNote,
  onFooterNoteChange,
  subject,
  onSubjectChange,
  headline,
  onHeadlineChange,
  bodyParagraphs,
  onBodyParagraphsChange,
  ctaLabel,
  onCtaLabelChange,
  ctaUrl,
  onCtaUrlChange,
  sampleVars,
  onSampleVarsChange,
  organizationSuggestions,
  errors,
}: RichEmailEditorProps) {
  const [previewDevice, setPreviewDevice] = useState<"DESKTOP" | "MOBILE">(isEditing ? "MOBILE" : "DESKTOP");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    setPreviewDevice(isEditing ? "MOBILE" : "DESKTOP");
  }, [isEditing]);

  const renderedSubject = interpolateTemplate(subject, sampleVars);
  const renderedHeadline = interpolateTemplate(headline, sampleVars);
  const renderedBody = interpolateTemplate(bodyParagraphs, sampleVars);
  const renderedCtaLabel = interpolateTemplate(ctaLabel, sampleVars);
  const activeTheme = EMAIL_BANNER_THEMES[bannerColor] || EMAIL_BANNER_THEMES.indigo;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-w-0">
      {/* Left Column: Clean Visual Builder Form */}
      <div className="lg:col-span-6 space-y-3.5 min-w-0">
        {/* Brand Theme Picker Strip */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3.5 py-2.5 flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
            Brand Theme:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {BANNER_COLOR_LIST.map((c) => {
              const palette = EMAIL_BANNER_THEMES[c];
              const selected = bannerColor === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onBannerColorChange(c)}
                  aria-label={`Select ${palette.label} brand theme`}
                  title={palette.label}
                  className={cn(
                    "h-5 w-5 rounded-full transition-transform",
                    palette.swatch,
                    selected
                      ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-[var(--color-app-bg)] scale-110"
                      : "opacity-80 hover:opacity-100"
                  )}
                />
              );
            })}
            <span
              className={cn("ml-1 h-4 w-4 rounded-sm border border-white/20", activeTheme.swatch)}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Template Name + Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AdminInput
            label="Template Name *"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Onboarding Welcome or Workspace Invite"
            error={errors.name}
          />
          <AdminSelect
            label="Category"
            value={category}
            onChange={(e) => onCategoryChange(e.target.value as EmailTemplateCategory)}
            options={[
              { label: "Authentication", value: "AUTH" },
              { label: "Billing", value: "BILLING" },
              { label: "Delivery", value: "DELIVERY" },
              { label: "Alerts", value: "ALERTS" },
              { label: "System Notice", value: "ANNOUNCEMENTS" },
              { label: "Renewal", value: "RENEWAL" },
              { label: "Security", value: "SECURITY" },
            ]}
          />
        </div>

        {/* Sender Brand Name + Target Tenant / Workspace */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AdminInput
            label="Sender Brand Name"
            value={senderBrandName}
            onChange={(e) => onSenderBrandNameChange(e.target.value)}
            placeholder="e.g. ProWise"
          />
          <div>
            <AdminInput
              label="Target Tenant / Workspace"
              list="prowise-tenant-preview-options"
              value={sampleVars.organization_name || ""}
              onChange={(e) =>
                onSampleVarsChange({ ...sampleVars, organization_name: e.target.value })
              }
              placeholder="e.g. Acme Health or All Organizations"
            />
            <datalist id="prowise-tenant-preview-options">
              {organizationSuggestions.map((orgName) => (
                <option key={orgName} value={orgName} />
              ))}
            </datalist>
          </div>
        </div>

        <AdminInput
          label="Email Subject Line *"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="e.g. Welcome to your workspace — Let's get started"
          error={errors.subject}
        />

        <AdminInput
          label="Email Main Headline *"
          value={headline}
          onChange={(e) => onHeadlineChange(e.target.value)}
          placeholder="e.g. Welcome to your new workspace"
        />

        {/* Message Content (Plain Text) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
              Message Content (Plain Text) *
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)]">
              Line breaks create paragraphs
            </span>
          </div>
          <AdminTextarea
            rows={6}
            value={bodyParagraphs}
            onChange={(e) => onBodyParagraphsChange(e.target.value)}
            placeholder="Type your message here. For example: Your workspace account has been configured. You can now log in and access your team tools."
            error={errors.body}
          />
        </div>

        {/* CTA Label & Destination */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AdminInput
            label="CTA Button Label (Optional)"
            value={ctaLabel}
            onChange={(e) => onCtaLabelChange(e.target.value)}
            placeholder="e.g. Open Workspace or View Invoice"
          />
          <AdminInput
            label="CTA Button Link (Optional)"
            value={ctaUrl}
            onChange={(e) => onCtaUrlChange(e.target.value)}
            placeholder="e.g. https://app.prowise.io/login"
          />
        </div>

        {/* Collapsible Optional Email Extras */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] overflow-hidden">
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-[var(--color-hover)] transition-colors text-left"
          >
            <span className="inline-flex items-center gap-1.5">
              {advancedOpen ? (
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              )}
              Optional Email Extras (Badge, Highlight Box, Send Note, Footer)
            </span>
          </button>

          {advancedOpen && (
            <div className="border-t border-[var(--color-border)] p-3.5 space-y-3 bg-[var(--color-surface)]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <AdminInput
                  label="Template ID"
                  value={displayCode}
                  onChange={(e) => onDisplayCodeChange(e.target.value.toUpperCase())}
                  placeholder="e.g. TPL-1001"
                />
                <AdminInput
                  label="Template Key"
                  value={keyCode}
                  disabled={isEditing}
                  onChange={(e) => onKeyCodeChange(e.target.value.toUpperCase())}
                  placeholder="e.g. WELCOME_EMAIL"
                  error={errors.keyCode}
                />
                <AdminSelect
                  label="Status"
                  value={status}
                  onChange={(e) => onStatusChange(e.target.value as "ACTIVE" | "DRAFT")}
                  options={[
                    { label: "Active", value: "ACTIVE" },
                    { label: "Draft", value: "DRAFT" },
                  ]}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
                <AdminInput
                  label="Header Pill Badge"
                  value={headerBadge}
                  onChange={(e) => onHeaderBadgeChange(e.target.value)}
                  placeholder="e.g. Account Ready"
                />
                <label className="flex items-center gap-2 h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 text-xs font-medium text-[var(--color-text-primary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showHighlightBox}
                    onChange={(e) => onShowHighlightBoxChange(e.target.checked)}
                    className="accent-blue-600"
                  />
                  Show Highlight Details Box
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <AdminInput
                  label="When This Email Sends"
                  value={triggerDescription}
                  onChange={(e) => onTriggerDescriptionChange(e.target.value)}
                  placeholder="e.g. Sent automatically when a new user joins"
                />
                <AdminInput
                  label="Footer Note"
                  value={footerNote}
                  onChange={(e) => onFooterNoteChange(e.target.value)}
                  placeholder="e.g. Sent via ProWise Secure Delivery"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Live Real-Time Preview */}
      <div className="lg:col-span-6 min-w-0 flex flex-col">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 space-y-3 flex-1 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--color-text-primary)]">
                Live Real-Time Preview
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live Sync
              </span>
            </div>

            <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setPreviewDevice("DESKTOP")}
                aria-label="Desktop preview"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors",
                  previewDevice === "DESKTOP"
                    ? "bg-blue-600 text-white"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                )}
              >
                <Monitor className="w-3.5 h-3.5" />
                Desktop
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice("MOBILE")}
                aria-label="Mobile preview"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors",
                  previewDevice === "MOBILE"
                    ? "bg-blue-600 text-white"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                )}
              >
                <Smartphone className="w-3.5 h-3.5" />
                Mobile
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs truncate">
            <span className="font-bold uppercase text-[10px] tracking-wider text-[var(--color-text-muted)] mr-1.5">
              Subject:
            </span>
            {renderedSubject.trim() ? (
              <span className="font-semibold text-[var(--color-text-primary)]">{renderedSubject}</span>
            ) : (
              <span className="text-[var(--color-text-muted)]">Subject line will preview here...</span>
            )}
          </div>

          <div className="flex-1 flex items-center justify-center py-1 overflow-y-auto">
            <ProWiseEmailPreviewCard
              device={previewDevice}
              bannerColor={bannerColor}
              senderBrandName={senderBrandName}
              headerBadge={headerBadge}
              eyebrowLabel={(sampleVars.organization_name || "TARGET ORGANIZATION").toUpperCase()}
              renderedHeadline={renderedHeadline}
              renderedBody={renderedBody}
              renderedCtaLabel={renderedCtaLabel}
              accountEmail={
                sampleVars.organization_name && sampleVars.user_name
                  ? `${sampleVars.user_name} (Sample)`
                  : undefined
              }
              organizationName={sampleVars.organization_name || undefined}
              planName={sampleVars.organization_name ? sampleVars.plan_name : undefined}
              showHighlightBox={showHighlightBox}
              footerTimestamp={footerNote || "Sent via ProWise Secure Enterprise Delivery"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
