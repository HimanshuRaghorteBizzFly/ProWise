"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  GitBranch,
  Layers,
  Lock,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AnimatedCounter,
  MagneticWrapper,
  RevealBlock,
  Tilt3DCard,
} from "./MotionPrimitives";

const FEATURES = [
  {
    title: "Mathematical Baseline Rollups",
    desc: "Progress comes straight from approved leaf work weights divided by the locked baseline—never intuition.",
    icon: BarChart3,
    tone: "from-blue-600 to-indigo-600",
    badge: "Mode B Core",
  },
  {
    title: "Append-Only Check-in Ledger",
    desc: "Individual developers log weekly percentages, blockers, and downward revisions with full immutable history.",
    icon: Clock,
    tone: "from-teal-600 to-emerald-600",
    badge: "Mode A Core",
  },
  {
    title: "Finish-to-Start Cycle Guards",
    desc: "Dependency graphs detect circular blockers automatically before they distort delivery forecasts.",
    icon: Layers,
    tone: "from-violet-600 to-purple-600",
    badge: "Graph Engine",
  },
  {
    title: "GitHub Evidence Synchronization",
    desc: "Connect commits, pull requests, and QA verifications to delivery milestones without manual status nagging.",
    icon: GitBranch,
    tone: "from-sky-600 to-cyan-600",
    badge: "Live Evidence",
  },
  {
    title: "Zero Standing Access & RBAC",
    desc: "Nine strictly isolated panels enforce least privilege from Super Admin down to read-only Stakeholders.",
    icon: Lock,
    tone: "from-rose-600 to-orange-500",
    badge: "Enterprise RBAC",
  },
  {
    title: "Deterministic Health Status",
    desc: "Clear On Track, At Risk, Delayed, or Unknown signals derived transparently from baseline dates.",
    icon: ShieldCheck,
    tone: "from-amber-600 to-orange-500",
    badge: "V1.1 Blueprint",
  },
];

const HOW_IT_WORKS_STEPS = [
  {
    step: "01",
    title: "Pick Your Project Delivery Mode",
    desc: "Choose Individual Ownership for solo engineering tracks or Structured Delivery for multi-team weighted baselines.",
    accent: "bg-blue-600",
  },
  {
    step: "02",
    title: "Lock Baseline & Capture Real Evidence",
    desc: "Track weekly check-ins, linked GitHub PRs, dependencies, and formal QA approvals—revisions prevent stale sign-offs.",
    accent: "bg-indigo-600",
  },
  {
    step: "03",
    title: "Verify Deterministic Health & Sign Off",
    desc: "Reaching 100% opens a formal acceptance gate instead of silent auto-closing, preserving audit-ready trust.",
    accent: "bg-teal-600",
  },
];

const DASHBOARD_TABS = [
  {
    id: "structured",
    label: "Structured Delivery",
    path: "/org/org-acme/developer/projects/proj-structured-cds/structured",
    headline: "CDS API Core Platform — Baseline v2.4",
    kpis: [
      { k: "Approved Baseline", v: "125 Points" },
      { k: "Completed Leaves", v: "80 Points" },
      { k: "Calculated Progress", v: "64.0%" },
      { k: "Health Signal", v: "On Track" },
    ],
    highlights: [
      "Reopening any completed leaf task deducts baseline percentage immediately.",
      "Baseline revision history shows exact scope delta (+25 pts added in Rev 2.4).",
      "QA Reviewer approval checks version match to reject stale task approvals.",
    ],
  },
  {
    id: "developer",
    label: "Developer Individual Mode",
    path: "/org/org-acme/developer",
    headline: "Individual Accountable Track — No Backlog Bloat",
    kpis: [
      { k: "Current Report", v: "78% Complete" },
      { k: "Revision Trail", v: "6 Immutable Entries" },
      { k: "Active Blockers", v: "1 Escalated" },
      { k: "Sign-off Gate", v: "Requires 100% Review" },
    ],
    highlights: [
      "Designed for senior solo engineers without forced sub-task micromanagement.",
      "Downward percentage revisions prompt a brief audit note for transparency.",
      "Links pull requests cleanly alongside narrative weekly progress.",
    ],
  },
  {
    id: "admin",
    label: "Organization Admin",
    path: "/org/org-acme/admin",
    headline: "Tenant Policy, GitHub Repos & Team Governance",
    kpis: [
      { k: "Active Teams", v: "6 Engineering Squads" },
      { k: "GitHub Synced", v: "18 Repositories" },
      { k: "Role Grants", v: "42 Members Verified" },
      { k: "Compliance State", v: "Enforced" },
    ],
    highlights: [
      "Manage repository links, invite engineers, and enforce review checklists.",
      "Isolated tenant boundary keeps customer delivery records completely private.",
      "Audit feed tracks permission changes and workspace configuration.",
    ],
  },
  {
    id: "operator",
    label: "Platform Operator",
    path: "/platform-operator",
    headline: "Delegated Operations, Incidents & Webhook Retries",
    kpis: [
      { k: "Service Availability", v: "99.98%" },
      { k: "Webhook Delivery", v: "99.4% Clean" },
      { k: "Active Triage", v: "Connected Workflows" },
      { k: "Approval Scope", v: "Super Admin Routed" },
    ],
    highlights: [
      "Alerts escalate cleanly into incidents, tickets, and Super Admin approvals.",
      "Operators inspect human-readable webhook summaries without raw payload exposure.",
      "Zero standing access: temporary troubleshooting requires time-boxed authorization.",
    ],
  },
];

