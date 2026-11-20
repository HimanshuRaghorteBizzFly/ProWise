"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { CalendarDays, FolderPlus, UserRound } from "lucide-react";

import { LaterActionButton, OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { PageHeader } from "@/components/owner/primitives";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Input, Textarea } from "@/components/ui/input";
import { mockApiOrganizationMembersForProjectCreation } from "@/lib/prowise-mock-adapters";
import { useManagerResource } from "@/hooks/useManagerResource";
import { useAuthStore } from "@/store/auth-store";
import type { Priority, ProjectMode } from "@/types";
import { ManagerResourceNotice } from "../_components/ManagerResourceNotice";

const loadEligibleMembers = (
  orgId: string,
  grants: Parameters<typeof mockApiOrganizationMembersForProjectCreation>[1],
) => mockApiOrganizationMembersForProjectCreation(orgId, grants).items;

const PRIORITIES: readonly Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const MODES: readonly ProjectMode[] = ["INDIVIDUAL", "STRUCTURED"];
const CADENCES = ["DAILY", "WEEKLY", "FORTNIGHTLY"] as const;
type Cadence = (typeof CADENCES)[number];

const isPriority = (value: string): value is Priority => PRIORITIES.some((item) => item === value);
const isMode = (value: string): value is ProjectMode => MODES.some((item) => item === value);
const isCadence = (value: string): value is Cadence => CADENCES.some((item) => item === value);

