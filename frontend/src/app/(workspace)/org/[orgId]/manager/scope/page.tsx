"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { PlusCircle, FileCheck, Layers } from "lucide-react";
import { toast } from "sonner";

export default function ManagerScopePage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const { baselines, approveScopeAddition } = useProjectStore();

  const [isAddScopeOpen, setIsAddScopeOpen] = useState(false);
  const [leafTitle, setLeafTitle] = useState("Automated Compliance Audit Trail");
  const [leafWeight, setLeafWeight] = useState(25);
  const [reason, setReason] = useState("Approved expansion per Regulatory M12 requirements");

  const handleApprove = (e: React.FormEvent) => {
    e.preventDefault();
    approveScopeAddition("proj-structured-cds", leafTitle, leafWeight, reason, "usr-manager");
    setIsAddScopeOpen(false);
    toast.success(`Baseline expanded! Added ${leafWeight} points to denominator.`);
  };

  return (
    <PanelLayout
      title="Scope &amp; Baselines Management"
      breadcrumb={[
        { label: "Project Manager", href: `/org/${orgId}/manager` },
        { label: "Scope & Baselines" },
      ]}
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-app-text-primary">Approved Baselines</h2>
            <p className="text-xs text-app-text-secondary mt-0.5">
              Blueprint V1.1 Rule D03: Denominators expand only via formally recorded scope approvals.
            </p>
          </div>
          <Button size="sm" onClick={() => setIsAddScopeOpen(true)}>
            <PlusCircle className="w-3.5 h-3.5 mr-1" /> Approve Scope Addition (+25 pts)
          </Button>
        </div>

        <div className="space-y-6">
          {baselines.map((b) => (
            <Card key={b.id} className="p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-app-border">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-app-text-primary">
                      Baseline Version {b.version}
                    </span>
                    <Badge variant="default">{b.totalWeight} Total {b.unit}</Badge>
                  </div>
                  <p className="text-xs text-app-text-muted mt-0.5">{b.reason}</p>
                </div>
                <span className="text-xs text-app-text-muted">
                  Approved on {new Date(b.approvedAt).toLocaleDateString()}
                </span>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-app-text-primary">Eligible Leaves:</span>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Leaf Title</TableHead>
                      <TableHead>Approved Weight</TableHead>
                      <TableHead>Eligible Status</TableHead>
                      <TableHead>Done Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {b.leaves.map((leaf, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-xs">{leaf.title}</TableCell>
                        <TableCell className="font-semibold text-xs">{leaf.weight} pts</TableCell>
                        <TableCell>
                          <Badge variant="success">Eligible</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={leaf.isDone ? "success" : "warning"}>
                            {leaf.isDone ? "Accepted" : "In Progress / Review"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Dialog
        isOpen={isAddScopeOpen}
        onClose={() => setIsAddScopeOpen(false)}
        title="Approve Scope Change"
        description="Expands baseline denominator and updates progress percentage mathematically."
      >
        <form onSubmit={handleApprove} className="space-y-4 pt-2">
          <Input
            label="Work Item Title"
            value={leafTitle}
            onChange={(e) => setLeafTitle(e.target.value)}
            required
          />

          <Input
            label="Approved Points / Weight"
            type="number"
            value={leafWeight}
            onChange={(e) => setLeafWeight(parseInt(e.target.value) || 25)}
            required
          />

          <Input
            label="Mandatory Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-app-border">
            <Button type="button" variant="outline" onClick={() => setIsAddScopeOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Commit Approved Scope</Button>
          </div>
        </form>
      </Dialog>
    </PanelLayout>
  );
}

