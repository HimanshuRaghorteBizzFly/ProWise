"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Layers,
  ArrowRight,
  ShieldCheck,
  GitBranch,
  CheckCircle2,
  Users,
  Clock,
  Sparkles,
  BarChart3,
  Calendar,
  Lock,
} from "lucide-react";
import { useAuthStore, getRoleDashboardPath } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RoleTestBanner } from "@/components/navigation/role-test-banner";

export default function LandingPage() {
  const router = useRouter();
  const { currentRole, currentOrg } = useAuthStore();

  const appDashboardUrl = getRoleDashboardPath(currentRole, currentOrg.id);

  return (
    <div className="min-h-screen bg-app-bg text-app-text-primary flex flex-col">
      <RoleTestBanner />

      {/* Navigation Header */}
      <nav className="h-16 border-b border-app-border bg-app-surface/90 backdrop-blur-md px-6 lg:px-12 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
            P
          </div>
          <span className="text-lg font-bold tracking-tight text-app-text-primary">ProWise</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 font-semibold ml-1">
            V1.1
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-app-text-secondary">
          <a href="#modes" className="hover:text-app-text-primary transition-colors">
            Dual Delivery Modes
          </a>
          <a href="#blueprint" className="hover:text-app-text-primary transition-colors">
            V1.1 Blueprint
          </a>
          <a href="#panels" className="hover:text-app-text-primary transition-colors">
            Nine Role Panels
          </a>
          <a href="#health" className="hover:text-app-text-primary transition-colors">
            Deterministic Health
          </a>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          </Link>
          <Button size="sm" onClick={() => router.push(appDashboardUrl)}>
            <span>Open Application</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-6 lg:px-12 max-w-6xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Production SaaS Blueprint Dated 2 November 2026</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-app-text-primary max-w-4xl mx-auto leading-tight">
          Project Delivery Management with{" "}
          <span className="text-blue-600 dark:text-blue-400">Mathematical Certainty</span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-app-text-secondary max-w-2xl mx-auto leading-relaxed">
          Eliminate artificial progress estimates. ProWise provides one accountable developer with no
          compulsory tasks, or a structured team with weighted, approved work.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" onClick={() => router.push(appDashboardUrl)}>
            <span>Launch ProWise Workspace</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => router.push("/org/org-acme/developer/projects/proj-structured-cds/structured")}
          >
            <span>View CDS API Structured Fixture</span>
          </Button>
        </div>

        {/* Feature Grid */}
        <div id="modes" className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
          {/* Mode A */}
          <Card className="p-8 border-2 hover:border-blue-500/50 transition-all">
            <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 flex items-center justify-center font-bold mb-4">
              A
            </div>
            <h3 className="text-xl font-bold text-app-text-primary">Mode A: Individual Ownership</h3>
            <p className="mt-2 text-sm text-app-text-secondary leading-relaxed">
              Tailored for one accountable engineer. No compulsory task breakdown or backlog bloat.
              Weekly check-ins capture percentage, accomplished work, next steps, blockers, and downward revision explanations.
            </p>
            <div className="mt-6 pt-4 border-t border-app-border space-y-2 text-xs text-app-text-secondary">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>Append-only correction history preserved</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>100% triggers acceptance request rather than auto-closing</span>
              </div>
            </div>
          </Card>

          {/* Mode B */}
          <Card className="p-8 border-2 hover:border-blue-500/50 transition-all">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 flex items-center justify-center font-bold mb-4">
              B
            </div>
            <h3 className="text-xl font-bold text-app-text-primary">Mode B: Structured Delivery</h3>
            <p className="mt-2 text-sm text-app-text-secondary leading-relaxed">
              Progress calculated mathematically:{" "}
              <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">
                Sum(Done Leaves) / Sum(Approved Baseline) × 100
              </code>
              . Reopened items revoke credit immediately. Revisions prevent stale approvals.
            </p>
            <div className="mt-6 pt-4 border-t border-app-border space-y-2 text-xs text-app-text-secondary">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>Approved scope versions (e.g. 50/100 = 50% → 50/125 = 40%)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>Finish-to-Start dependency cycle detection &amp; separate blockers</span>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Nine Role Panels Showcase */}
      <section id="panels" className="py-16 bg-app-sidebar/60 border-t border-b border-app-border px-6 lg:px-12">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-app-text-primary">
            Nine Purpose-Built Role Panels
          </h2>
          <p className="mt-2 text-sm text-app-text-secondary max-w-xl mx-auto">
            Strict role boundaries and least privilege. Switch seamlessly between roles using the top test bar.
          </p>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
            {[
              { title: "1. Super Admin", path: "/super-admin", desc: "Commercial SaaS, tenant governance, billing, API health, audit logs." },
              { title: "2. Platform Operator", path: "/platform-operator", desc: "Support ticketing, incident escalation, webhooks, failed job retries." },
              { title: "3. Org Owner", path: `/org/${currentOrg.id}/owner`, desc: "Workspace policies, member invitations, ownership transfer validation." },
              { title: "4. Org Admin", path: `/org/${currentOrg.id}/admin`, desc: "Team leads, repository integrations, membership, role grants." },
              { title: "5. Project Manager", path: `/org/${currentOrg.id}/manager`, desc: "Create Project Wizard, scope baselines, deadlines, delivery approvals." },
              { title: "6. Team Lead", path: `/org/${currentOrg.id}/lead`, desc: "Task assignments, team dependencies, blockers, capacity workload." },
              { title: "7. Developer", path: `/org/${currentOrg.id}/developer`, desc: "Interactive Individual Check-ins and Structured Kanban & Timeline." },
              { title: "8. QA / Reviewer", path: `/org/${currentOrg.id}/reviewer`, desc: "Review queue, stale review conflict checks, test checklists." },
              { title: "9. Viewer / Stakeholder", path: `/org/${currentOrg.id}/viewer`, desc: "Read-only portfolio, milestone progress, restricted export." },
            ].map((p, idx) => (
              <Card
                key={idx}
                className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(p.path)}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-app-text-primary">{p.title}</h4>
                  <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <p className="text-xs text-app-text-secondary mt-1.5 leading-relaxed">{p.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-8 px-6 text-center text-xs text-app-text-muted border-t border-app-border">
        <p>ProWise Project Delivery Management SaaS • Built on Blueprint V1.1 (2 November 2026)</p>
        <p className="mt-1 text-[11px]">Strict Role Boundaries • Clean Google Workspace Aesthetics • Light &amp; Dark Theme</p>
      </footer>
    </div>
  );
}

