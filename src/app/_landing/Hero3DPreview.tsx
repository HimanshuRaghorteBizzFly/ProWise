"use client";

import React, { useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  GitBranch,
  Layers,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "@/styles/landing.module.css";
import { usePointerCapabilities } from "./MotionPrimitives";

export function Hero3DPreview() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { interactiveMouse, prefersReducedMotion } = usePointerCapabilities();
  const [activeMode, setActiveMode] = useState<"STRUCTURED" | "INDIVIDUAL">("STRUCTURED");

  const tiltX = useMotionValue(4);
  const tiltY = useMotionValue(-6);
  const springX = useSpring(tiltX, { stiffness: 150, damping: 20 });
  const springY = useSpring(tiltY, { stiffness: 150, damping: 20 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactiveMouse || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    tiltX.set(-ny * 12);
    tiltY.set(nx * 14);
  };

  const handleMouseLeave = () => {
    tiltX.set(4);
    tiltY.set(-6);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn("relative mx-auto mt-12 sm:mt-16 max-w-5xl px-2 sm:px-6", styles.scene3d)}
    >
      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 36, scale: 0.96 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        style={
          interactiveMouse
            ? {
                rotateX: springX,
                rotateY: springY,
                transformStyle: "preserve-3d",
              }
            : undefined
        }
        className={cn("relative", styles.preserve3d)}
      >
        {/* Main Floating 3D SaaS Window */}
        <div className="relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-xl shadow-2xl overflow-hidden text-left">
          {/* Top Chrome Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-sidebar)] px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <span className="ml-2 text-xs font-semibold text-[var(--color-text-secondary)] hidden sm:inline">
                ProWise Workspace · Acme Health Technologies
              </span>
            </div>

            {/* Interactive Mode Switcher Inside Preview */}
            <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setActiveMode("STRUCTURED")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-semibold transition-colors",
                  activeMode === "STRUCTURED"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                )}
              >
                Mode B · Structured
              </button>
              <button
                type="button"
                onClick={() => setActiveMode("INDIVIDUAL")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-semibold transition-colors",
                  activeMode === "INDIVIDUAL"
                    ? "bg-teal-600 text-white shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                )}
              >
                Mode A · Individual
              </button>
            </div>
          </div>

          {/* Workspace Canvas */}
          <div className="p-4 sm:p-6 bg-[var(--color-app-bg)]/80 space-y-5">
            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  label: activeMode === "STRUCTURED" ? "Mathematical Progress" : "Reported Progress",
                  value: activeMode === "STRUCTURED" ? "64.0%" : "78.0%",
                  sub: activeMode === "STRUCTURED" ? "80 / 125 baseline pts" : "Week 46 Check-in",
                  accent: "text-blue-600 dark:text-blue-400",
                },
                {
                  label: "Delivery Health",
                  value: "ON TRACK",
                  sub: "Zero dependency cycles",
                  accent: "text-emerald-600 dark:text-emerald-400",
                },
                {
                  label: activeMode === "STRUCTURED" ? "Approved Baseline" : "Accountable Owner",
                  value: activeMode === "STRUCTURED" ? "v2.4 Locked" : "Aarav Sharma",
                  sub: activeMode === "STRUCTURED" ? "Immutable snapshot" : "100% requests sign-off",
                  accent: "text-violet-600 dark:text-violet-400",
                },
                {
                  label: "GitHub Evidence",
                  value: "24 Linked PRs",
                  sub: "Deduplicated webhook sync",
                  accent: "text-teal-600 dark:text-teal-400",
                },
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 space-y-1"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] truncate">
                    {stat.label}
                  </p>
                  <p className={cn("text-base sm:text-lg font-extrabold tracking-tight", stat.accent)}>
                    {stat.value}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-secondary)] truncate">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* Active Mode Breakdown Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              <div className="lg:col-span-7 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-500" />
                    {activeMode === "STRUCTURED"
                      ? "Weighted Baseline Rollup (CDS API Platform)"
                      : "Append-Only Engineer Check-in Log"}
                  </span>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                    Deterministic
                  </span>
                </div>

                {activeMode === "STRUCTURED" ? (
                  <div className="space-y-2.5">
                    {[
                      { name: "Core Auth & Tenant Gateway", pts: "40 / 40 pts", pct: 100, color: "bg-emerald-500" },
                      { name: "Webhook Ingestion Queue", pts: "28 / 45 pts", pct: 62, color: "bg-blue-500" },
                      { name: "Automated Audit Snapshots", pts: "12 / 40 pts", pct: 30, color: "bg-indigo-500" },
                    ].map((row) => (
                      <div key={row.name} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-[var(--color-text-primary)]">{row.name}</span>
                          <span className="text-[var(--color-text-secondary)] tabular-nums">
                            {row.pts} ({row.pct}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--color-elevated)] overflow-hidden border border-[var(--color-border)]/50">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${row.pct}%` }}
                            transition={{ duration: 0.7, ease: "easeOut" }}
                            className={cn("h-full rounded-full", row.color)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    {[
                      { week: "Week 46", pct: "78%", summary: "Completed OAuth token rotation & zero-downtime migration script." },
                      { week: "Week 45", pct: "64%", summary: "Revised downward (-4%) after discovering legacy edge-case retry queue." },
                    ].map((entry) => (
                      <div
                        key={entry.week}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-2.5 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <strong className="text-[var(--color-text-primary)]">{entry.week}</strong>
                          <span className="font-bold text-teal-600 dark:text-teal-400">{entry.pct}</span>
                        </div>
                        <p className="text-[11px] text-[var(--color-text-secondary)]">{entry.summary}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex flex-col justify-between gap-3">
                <div className="space-y-2">
                  <span className="text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                    Strict Verification Gates
                  </span>
                  {[
                    "Reopened leaf revokes credit immediately",
                    "Stale baseline approvals blocked automatically",
                    "Separate blockers without breaking graph math",
                  ].map((rule) => (
                    <div key={rule} className="flex items-start gap-2 text-[11px] text-[var(--color-text-secondary)]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{rule}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-blue-500/25 bg-blue-500/10 px-3 py-2 text-[11px] font-mono text-blue-700 dark:text-blue-300">
                  Sum(Done Leaves) / Sum(Baseline) × 100
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Layered 3D Floating Depth Badge — Top Left */}
        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : { y: [0, -8, 0] }
          }
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          className={cn(
            "hidden md:flex items-center gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-md px-3.5 py-2.5 shadow-xl absolute -top-5 -left-4 z-20",
            styles.depthLayerMd
          )}
        >
          <span className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0">
            <Sparkles className="w-4 h-4" />
          </span>
          <div className="text-left">
            <p className="text-[11px] font-bold text-[var(--color-text-primary)]">Zero Guesswork</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">Math-backed delivery scores</p>
          </div>
        </motion.div>

        {/* Layered 3D Floating Depth Badge — Bottom Right */}
        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : { y: [0, 8, 0] }
          }
          transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
          className={cn(
            "hidden md:flex items-center gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-md px-3.5 py-2.5 shadow-xl absolute -bottom-5 -right-4 z-20",
            styles.depthLayerLg
          )}
        >
          <span className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white shrink-0">
            <GitBranch className="w-4 h-4" />
          </span>
          <div className="text-left">
            <p className="text-[11px] font-bold text-[var(--color-text-primary)]">Live Evidence Sync</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">Commits, PRs &amp; QA Sign-offs</p>
          </div>
        </motion.div>

        {/* Layered 3D Floating Depth Pill — Top Right */}
        <div
          className={cn(
            "hidden lg:inline-flex items-center gap-1.5 rounded-full border border-indigo-500/35 bg-[var(--color-surface)]/95 backdrop-blur-md px-3 py-1.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 shadow-lg absolute -top-4 right-8 z-20",
            styles.depthLayerSm
          )}
        >
          <Lock className="w-3 h-3" />
          <span>9 Isolated RBAC Panels</span>
          <Activity className="w-3 h-3 text-emerald-500 ml-0.5" />
        </div>
      </motion.div>
    </div>
  );
}

