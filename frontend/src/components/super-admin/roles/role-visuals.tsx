import React from "react";
import {
  Activity,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Code,
  Eye,
  KeyRound,
  Lock,
  Rocket,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Star,
  Users,
  Wrench,
} from "lucide-react";

const ICONS: Record<string, React.ElementType> = {
  Activity, Briefcase, Building2, Calendar, CheckCircle2, Code, Eye, KeyRound, Lock, Rocket, Shield, ShieldAlert,
  ShieldCheck, Star, Users, Wrench,
};

export function RoleIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Shield;
  return <Icon className={className} aria-hidden="true" />;
}

interface Tone {
  top: string;
  chip: string;
  bar: string;
  swatch: string;
}

/** Static class strings (Tailwind only keeps classes it can see in the source). */
const TONES: Record<string, Tone> = {
  blue: { top: "border-t-blue-500", chip: "bg-blue-500/12 text-blue-600 dark:text-blue-400", bar: "bg-blue-500", swatch: "bg-blue-500" },
  indigo: { top: "border-t-indigo-500", chip: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-400", bar: "bg-indigo-500", swatch: "bg-indigo-500" },
  violet: { top: "border-t-violet-500", chip: "bg-violet-500/12 text-violet-600 dark:text-violet-400", bar: "bg-violet-500", swatch: "bg-violet-500" },
  fuchsia: { top: "border-t-fuchsia-500", chip: "bg-fuchsia-500/12 text-fuchsia-600 dark:text-fuchsia-400", bar: "bg-fuchsia-500", swatch: "bg-fuchsia-500" },
  pink: { top: "border-t-pink-500", chip: "bg-pink-500/12 text-pink-600 dark:text-pink-400", bar: "bg-pink-500", swatch: "bg-pink-500" },
  rose: { top: "border-t-rose-500", chip: "bg-rose-500/12 text-rose-600 dark:text-rose-400", bar: "bg-rose-500", swatch: "bg-rose-500" },
  orange: { top: "border-t-orange-500", chip: "bg-orange-500/12 text-orange-600 dark:text-orange-400", bar: "bg-orange-500", swatch: "bg-orange-500" },
  amber: { top: "border-t-amber-500", chip: "bg-amber-500/12 text-amber-600 dark:text-amber-400", bar: "bg-amber-500", swatch: "bg-amber-500" },
  lime: { top: "border-t-lime-500", chip: "bg-lime-500/12 text-lime-700 dark:text-lime-400", bar: "bg-lime-500", swatch: "bg-lime-500" },
  emerald: { top: "border-t-emerald-500", chip: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500", swatch: "bg-emerald-500" },
  teal: { top: "border-t-teal-500", chip: "bg-teal-500/12 text-teal-600 dark:text-teal-400", bar: "bg-teal-500", swatch: "bg-teal-500" },
  cyan: { top: "border-t-cyan-500", chip: "bg-cyan-500/12 text-cyan-600 dark:text-cyan-400", bar: "bg-cyan-500", swatch: "bg-cyan-500" },
  sky: { top: "border-t-sky-500", chip: "bg-sky-500/12 text-sky-600 dark:text-sky-400", bar: "bg-sky-500", swatch: "bg-sky-500" },
  slate: { top: "border-t-slate-500", chip: "bg-slate-500/12 text-slate-600 dark:text-slate-300", bar: "bg-slate-500", swatch: "bg-slate-500" },
};

export function roleTone(color: string): Tone {
  return TONES[color] ?? TONES.blue;
}

export function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-elevated)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-secondary)] whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}
