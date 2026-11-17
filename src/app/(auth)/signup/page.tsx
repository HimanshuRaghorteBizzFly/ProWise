"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const { setCurrentOrg, setCurrentRole } = useAuthStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      // New organization created with the user as Organization Owner
      const newOrgId = `org-${orgName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
      setCurrentOrg({
        id: newOrgId,
        slug: orgName.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        name: orgName,
        ownerId: "usr-new",
        timezone,
        workCalendar: {
          workDays: [1, 2, 3, 4, 5],
          dailyHours: 8,
          holidays: [],
        },
        plan: "STARTER",
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
      });
      setCurrentRole("ORGANIZATION_OWNER");
      toast.success("Organization workspace registered successfully!");
      router.push(`/org/${newOrgId}/owner`);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-app-bg text-app-text-primary flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 rounded-xl bg-blue-600 items-center justify-center text-white font-bold text-xl shadow-md mb-3">
            P
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-app-text-primary">
            Create your ProWise Workspace
          </h1>
          <p className="text-sm text-app-text-secondary mt-1">
            Start delivering projects with mathematical certainty
          </p>
        </div>

        <Card className="p-6 shadow-modal space-y-4">
          <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-[11px] text-blue-800 dark:text-blue-300 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Public registration provisions you as an <strong>Organization Owner</strong>. Super Admin &amp; Platform Operator roles require explicit enterprise provisioning.
            </span>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <Input
              label="Your Full Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dr. Sarah Chen"
              required
            />

            <Input
              label="Work Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
            />

            <Input
              label="Organization / Workspace Name"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. Acme Health Technologies"
              required
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-app-text-secondary">
                Workspace Timezone (IANA)
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-app-border bg-app-surface px-3 py-1 text-sm text-app-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent"
              >
                <option value="America/New_York">America/New_York (EST / EDT)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST / PDT)</option>
                <option value="America/Chicago">America/Chicago (CST / CDT)</option>
                <option value="Europe/London">Europe/London (GMT / BST)</option>
                <option value="Europe/Paris">Europe/Paris (CET / CEST)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Register Workspace &amp; Proceed
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-app-text-secondary mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

