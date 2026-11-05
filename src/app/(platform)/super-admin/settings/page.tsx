"use client";

import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminSettingsPage() {
  return (
    <PanelLayout
      title="Platform Settings &amp; Defaults"
      breadcrumb={[
        { label: "Super Admin", href: "/super-admin" },
        { label: "Settings" },
      ]}
    >
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Global Platform Policies</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Configure system default parameters and operational tolerances.
          </p>
        </div>

        <Card className="p-6 space-y-4">
          <CardTitle className="text-sm">Default Cadence &amp; Grace Tolerances</CardTitle>
          <div className="space-y-4 text-xs">
            <Input
              label="Standard Check-in Grace Period (Working Days)"
              type="number"
              defaultValue={1}
            />
            <Input
              label="Stale Webhook Quarantine Threshold (Minutes)"
              type="number"
              defaultValue={15}
            />
            <Input
              label="Audit Log Retention Duration (Days)"
              type="number"
              defaultValue={365}
            />
          </div>

          <div className="pt-4 border-t border-app-border flex justify-end">
            <Button size="sm" onClick={() => toast.success("Platform settings saved.")}>
              Save Global Policies
            </Button>
          </div>
        </Card>
      </div>
    </PanelLayout>
  );
}