const PRICING_TIERS = [
  {
    name: "Starter",
    tagline: "For small engineering teams adopting clear ownership.",
    monthly: 0,
    annual: 0,
    color: "from-sky-500 to-cyan-500",
    features: ["Up to 10 workspace members", "Individual & Structured projects", "Weekly check-in ledger", "Standard email support"],
    popular: false,
  },
  {
    name: "Pro",
    tagline: "For growing SaaS product orgs enforcing baseline accuracy.",
    monthly: 49,
    annual: 39,
    color: "from-blue-600 to-indigo-600",
    features: ["Up to 50 team members", "Baseline revision & QA gates", "GitHub PR evidence sync", "Dependency cycle detection"],
    popular: true,
  },
  {
    name: "Business",
    tagline: "Multi-team governance with SLA monitoring and priority triage.",
    monthly: 129,
    annual: 103,
    color: "from-amber-500 to-orange-500",
    features: ["Up to 150 members & unlimited projects", "Platform Operator ticket routing", "1-year immutable audit archive", "Priority 24/7 response SLA"],
    popular: false,
  },
  {
    name: "Enterprise",
    tagline: "Dedicated isolation, custom RBAC, and executive reporting.",
    monthly: 299,
    annual: 239,
    color: "from-violet-600 to-purple-600",
    features: ["Unlimited seats & organizations", "Zero-standing-access approvals", "Custom SMTP & branded notices", "Dedicated compliance & SSO"],
    popular: false,
  },
];

const FAQS = [
  {
    q: "How does ProWise prevent inflated or artificial progress bars?",
    a: "In Structured Mode, completion is locked to Sum(Done Leaves) / Sum(Approved Baseline) × 100. Adding scope expands the denominator immediately, and reopening any completed work item revokes its percentage credit.",
  },
  {
    q: "When should teams choose Individual Mode vs Structured Mode?",
    a: "Choose Mode A (Individual Ownership) when one accountable engineer owns an initiative and shouldn't be slowed down by granular Kanban cards. Choose Mode B (Structured Delivery) for collaborative projects needing weighted deliverables, dependencies, and formal baseline snapshots.",
  },
  {
    q: "Can a Project Manager or Developer access Super Admin or billing rules?",
    a: "No. ProWise enforces strict isolation across all nine role panels. Platform Operators can triage incidents, retry webhooks, and submit drafts, while commercial pricing, tenant governance, and final approvals remain exclusive to Super Admin.",
  },
  {
    q: "How can I try all nine role dashboards right now?",
    a: "Use the role-switcher bar at the top of the page or click any of the Nine Role Panels below to jump straight into live interactive views without setup friction.",
  },
];

