"use client";

import React, { useState } from "react";
import { CheckCircle2, Circle, Eye, EyeOff, Lock } from "lucide-react";
import { PASSWORD_RULES, passwordStrength } from "@/lib/password-policy";

const STRENGTH_STYLE: Record<string, { label: string; bar: string; width: string }> = {
  empty: { label: "Not entered", bar: "bg-[var(--color-border)]", width: "0%" },
  weak: { label: "Weak", bar: "bg-rose-500", width: "25%" },
  fair: { label: "Fair", bar: "bg-amber-500", width: "50%" },
  good: { label: "Good", bar: "bg-blue-500", width: "75%" },
  strong: { label: "Strong", bar: "bg-emerald-500", width: "100%" },
};

interface PasswordInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "new-password" | "current-password";
  placeholder?: string;
  error?: string;
}

/** Password input with a show/hide toggle. The value lives only in component state. */
export function PasswordInput({ id, label, value, onChange, autoComplete, placeholder, error }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
        {label}
      </label>
      <div className="relative">
        <Lock className="w-4 h-4 absolute left-3 top-2.5 text-[var(--color-text-muted)] pointer-events-none" />
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-app-bg)] pl-9 pr-10 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1.5 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}

/** Strength meter and the policy checklist for a new password. */
export function PasswordStrengthChecklist({ password }: { password: string }) {
  const { level } = passwordStrength(password);
  const style = STRENGTH_STYLE[level];
  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[var(--color-text-muted)]">Strength</span>
        <span className="font-medium text-[var(--color-text-secondary)]">{style.label}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[var(--color-border)] overflow-hidden">
        <div className={`h-full ${style.bar} transition-all`} style={{ width: style.width }} />
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <li key={rule.id} className={`flex items-center gap-1.5 ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--color-text-muted)]"}`}>
              {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
