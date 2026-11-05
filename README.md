# ProWise — Project Delivery Management SaaS Frontend

> **Software Requirements and Development Blueprint V1.1 (Dated 2 November 2026)**  
> Built as a production-grade, Google Workspace-inspired, responsive Next.js App Router application.

---

## 1. Executive Architecture & Mission

ProWise is an enterprise-grade Project Delivery Management SaaS that enforces **mathematical certainty** rather than artificial percentage estimates.

It natively supports two distinct operational modes:
- **Mode A (Individual Ownership):** Designed for one accountable developer with **no compulsory task boards or backlogs**. Progress is reported directly via weekly check-in submissions with append-only history and mandatory explanations for downward revisions.
- **Mode B (Structured Delivery):** Designed for teams with an approved scope baseline. Progress is computed mathematically:
  $$\text{Progress} = \frac{\sum \text{Eligible Done Leaf Weights}}{\sum \text{Active Approved Baseline Weights}} \times 100$$
  Reopened work immediately revokes completion credit. Revisions prevent stale approvals.

---

## 2. Technology Stack

- **Framework:** Next.js 14 App Router
- **Language:** TypeScript 5.7 (Strict type checking, 0 errors)
- **Styling:** Tailwind CSS with Google Workspace semantic theme tokens (Light & Dark mode)
- **State Management:** Zustand (reactive stores for Auth, Projects, Baselines, Check-ins, Reviews)
- **Component Primitives:** Accessible, Radix/Google-styled UI components (`Button`, `Card`, `Table`, `Badge`, `Dialog`, `Input`, `ProgressBar`, `HealthBadge`)
- **Icons:** Lucide React
- **Notifications:** Sonner Toast system
- **CSV Security:** OWASP Spreadsheet Formula Injection defense (`=`, `+`, `-`, `@` cell sanitization)

---

## 3. Visual Design System (Google Workspace-Inspired)

Semantic theme tokens mapped in `src/styles/globals.css` and `tailwind.config.ts`:

### Light Palette
- **App Background:** `#F8FAFD`
- **Surface:** `#FFFFFF`
- **Sidebar:** `#F6F8FC`
- **Primary Text:** `#202124`
- **Secondary Text:** `#5F6368`
- **Accent:** `#2563EB`
- **Borders:** `#E2E8F0`
- **Hover Surface:** `#EEF3FB`

### Dark Palette
- **App Background:** `#111318`
- **Surface:** `#1B1E24`
- **Sidebar:** `#171A20`
- **Elevated Surface:** `#252932`
- **Primary Text:** `#E8EAED`
- **Secondary Text:** `#A9B0BA`
- **Accent:** `#8AB4F8`
- **Borders:** `#343943`

---

## 4. Nine Distinct Role Panels

| # | Role Panel | Route | Description & Boundary |
|---|------------|-------|------------------------|
| 1 | **Super Admin** | `/super-admin` | Multi-tenant commercial SaaS governance, billing, operator roster, security controls, audit logs. Private tenant project data remains strictly isolated. |
| 2 | **Platform Operator** | `/platform-operator` | Webhook logs, mock retry execution, queue monitoring, support tickets, time-limited elevated access requests. |
| 3 | **Organization Owner** | `/org/[orgId]/owner` | Workspace creation, member invitations, teams, policy & work calendar, ownership transfer with last-owner restriction check. |
| 4 | **Organization Admin** | `/org/[orgId]/admin` | Member management, team creation, GitHub repository linking, activity stream. Cannot self-demote or transfer ownership. |
| 5 | **Project Manager** | `/org/[orgId]/manager` | 5-Step Create Project Wizard, scope baseline approvals, deadline management with reasons, delivery acceptance review gates. |
| 6 | **Team Lead** | `/org/[orgId]/lead` | Squad sprint coordination, work item assignments, Finish-to-Start dependency graph, blocker tracking, capacity workload. |
| 7 | **Developer** | `/org/[orgId]/developer` | Dedicated Developer Dashboard with direct access to **Solo Check-in (Mode A)** and **Structured Kanban/Timeline (Mode B)**. |
| 8 | **QA / Reviewer** | `/org/[orgId]/reviewer` | Review queue, checklist inspection, approval with progress credit, rework requests with mandatory explanation, stale review conflict checks (409). |
| 9 | **Viewer / Stakeholder** | `/org/[orgId]/viewer` | Read-only portfolio summaries, delivery timelines, milestones. All mutation controls and exports are restricted. |