export function LandingSections({
  currentOrgId,
  appDashboardUrl,
}: {
  currentOrgId: string;
  appDashboardUrl: string;
}) {
  const router = useRouter();
  const prefersReducedMotion = Boolean(useReducedMotion());

  // Mode B interactive scope simulator
  const [donePoints, setDonePoints] = useState(50);
  const [baselinePoints, setBaselinePoints] = useState(100);
  const calculatedPct = ((donePoints / baselinePoints) * 100).toFixed(1);

  // Dashboard preview active tab
  const [activeTab, setActiveTab] = useState(DASHBOARD_TABS[0].id);
  const currentPreview = DASHBOARD_TABS.find((t) => t.id === activeTab) || DASHBOARD_TABS[0];

  // Billing toggle & FAQ open index
  const [annualBilling, setAnnualBilling] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const rolePanels = [
    { title: "1. Super Admin", path: "/super-admin", desc: "Commercial SaaS, tenant governance, billing, API health, audit logs.", badge: "Violet" },
    { title: "2. Platform Operator", path: "/platform-operator", desc: "Support ticketing, incident escalation, webhooks, failed job retries.", badge: "Teal" },
    { title: "3. Org Owner", path: `/org/${currentOrgId}/owner`, desc: "Workspace policies, member invitations, ownership transfer validation.", badge: "Blue" },
    { title: "4. Org Admin", path: `/org/${currentOrgId}/admin`, desc: "Team leads, repository integrations, membership, role grants.", badge: "Indigo" },
    { title: "5. Project Manager", path: `/org/${currentOrgId}/manager`, desc: "Create Project Wizard, scope baselines, deadlines, delivery approvals.", badge: "Emerald" },
    { title: "6. Team Lead", path: `/org/${currentOrgId}/lead`, desc: "Task assignments, team dependencies, blockers, capacity workload.", badge: "Sky" },
    { title: "7. Developer", path: `/org/${currentOrgId}/developer`, desc: "Interactive Individual Check-ins and Structured Kanban & Timeline.", badge: "Cyan" },
    { title: "8. QA / Reviewer", path: `/org/${currentOrgId}/reviewer`, desc: "Review queue, stale review conflict checks, test checklists.", badge: "Amber" },
    { title: "9. Viewer / Stakeholder", path: `/org/${currentOrgId}/viewer`, desc: "Read-only portfolio, milestone progress, restricted export.", badge: "Slate" },
  ];

  return (
    <>
      {/* Key Platform Statistics Band */}
      <section className="py-10 px-4 sm:px-6 lg:px-12 max-w-6xl mx-auto">
        <RevealBlock className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Isolated Role Panels", value: 9, suffix: "", sub: "Least-privilege RBAC" },
            { label: "Delivery Modes", value: 2, suffix: "", sub: "Individual & Structured" },
            { label: "Baseline Accuracy", value: 100, suffix: "%", sub: "Deterministic progress formula" },
            { label: "Artificial Estimates", value: 0, suffix: "", sub: "Evidence-verified check-ins" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 backdrop-blur-sm p-5 text-center space-y-1 shadow-subtle"
            >
              <p className="text-2xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                <AnimatedCounter value={stat.value} suffix={stat.suffix} />
              </p>
              <p className="text-xs sm:text-sm font-bold text-[var(--color-text-primary)]">{stat.label}</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">{stat.sub}</p>
            </div>
          ))}
        </RevealBlock>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-16 px-4 sm:px-6 lg:px-12 max-w-6xl mx-auto">
        <RevealBlock className="text-center max-w-2xl mx-auto space-y-3 mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
            <Zap className="w-3.5 h-3.5" />
            Core Capabilities
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[var(--color-text-primary)] tracking-tight">
            Engineered for High-Trust Software Delivery
          </h2>
          <p className="text-sm sm:text-base text-[var(--color-text-secondary)]">
            Every workflow respects engineering reality—combining rigid mathematical truth with effortless daily check-ins.
          </p>
        </RevealBlock>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, idx) => {
            const Icon = f.icon;
            return (
              <RevealBlock key={f.title} delay={idx * 0.06}>
                <Tilt3DCard className="p-6 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <span
                        className={cn(
                          "h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-sm transition-transform duration-300 group-hover:scale-105",
                          f.tone
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--color-text-secondary)]">
                        {f.badge}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-[var(--color-text-primary)]">{f.title}</h3>
                    <p className="mt-2 text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed">
                      {f.desc}
                    </p>
                  </div>
                </Tilt3DCard>
              </RevealBlock>
            );
          })}
        </div>
      </section>

      {/* How It Works */}
      <section
        id="how-it-works"
        className="py-16 border-y border-[var(--color-border)] bg-[var(--color-sidebar)]/70 px-4 sm:px-6 lg:px-12"
      >
        <div className="max-w-6xl mx-auto">
          <RevealBlock className="text-center max-w-2xl mx-auto space-y-2 mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              How It Works
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-text-primary)]">
              Three Deterministic Steps to Release Confidence
            </h2>
          </RevealBlock>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {HOW_IT_WORKS_STEPS.map((item, idx) => (
              <RevealBlock key={item.step} delay={idx * 0.1}>
                <Tilt3DCard className="p-6 h-full" maxTilt={5}>
                  <span
                    className={cn(
                      "inline-flex h-9 w-9 items-center justify-center rounded-xl text-xs font-extrabold text-white mb-4 shadow-sm",
                      item.accent
                    )}
                  >
                    {item.step}
                  </span>
                  <h3 className="text-base font-bold text-[var(--color-text-primary)]">{item.title}</h3>
                  <p className="mt-2 text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed">
                    {item.desc}
                  </p>
                </Tilt3DCard>
              </RevealBlock>
            ))}
          </div>
        </div>
      </section>

      {/* Individual vs Structured Mode + Interactive Math Simulator */}
      <section id="modes" className="py-16 px-4 sm:px-6 lg:px-12 max-w-6xl mx-auto">
        <RevealBlock className="text-center max-w-2xl mx-auto space-y-2 mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Dual Delivery Architecture
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-text-primary)]">
            Mode A: Individual vs. Mode B: Structured Delivery
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Never force solo work into fake subtasks—and never let multi-team baselines drift silently.
          </p>
        </RevealBlock>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
          <RevealBlock delay={0.05}>
            <Tilt3DCard className="p-7 h-full">
              <div className="h-11 w-11 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-600 dark:text-teal-400 flex items-center justify-center font-extrabold mb-4">
                A
              </div>
              <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
                Mode A: Individual Ownership
              </h3>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                Tailored for one accountable engineer. No compulsory task breakdown or backlog bloat.
                Weekly check-ins capture percentage, accomplished work, next steps, blockers, and downward revision notes.
              </p>
              <div className="mt-6 pt-4 border-t border-[var(--color-border)] space-y-2.5 text-xs text-[var(--color-text-secondary)]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Append-only correction history preserved</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>100% triggers acceptance request rather than auto-closing</span>
                </div>
              </div>
            </Tilt3DCard>
          </RevealBlock>

          <RevealBlock delay={0.12}>
            <Tilt3DCard className="p-7 h-full">
              <div className="h-11 w-11 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-extrabold mb-4">
                B
              </div>
              <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
                Mode B: Structured Delivery
              </h3>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                Progress calculated mathematically:{" "}
                <code className="text-xs bg-[var(--color-elevated)] border border-[var(--color-border)] px-1.5 py-0.5 rounded font-mono text-[var(--color-text-primary)]">
                  Sum(Done Leaves) / Sum(Approved Baseline) × 100
                </code>
                . Reopened items revoke credit immediately.
              </p>

              {/* Live Mathematical Formula Interactive Check */}
              <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--color-text-secondary)]">
                    Try Live Scope Math:
                  </span>
                  <span className="font-extrabold text-sm text-blue-600 dark:text-blue-400 tabular-nums">
                    {donePoints} / {baselinePoints} = {calculatedPct}%
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDonePoints(50);
                      setBaselinePoints(100);
                    }}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors",
                      baselinePoints === 100
                        ? "border-blue-500 bg-blue-500/15 text-blue-700 dark:text-blue-300"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]"
                    )}
                  >
                    Baseline v1 (50 / 100 = 50%)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDonePoints(50);
                      setBaselinePoints(125);
                    }}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors",
                      baselinePoints === 125
                        ? "border-blue-500 bg-blue-500/15 text-blue-700 dark:text-blue-300"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]"
                    )}
                  >
                    +25 Scope Expansion (50 / 125 = 40%)
                  </button>
                </div>
              </div>
            </Tilt3DCard>
          </RevealBlock>
        </div>
      </section>

      {/* Interactive Multi-Role Dashboard Preview */}
      <section
        id="preview"
        className="py-16 border-y border-[var(--color-border)] bg-[var(--color-sidebar)]/60 px-4 sm:px-6 lg:px-12"
      >
        <div className="max-w-6xl mx-auto space-y-8">
          <RevealBlock className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              Live Workspace Explorer
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-text-primary)]">
              Inspect Any Operational View Before Entering
            </h2>
          </RevealBlock>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {DASHBOARD_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "rounded-full px-4 py-2 text-xs font-semibold border transition-all",
                  activeTab === tab.id
                    ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentPreview.id}
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-8 shadow-xl space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    {currentPreview.label}
                  </span>
                  <h3 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)] mt-0.5">
                    {currentPreview.headline}
                  </h3>
                </div>
                <MagneticWrapper>
                  <Button size="sm" onClick={() => router.push(currentPreview.path)}>
                    <span>Open Live View</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </MagneticWrapper>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {currentPreview.kpis.map((item) => (
                  <div
                    key={item.k}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5"
                  >
                    <p className="text-[11px] text-[var(--color-text-muted)]">{item.k}</p>
                    <p className="text-sm sm:text-base font-bold text-[var(--color-text-primary)] mt-1">
                      {item.v}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {currentPreview.highlights.map((text) => (
                  <div
                    key={text}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)]/60 p-3.5 flex items-start gap-2 text-xs text-[var(--color-text-secondary)]"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* Nine Role Panels */}
      <section id="panels" className="py-16 px-4 sm:px-6 lg:px-12 max-w-6xl mx-auto">
        <RevealBlock className="text-center max-w-xl mx-auto space-y-2 mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-text-primary)]">
            Nine Purpose-Built Role Panels
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Strict role boundaries and least privilege. Click any panel to jump directly into its workspace.
          </p>
        </RevealBlock>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
          {rolePanels.map((p, idx) => (
            <RevealBlock key={p.title} delay={idx * 0.04}>
              <Tilt3DCard className="p-4.5 h-full" onClick={() => router.push(p.path)} maxTilt={6}>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-[var(--color-text-primary)]">{p.title}</h4>
                  <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1.5 leading-relaxed">{p.desc}</p>
              </Tilt3DCard>
            </RevealBlock>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section
        id="benefits"
        className="py-16 border-y border-[var(--color-border)] bg-[var(--color-sidebar)]/60 px-4 sm:px-6 lg:px-12"
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <RevealBlock className="lg:col-span-6 space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <Users className="w-3.5 h-3.5" />
              Why Engineering Orgs Switch
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-text-primary)] leading-tight">
              Built for Engineers, Project Leads, and SaaS Operators Alike
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              Replace disconnected spreadsheets, optimistic percentages, and shadow admin tooling with one unified Blueprint V1.1 platform.
            </p>
          </RevealBlock>

          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: "No Stale Sign-offs", desc: "Baseline revisions automatically invalidate outdated task approvals." },
              { title: "Audit-Ready Evidence", desc: "Immutable logs pair every check-in with PR links and decisions." },
              { title: "Delegated SaaS Ops", desc: "Platform Operators retry jobs & incidents without touching billing rules." },
              { title: "Light & Dark Theme Parity", desc: "Carefully tuned surface hierarchy tuned for extended technical review." },
            ].map((b, idx) => (
              <RevealBlock key={b.title} delay={idx * 0.06}>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-1.5 h-full">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-primary)]">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>{b.title}</span>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{b.desc}</p>
                </div>
              </RevealBlock>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 px-4 sm:px-6 lg:px-12 max-w-6xl mx-auto">
        <RevealBlock className="text-center max-w-2xl mx-auto space-y-4 mb-10">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Transparent SaaS Plans
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-text-primary)]">
            Predictable Pricing That Scales With Delivery Scope
          </h2>

          <div className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-1 text-xs">
            <button
              type="button"
              onClick={() => setAnnualBilling(false)}
              className={cn(
                "rounded-full px-4 py-1.5 font-semibold transition-colors",
                !annualBilling
                  ? "bg-blue-600 text-white"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setAnnualBilling(true)}
              className={cn(
                "rounded-full px-4 py-1.5 font-semibold transition-colors flex items-center gap-1.5",
                annualBilling
                  ? "bg-blue-600 text-white"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              <span>Annual</span>
              <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                Save 20%
              </span>
            </button>
          </div>
        </RevealBlock>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {PRICING_TIERS.map((tier, idx) => {
            const price = annualBilling ? tier.annual : tier.monthly;
            return (
              <RevealBlock key={tier.name} delay={idx * 0.06}>
                <Tilt3DCard
                  className={cn(
                    "p-6 h-full flex flex-col justify-between",
                    tier.popular && "border-blue-500/60 ring-1 ring-blue-500/40"
                  )}
                >
                  <div>
                    <div className={cn("h-1.5 w-14 rounded-full bg-gradient-to-r mb-4", tier.color)} />
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-extrabold text-[var(--color-text-primary)]">{tier.name}</h3>
                      {tier.popular && (
                        <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-bold text-white">
                          Most Popular
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1.5 min-h-[32px]">
                      {tier.tagline}
                    </p>

                    <div className="mt-5 pb-4 border-b border-[var(--color-border)] flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-[var(--color-text-primary)] tabular-nums">
                        ${price}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {price === 0 ? "forever" : "/ org / mo"}
                      </span>
                    </div>

                    <ul className="mt-4 space-y-2.5 text-xs text-[var(--color-text-secondary)]">
                      {tier.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6">
                    <Link href="/signup" className="block">
                      <Button variant={tier.popular ? "primary" : "secondary"} className="w-full" size="sm">
                        <span>{price === 0 ? "Start Free" : `Choose ${tier.name}`}</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                      </Button>
                    </Link>
                  </div>
                </Tilt3DCard>
              </RevealBlock>
            );
          })}
        </div>
      </section>

      {/* FAQ Section */}
      <section
        id="faq"
        className="py-16 border-t border-[var(--color-border)] bg-[var(--color-sidebar)]/60 px-4 sm:px-6 lg:px-12"
      >
        <div className="max-w-3xl mx-auto space-y-6">
          <RevealBlock className="text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Frequently Asked Questions
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-text-primary)]">
              Everything About Blueprint V1.1 &amp; Governance
            </h2>
          </RevealBlock>

          <div className="space-y-3">
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={item.q}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left text-sm font-bold text-[var(--color-text-primary)] hover:bg-[var(--color-hover)]/40 transition-colors"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200 shrink-0",
                        isOpen && "rotate-180"
                      )}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={prefersReducedMotion ? undefined : { height: 0, opacity: 0 }}
                        animate={prefersReducedMotion ? undefined : { height: "auto", opacity: 1 }}
                        exit={prefersReducedMotion ? undefined : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-4 text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed border-t border-[var(--color-border)]/60 pt-3">
                          {item.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final CTA Strip + Multi-Column Footer */}
      <footer className="mt-auto border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-12 py-12 grid grid-cols-1 md:grid-cols-4 gap-8 text-xs">
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
                P
              </div>
              <span className="text-base font-extrabold text-[var(--color-text-primary)]">ProWise V1.1</span>
            </div>
            <p className="text-[var(--color-text-secondary)] max-w-md leading-relaxed">
              Project Delivery Management with Mathematical Certainty. Built on Blueprint V1.1 with strict least-privilege role separation across nine panels.
            </p>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Link href="/signup">
                <Button size="sm">Get Started Free</Button>
              </Link>
              <Button size="sm" variant="secondary" onClick={() => router.push(appDashboardUrl)}>
                Open Application
              </Button>
            </div>
          </div>

          <div className="space-y-2.5">
            <p className="font-bold uppercase tracking-wider text-[10px] text-[var(--color-text-muted)]">
              Platform Sections
            </p>
            <ul className="space-y-1.5 text-[var(--color-text-secondary)]">
              <li><a href="#features" className="hover:text-[var(--color-text-primary)]">Core Features</a></li>
              <li><a href="#how-it-works" className="hover:text-[var(--color-text-primary)]">How It Works</a></li>
              <li><a href="#modes" className="hover:text-[var(--color-text-primary)]">Individual vs Structured</a></li>
              <li><a href="#pricing" className="hover:text-[var(--color-text-primary)]">Pricing Tiers</a></li>
              <li><a href="#faq" className="hover:text-[var(--color-text-primary)]">FAQ</a></li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <p className="font-bold uppercase tracking-wider text-[10px] text-[var(--color-text-muted)]">
              Access &amp; Auth
            </p>
            <ul className="space-y-1.5 text-[var(--color-text-secondary)]">
              <li><Link href="/login" className="hover:text-[var(--color-text-primary)]">Login</Link></li>
              <li><Link href="/signup" className="hover:text-[var(--color-text-primary)]">Sign Up</Link></li>
              <li><Link href="/super-admin" className="hover:text-[var(--color-text-primary)]">Super Admin Panel</Link></li>
              <li><Link href="/platform-operator" className="hover:text-[var(--color-text-primary)]">Platform Operator</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[var(--color-border)] py-5 px-4 text-center text-[11px] text-[var(--color-text-muted)]">
          ProWise Project Delivery Management SaaS · Built on Blueprint V1.1 (2 November 2026) · Light &amp; Dark Theme Parity
        </div>
      </footer>
    </>
  );
}
