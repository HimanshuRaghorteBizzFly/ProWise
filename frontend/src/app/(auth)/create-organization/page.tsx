"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { establishSession } from "@/lib/session";
import { switchWorkspace } from "@/lib/workspace-switch";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function CreateOrganizationPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.length < 2) {
      toast.error("Organization name must be at least 2 characters");
      return;
    }

    try {
      const organization = await apiClient.createOrganization({
        name,
        slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        timezone,
        calendar: { workDays: [1, 2, 3, 4, 5], dailyHours: 8, holidays: [] },
      });
      // Bind the session to the new organization (the creator is its Owner), then land from the server session.
      const switched = await switchWorkspace(organization.id);
      if (!switched.ok) throw new Error(switched.message);
      const session = await establishSession();
      toast.success(`Organization ${name} created!`);
      router.replace(session.activeOrgId === organization.id ? session.target : `/org/${organization.id}/owner/dashboard`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create the organization.");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] text-[var(--color-text-primary)] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <span className="text-2xl font-black tracking-tight text-primary-600 dark:text-primary-400">
            ProWise
          </span>
          <h1 className="text-xl font-bold mt-2">Create an organization</h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Establish your tenant workspace for projects, teams, and delivery governance.
          </p>
        </div>

        <Card className="p-6 shadow-sm border border-[var(--color-border)] bg-[var(--color-surface)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Organization Name
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 absolute left-3 top-2.5 text-[var(--color-text-muted)]" />
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-"));
                  }}
                  placeholder="e.g. Acme Corporation"
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Workspace URL Slug
              </label>
              <Input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="acme-corp"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Operational Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text-primary)]"
              >
                <option value="America/New_York">America/New_York (UTC-5)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (UTC-8)</option>
                <option value="Europe/London">Europe/London (UTC+0)</option>
                <option value="Asia/Kolkata">Asia/Kolkata (UTC+5:30)</option>
                <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
              </select>
            </div>

            <Button type="submit" className="w-full">
              <span>Launch Workspace</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
