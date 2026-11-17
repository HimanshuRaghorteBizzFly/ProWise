"use client";

import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function ManagerDeliveryApprovalsPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const { acceptanceRequests, decideDeliveryAcceptance } = useProjectStore();

  return (
    <PanelLayout
      title="Delivery Acceptance Approvals"
      breadcrumb={[
        { label: "Project Manager", href: `/org/${orgId}/manager` },
        { label: "Delivery Approvals" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Formal Handover Gates</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Module M11: Delivery acceptance requires checklist verification and explicit stakeholder signoff.
          </p>
        </div>

        <div className="space-y-4">
          {acceptanceRequests.map((req) => (
            <Card key={req.id} className="p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-app-border">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-app-text-primary">
                      {req.projectName} ({req.projectKey})
                    </span>
                    <Badge variant={req.status === "ACCEPTED" ? "success" : "warning"}>
                      {req.status}
                    </Badge>
                  </div>
                  <span className="text-xs text-app-text-muted mt-0.5 block">
                    Mode: {req.mode} • Requested on {new Date(req.requestedAt).toLocaleDateString()}
                  </span>
                </div>

                {req.status === "PENDING" && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        decideDeliveryAcceptance(req.id, "CHANGES_REQUESTED", "usr-manager", "Checklist gaps detected");
                        toast.error("Changes requested.");
                      }}
                    >
                      Request Corrections
                    </Button>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        decideDeliveryAcceptance(req.id, "ACCEPTED", "usr-manager");
                        toast.success("Delivery accepted!");
                      }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Accept Delivery
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-app-text-primary">Acceptance Checklist:</span>
                <div className="space-y-1.5">
                  {req.checklist.map((c) => (
                    <div
                      key={c.id}
                      className="p-2.5 rounded-lg border border-app-border bg-app-sidebar/40 text-xs flex items-center justify-between"
                    >
                      <span className="text-app-text-primary">{c.text}</span>
                      <Badge variant={c.checked ? "success" : "secondary"}>
                        {c.checked ? "Verified" : "Pending"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}

