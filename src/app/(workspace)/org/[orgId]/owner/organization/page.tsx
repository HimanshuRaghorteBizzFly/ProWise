"use client";
import React, { useState } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Calendar, Clock, Globe } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function OwnerOrganizationPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { currentOrg, updateOrganization } = useWorkspaceStore();

  const [name, setName] = useState(currentOrg.name);
  const [timezone, setTimezone] = useState(currentOrg.timezone || "America/New_York");
  const [dailyHours, setDailyHours] = useState(currentOrg.workCalendar?.dailyHours || 8);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrganization(orgId, {
      name,
      timezone,
      workCalendar: {
        ...currentOrg.workCalendar,
        dailyHours,
      },
    });
    toast.success("Organization profile and calendar updated.");
  };

  return (
    <PanelLayout title="Organization Profile & Calendar" breadcrumb={[{ label: "Owner", href: `/org/${orgId}/owner` }, { label: "Organization" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Tenant Profile & Delivery Calendar</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Define corporate working days, daily hours, and default timezone used for grace period calculations.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <Card className="p-6 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary-600" /> General Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium block mb-1">Organization Name</label>
                <Input value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Tenant ID</label>
                <Input value={orgId} disabled className="opacity-60" />
              </div>
            </div>
          </Card>

          <Card className="p-6 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary-600" /> Work Calendar & Grace Days
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium block mb-1">Default Timezone</label>
                <select
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-xs"
                >
                  <option value="America/New_York">America/New_York (UTC-5)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (UTC-8)</option>
                  <option value="Europe/London">Europe/London (UTC+0)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (UTC+5:30)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Standard Daily Working Hours</label>
                <Input type="number" min={1} max={24} value={dailyHours} onChange={e => setDailyHours(Number(e.target.value))} required />
              </div>
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)]">
              ProWise health calculations exclude weekends and declared holidays when calculating grace periods.
            </p>
          </Card>

          <Button type="submit">Save Changes</Button>
        </form>
      </div>
    </PanelLayout>
  );
}
