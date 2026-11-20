"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Bell, GitBranch, Globe, Save } from "lucide-react";
import { developerApi, DeveloperPreferences } from "@/lib/developer-api";
import { toast } from "sonner";
import { useThemeStore } from "@/store/theme-store";

export default function DeveloperSettingsPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { setTheme } = useThemeStore();

  const [emailNotifs, setEmailNotifs] = useState(true);
  const [slackNotifs, setSlackNotifs] = useState(false);
  const [themePref, setThemePref] = useState("system");
  const [githubUser, setGithubUser] = useState("alex-rivera-dev");
  const [timezone, setTimezone] = useState("America/New_York");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    developerApi.getPreferences().then((pref) => {
      if (pref) {
        setEmailNotifs(pref.emailNotifications);
        setSlackNotifs(pref.slackNotifications);
        setThemePref(pref.theme || "system");
        if (pref.githubUsername) setGithubUser(pref.githubUsername);
        if (pref.timezone) setTimezone(pref.timezone);
      }
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await developerApi.updatePreferences({
      emailNotifications: emailNotifs,
      slackNotifications: slackNotifs,
      theme: themePref,
      githubUsername: githubUser,
      timezone,
    });
    if (themePref === "dark" || themePref === "light" || themePref === "system") {
      setTheme(themePref as any);
    }
    setSaving(false);
    toast.success("Developer preferences saved successfully");
  };

  return (
    <PanelLayout
      title="Developer Settings"
      breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Settings" }]}>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h2 className="text-xl font-bold text-app-text-primary">Developer Preferences</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Manage your personal engineering notifications, GitHub integration handle, and IDE appearance.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Notification Preferences */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-app-border pb-3">
              <Bell className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-app-text-primary">Notification Dispatch</h3>
            </div>
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-app-text-primary block">
                    Email Digest &amp; Due Date Alerts
                  </span>
                  <span className="text-[11px] text-app-text-secondary">
                    Receive weekly individual check-in reminders and deadline warnings via email.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={emailNotifs}
                  onChange={(e) => setEmailNotifs(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-app-border">
                <div>
                  <span className="text-xs font-semibold text-app-text-primary block">
                    Slack Webhook Notifications
                  </span>
                  <span className="text-[11px] text-app-text-secondary">
                    Post task reviews and blocker resolutions to the engineering Slack channel.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={slackNotifs}
                  onChange={(e) => setSlackNotifs(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
              </label>
            </div>
          </Card>

          {/* GitHub Identity */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-app-border pb-3">
              <GitBranch className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-bold text-app-text-primary">GitHub Profile Mapping</h3>
            </div>
            <div>
              <label className="text-xs font-medium text-app-text-primary block mb-1">
                GitHub Username / Handle
              </label>
              <Input
                value={githubUser}
                onChange={(e) => setGithubUser(e.target.value)}
                placeholder="e.g. alex-rivera-dev"
                className="text-xs max-w-sm"
              />
              <p className="text-[11px] text-app-text-secondary mt-1">
                Used to link pull request commits and reviews automatically to your ProWise developer account.
              </p>
            </div>
          </Card>

          {/* Appearance & Timezone */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-app-border pb-3">
              <Globe className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-app-text-primary">Localization &amp; Interface Theme</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-app-text-primary block mb-1">
                  Interface Theme
                </label>
                <select
                  value={themePref}
                  onChange={(e) => setThemePref(e.target.value)}
                  className="w-full rounded-md border border-app-border bg-app-bg p-2 text-xs text-app-text-primary"
                >
                  <option value="system">System Default</option>
                  <option value="light">Light Theme</option>
                  <option value="dark">Dark Theme</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-app-text-primary block mb-1">
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-md border border-app-border bg-app-bg p-2 text-xs text-app-text-primary"
                >
                  <option value="America/New_York">Eastern Time (US &amp; Canada) - New York</option>
                  <option value="America/Chicago">Central Time (US &amp; Canada) - Chicago</option>
                  <option value="America/Los_Angeles">Pacific Time (US &amp; Canada) - Los Angeles</option>
                  <option value="Europe/London">London (GMT / BST)</option>
                  <option value="Asia/Kolkata">India Standard Time (IST)</option>
                  <option value="UTC">Coordinated Universal Time (UTC)</option>
                </select>
              </div>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="gap-1.5 text-xs">
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? "Saving..." : "Save Preferences"}</span>
            </Button>
          </div>
        </form>
      </div>
    </PanelLayout>
  );
}
