"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCw } from "lucide-react";
import { toast } from "sonner";

export default function OperatorFailedEventsPage() {
  return (
    <PanelLayout title="Dead Letter Queue & Failed Events" breadcrumb={[{ label: "Platform Operator", href: "/platform-operator" }, { label: "Failed Events" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Failed Webhooks & Background Messages</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Review unparseable or retried message payloads</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => toast.success("Replaying queue...")}>
            <RotateCw className="w-3.5 h-3.5 mr-1" /> Replay Queue
          </Button>
        </div>
        <Card className="p-6 text-center border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">Dead letter queue is currently empty. 0 dropped events.</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
