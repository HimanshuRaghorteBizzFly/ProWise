"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Layers,
  Menu,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { useAuthStore, getRoleDashboardPath } from "@/store/auth-store";
import { useThemeStore } from "@/store/theme-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import styles from "@/styles/landing.module.css";
import {
  InteractiveBackdrop,
  MagneticWrapper,
  RevealBlock,
} from "@/app/_landing/MotionPrimitives";
import { Hero3DPreview } from "@/app/_landing/Hero3DPreview";
import { LandingSections } from "@/app/_landing/LandingSections";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#modes", label: "Modes" },
  { href: "#preview", label: "Preview" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export default function LandingPage() {
  const { currentRole, currentOrg, isAuthenticated } = useAuthStore();
  const { resolvedTheme, toggleTheme } = useThemeStore();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Signed-in people go to their own dashboard; everyone else signs in first.
  const appDashboardUrl = isAuthenticated ? getRoleDashboardPath(currentRole, currentOrg?.id ?? "") : "/login";

  return (
    <div
      className={cn(
        "relative min-h-screen overflow-x-clip bg-[var(--color-app-bg)] text-[var(--color-text-primary)] flex flex-col selection:bg-blue-500/20",
        styles.landingRoot
      )}
    >
      {/* Dynamic Cursor Spotlight, Aurora Orbs & Subtle Grid */}
      <InteractiveBackdrop />

      {/* Sticky Glassmorphism Navigation */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)]/80 bg-[var(--color-surface)]/80 backdrop-blur-xl transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 group shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-blue-500/30 transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-[var(--color-text-primary)]">
                ProWise
              </span>
              <span className="hidden sm:inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-elevated)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                V1.1
              </span>
            </div>
          </Link>

          {/* Desktop Anchor Links */}
          <nav
            aria-label="Landing Navigation"
            className="hidden lg:flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-elevated)]/70 px-1.5 py-1"
          >
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                mounted && resolvedTheme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              title={
                mounted && resolvedTheme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              className="w-9 h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] hover:bg-[var(--color-sidebar)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {mounted && resolvedTheme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>

            <Link href="/login" className="hidden sm:inline-flex">
              <Button variant="ghost" size="sm">
                Login
              </Button>
            </Link>

            <Link href="/signup" className="hidden sm:inline-flex">
              <Button variant="secondary" size="sm">
                Signup
              </Button>
            </Link>

            <MagneticWrapper strength={0.18} className="hidden md:inline-flex">
              <Link href={appDashboardUrl}>
                <Button size="sm" className="shadow-sm shadow-blue-500/20">
                  <span>Get Started</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
            </MagneticWrapper>

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="lg:hidden w-9 h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] flex items-center justify-center text-[var(--color-text-primary)]"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-xl px-4 py-4 space-y-3">
            <nav className="grid grid-cols-2 gap-2" aria-label="Mobile Navigation">
              {NAV_LINKS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--color-border)]">
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full">
                  Login
                </Button>
              </Link>
              <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="secondary" size="sm" className="w-full">
                  Signup
                </Button>
              </Link>
              <Link href={appDashboardUrl} onClick={() => setMobileMenuOpen(false)}>
                <Button size="sm" className="w-full">
                  Start
                </Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="relative z-10 flex-1">
        {/* 3D Interactive Hero Section */}
        <section className="relative pt-14 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-6 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            {/* Hero Copy & Magnetic CTAs */}
            <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <span>Git-Native Project Execution &amp; Scope Truth</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="text-4xl sm:text-5xl xl:text-[56px] font-extrabold tracking-tight text-[var(--color-text-primary)] leading-[1.08]"
              >
                Real engineering progress.{" "}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500 dark:from-blue-400 dark:via-indigo-400 dark:to-emerald-400 bg-clip-text text-transparent">
                  Zero status-report theatre.
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className="text-base sm:text-lg text-[var(--color-text-secondary)] max-w-2xl mx-auto lg:mx-0 leading-relaxed"
              >
                ProWise links task execution directly to commits, pull requests, and CI checks
                across nine specialized organization roles—calculating weighted completion against
                an explicit <span className="font-semibold text-[var(--color-text-primary)]">Denominator = Baseline + Approved Expansions</span>.
              </motion.p>

              {/* Hero CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-1"
              >
                <MagneticWrapper strength={0.22}>
                  <Link href={appDashboardUrl}>
                    <Button
                      size="lg"
                      className="shadow-lg shadow-blue-500/25 px-6"
                    >
                      <span>Get Started</span>
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </MagneticWrapper>

                <MagneticWrapper strength={0.16}>
                  <Link href="/signup">
                    <Button variant="secondary" size="lg" className="px-5">
                      Sign Up Free
                    </Button>
                  </Link>
                </MagneticWrapper>

              </motion.div>

              {/* Micro-Metrics Row */}
              <RevealBlock delay={0.3}>
                <div className="pt-4 grid grid-cols-3 gap-3 sm:gap-5 border-t border-[var(--color-border)] max-w-lg mx-auto lg:mx-0">
                  <div>
                    <div className="text-xl sm:text-2xl font-extrabold text-[var(--color-text-primary)] tabular-nums">
                      9 Roles
                    </div>
                    <div className="text-[11px] sm:text-xs text-[var(--color-text-muted)]">
                      Scoped permission views
                    </div>
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      Git + CI
                    </div>
                    <div className="text-[11px] sm:text-xs text-[var(--color-text-muted)]">
                      Webhook-verified Done
                    </div>
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-extrabold text-blue-600 dark:text-blue-400 tabular-nums flex items-center justify-center lg:justify-start gap-1">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>100%</span>
                    </div>
                    <div className="text-[11px] sm:text-xs text-[var(--color-text-muted)]">
                      Audit-logged scope changes
                    </div>
                  </div>
                </div>
              </RevealBlock>
            </div>

            {/* Interactive 3D Floating SaaS Preview */}
            <motion.div
              initial={{ opacity: 0, y: 26, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.65, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-6"
            >
              <Hero3DPreview />
            </motion.div>
          </div>
        </section>

        {/* All Scroll-Animated Landing Sections */}
        <LandingSections
          currentOrgId={currentOrg.id}
          appDashboardUrl={appDashboardUrl}
        />
      </main>
    </div>
  );
}