export default function CreateProjectWizard() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";
  const currentOrg = useAuthStore((state) => state.currentOrg);
  const currentUser = useAuthStore((state) => state.currentUser);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("HIGH");
  const [mode, setMode] = useState<ProjectMode>("STRUCTURED");
  const [accountableOwnerId, setAccountableOwnerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [cadence, setCadence] = useState<Cadence>("WEEKLY");
  const resource = useManagerResource({
    routeOrgId: orgId,
    name: "project-manager-project-creation-members",
    permission: "project.create",
    fixture: loadEligibleMembers,
  });
  const members = resource.state.status === "ready" ? resource.state.data : [];
  const invalidDateRange = Boolean(startDate && targetDate && targetDate < startDate);

  const pageHeader = (
    <PageHeader
      title="Create & plan project"
      description="Prepare the project record and initial delivery plan. Saving is not available until the backend task ships."
      simulationLabel={resource.state.status === "ready" ? "Sample data" : undefined}
    />
  );

  return (
    <PanelLayout
      title="Create & plan project"
      breadcrumb={[{ label: "Project Manager", href: `/org/${orgId}/manager` }, { label: "Create & plan" }]}
    >
      <div className="space-y-4 sm:space-y-6">
        {pageHeader}
        {resource.state.status === "ready" ? (
          <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
            <div className="space-y-4">
              <OwnerPanel
                title="Project record"
                description="Create a stable project key and choose its accountable owner."
              >
                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Project name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Project name"
                  />
                  <Input
                    label="Project key"
                    value={key}
                    onChange={(event) => setKey(event.target.value.toUpperCase())}
                    placeholder="e.g. CRM-200"
                    helperText="Stable project identifier; uniqueness is checked by the API when task 2.1 ships."
                  />
                </div>
                <div className="mt-4">
                  <Textarea
                    label="Description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe the planned project outcome"
                    rows={3}
                  />
                </div>
                <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-app-text-secondary">
                    Priority
                    <select
                      value={priority}
                      onChange={(event) => {
                        const nextPriority = event.target.value;
                        if (isPriority(nextPriority)) setPriority(nextPriority);
                      }}
                      className="h-9 min-w-0 rounded-lg border border-app-border bg-app-bg px-3 text-sm text-app-text-primary"
                    >
                      {PRIORITIES.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-app-text-secondary">
                    Delivery mode
                    <select
                      value={mode}
                      onChange={(event) => {
                        const nextMode = event.target.value;
                        if (isMode(nextMode)) setMode(nextMode);
                      }}
                      className="h-9 min-w-0 rounded-lg border border-app-border bg-app-bg px-3 text-sm text-app-text-primary"
                    >
                      <option value="INDIVIDUAL">Individual</option>
                      <option value="STRUCTURED">Structured</option>
                    </select>
                  </label>
                </div>
                <p className="mt-3 text-xs text-app-text-muted">
                  Individual: accountable developer reports progress; work items are optional. Structured: progress comes from an approved weighted baseline.
                </p>
              </OwnerPanel>

              <OwnerPanel
                title="Initial plan"
                description="Dates remain local calendar dates in the selected IANA timezone."
                actions={<OwnerLaterBadge task="2.3" />}
              >
                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                  <Input label="Target date" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
                  <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-app-text-secondary">
                    Reporting cadence
                    <select
                      value={cadence}
                      onChange={(event) => {
                        const nextCadence = event.target.value;
                        if (isCadence(nextCadence)) setCadence(nextCadence);
                      }}
                      className="h-9 min-w-0 rounded-lg border border-app-border bg-app-bg px-3 text-sm text-app-text-primary"
                    >
                      {CADENCES.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <Input
                    label="Project timezone"
                    value={currentOrg.timezone}
                    readOnly
                    helperText="Inherited from the active organization."
                  />
                </div>
                {invalidDateRange && (
                  <p role="alert" className="mt-3 text-sm text-red-600">
                    Target date must be on or after the start date.
                  </p>
                )}
              </OwnerPanel>

              <OwnerPanel
                title="Ownership"
                description="Record the current session and select an active organization member as accountable owner."
                actions={<OwnerLaterBadge task="2.1" />}
              >
                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="min-w-0 rounded-lg border border-app-border bg-app-bg p-3">
                    <p className="flex items-center gap-2 text-xs text-app-text-muted">
                      <UserRound aria-hidden="true" className="h-4 w-4" /> Current session
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-app-text-primary">{currentUser.name}</p>
                  </div>
                  <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-app-text-secondary">
                    Accountable owner
                    <select
                      value={accountableOwnerId}
                      onChange={(event) => setAccountableOwnerId(event.target.value)}
                      className="h-9 min-w-0 rounded-lg border border-app-border bg-app-bg px-3 text-sm text-app-text-primary"
                    >
                      <option value="">Select an active member</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>{member.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {members.length === 0 && (
                  <p className="mt-3 text-sm text-app-text-muted">No eligible active members are available in this organization.</p>
                )}
              </OwnerPanel>
            </div>

            <aside className="min-w-0 space-y-4">
              <OwnerPanel
                title="Plan preview"
                description="This preview is local to this page and is not saved."
              >
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-app-text-muted">Project</dt>
                    <dd className="break-words font-medium text-app-text-primary">{name || "Not entered"} {key && `(${key})`}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-app-text-muted">Mode</dt>
                    <dd className="font-medium text-app-text-primary">{mode}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-app-text-muted">Accountable owner</dt>
                    <dd className="break-words font-medium text-app-text-primary">
                      {members.find((member) => member.id === accountableOwnerId)?.name ?? "Not selected"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-app-text-muted">Schedule</dt>
                    <dd className="break-words font-medium text-app-text-primary">
                      {startDate || "Start date not set"} → {targetDate || "Target date not set"}
                    </dd>
                    <dd className="text-xs text-app-text-muted">{cadence} · {currentOrg.timezone}</dd>
                  </div>
                </dl>
                <div className="mt-4 rounded-lg border border-app-border p-3 text-xs text-app-text-secondary">
                  <CalendarDays aria-hidden="true" className="mb-1 h-4 w-4" />
                  No work items are required for an Individual project. Structured progress needs an approved baseline.
                </div>
              </OwnerPanel>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-app-border bg-app-surface p-4">
                <LaterActionButton title="Project creation ships with task 2.1">
                  <FolderPlus aria-hidden="true" className="h-3.5 w-3.5" />
                  Create project
                </LaterActionButton>
                <OwnerLaterBadge task="2.1" />
                <p className="w-full text-xs text-app-text-muted">The form does not create or mutate a project.</p>
              </div>
            </aside>
          </div>
        ) : (
          <ManagerResourceNotice
            orgMatches={resource.orgMatches}
            permissionStatus={resource.permissionStatus}
            resourceStatus={resource.state.status}
            permission={resource.permission}
            permissionName="project.create"
            laterTask="2.1"
            retry={resource.retry}
            retryPermissions={resource.permissionRetry}
          />
        )}
      </div>
    </PanelLayout>
  );
}
