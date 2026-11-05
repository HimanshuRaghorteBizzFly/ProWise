"use client";
import React, { useState } from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Edit3, Send } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminEmailTemplatesPage() {
  const [templates] = useState([
    { id: "tmpl-1", name: "User Invitation", subject: "You've been invited to join {{organization_name}} on ProWise", category: "Auth" },
    { id: "tmpl-2", name: "Delivery Review Required", subject: "Action Required: {{project_name}} reached 100% progress", category: "Delivery" },
    { id: "tmpl-3", name: "Health Threshold Breach", subject: "Warning: Project {{project_key}} flagged as {{project_health}}", category: "Alert" },
    { id: "tmpl-4", name: "Invoice Receipt", subject: "Your ProWise SaaS Invoice for {{billing_period}} is ready", category: "Billing" },
  ]);

  return (
    <PanelLayout title="Email Templates" breadcrumb={[{ label: "Super Admin", href: "/super-admin" }, { label: "Email Templates" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">System Email Templates</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Manage automated transactional emails sent to organizations and users</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(t => (
            <Card key={t.id} className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{t.name}</span>
                <Badge variant="outline">{t.category}</Badge>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] font-mono bg-[var(--color-sidebar)] p-2 rounded border border-[var(--color-border)]">
                Subject: {t.subject}
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => toast.info(`Sending test email for ${t.name}...`)}>
                  <Send className="w-3.5 h-3.5 mr-1" /> Test
                </Button>
                <Button size="sm" onClick={() => toast.success(`Editing template ${t.name}`)}>
                  <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
