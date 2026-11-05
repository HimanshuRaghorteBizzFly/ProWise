"use client";
import React, { useState } from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([
    { id: "anc-1", title: "Scheduled Maintenance Window", message: "ProWise will undergo scheduled API updates on Sunday, Nov 8 between 02:00 - 04:00 UTC.", active: true, date: "2026-11-04" },
    { id: "anc-2", title: "GitHub Webhook V2 Upgraded", message: "Repository sync throughput has been increased 5x with automated retries.", active: false, date: "2026-10-28" },
  ]);

  return (
    <PanelLayout title="Platform Announcements" breadcrumb={[{ label: "Super Admin", href: "/super-admin" }, { label: "Announcements" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Broadcast Announcements</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Create top-bar banners and alerts shown across all tenant workspaces</p>
          </div>
          <Button size="sm" onClick={() => toast.info("Creating new broadcast announcement...")}>
            <Plus className="w-4 h-4 mr-1.5" /> New Announcement
          </Button>
        </div>

        <div className="space-y-3">
          {announcements.map(a => (
            <Card key={a.id} className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 mt-1">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">{a.title}</h4>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">{a.message}</p>
                  <span className="text-[10px] text-[var(--color-text-muted)] mt-2 block">{a.date} • {a.active ? "Active" : "Archived"}</span>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => {
                setAnnouncements(announcements.filter(x => x.id !== a.id));
                toast.success("Announcement deleted");
              }}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