---

## 5. Verification Test Scenarios (Prompt Section 18)

All 15 master test scenarios are automated in `scripts/verify-all-scenarios.mjs` and interactive in the UI via the top **Blueprint V1.1 Quick Navigator Banner**:

1. **Role Routing & Authentication:** 1-Click login profiles for all 9 roles at `/login`.
2. **Organization Switching:** Tenant switcher reauthorizes scoped workspace boundaries.
3. **Owner Workflows:** Single-use invitation generation, secret token rotation, and last-owner protection.
4. **Project Creation Wizard:** 5-step wizard allowing Solo projects with zero tasks or Structured projects.
5. **Scenario 5 (Solo 45% Check-In):** Accountable developer submits 45% progress with accomplishments and next steps.
6. **Scenario 6 (Append-Only Revisions):** Subsequent check-in preserves history; downward revision requires explanation.
7. **Scenario 7 (Structured 50/100 = 50%):** Reference fixture CRM-100 starts at 50 points Done out of 100.
8. **Scenario 8 (AS-08: Add 25 pts Scope):** PM approves 25-point leaf, expanding denominator to 125, recalculating progress to **40% (50/125)**.
9. **Scenario 9 (Reopen 30 pts API):** Reopening CRM-102 immediately revokes credit, dropping progress to **16% (20/125)**.
10. **Scenario 10 (Stale Review Conflict):** Reviewing an older revision triggers `409 STALE_REVIEW` conflict.
11. **Scenario 11 (Viewer Read-Only):** Stakeholders can read on-screen summaries; export is protected by `report.export` permission.
12. **Scenario 12 (GitHub Evidence):** Commits and PRs appear in activity feeds without advancing delivery credit.
13. **Scenario 13 (Delivery Acceptance):** Reaching 100% requires checklist signoff before transitioning to `DELIVERED` and `CLOSED`.
14. **Scenario 14 (Theme Consistency):** Light and dark mode support across all 9 panels and modal dialogs.
15. **Scenario 15 (Responsive Shell):** Collapsible sidebar, mobile drawer, and responsive tables.

---

## 6. Installation & Execution

```bash
# 1. Install dependencies
npm install

# 2. Run automated test suite verifying all Blueprint math and rules
node scripts/verify-all-scenarios.mjs

# 3. Start local development server
npm run dev

# 4. Build production bundle
npm run build
```

---

## 7. Implementation Checklist

- [x] **Complete:** All 9 Role-Based Panels and Dashboards
- [x] **Complete:** Mode A (Individual Solo Check-In) & Mode B (Structured Kanban, List & Timeline)
- [x] **Complete:** 5-Step Create Project Wizard
- [x] **Complete:** Blueprint V1.1 Progress Formulas & Reference Fixtures (50% &rarr; 40% &rarr; 16%)
- [x] **Complete:** Deterministic Health Precedence (Delayed &gt; At Risk &gt; Unknown &gt; On Track)
- [x] **Complete:** OWASP Spreadsheet Formula Injection Protection
- [x] **Complete:** Top Role Test Banner for 1-click verification of all scenarios
- [x] **Complete:** Production Build Verification (Next.js 14 App Router, 0 Type Errors)
- [x] **Mocked:** Backend REST API adapter in `src/proxy.ts` (ready for direct Spring Boot `/v1` replacement)
- [x] **Deferred:** Live Spring Boot backend, live PostgreSQL migrations, live GitHub App webhook callbacks (per frontend-only master prompt instructions)

