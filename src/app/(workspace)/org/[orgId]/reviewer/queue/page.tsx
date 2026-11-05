"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { WorkItem } from "@/types";

export default function ReviewerQueuePage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg, currentUser } = useAuthStore();
  const { workItems, reviewWorkItem } = useProjectStore();

  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const queue = workItems.filter((w) => w.state === "IN_REVIEW");

  const handleApprove = () => {
    if (!selectedItem) return;
    const res = reviewWorkItem(
      selectedItem.id,
      currentUser.id,
      "APPROVED",
      undefined,
      selectedItem.currentRevision
    );
    if (res.success) {
      toast.success(`Approved ${selectedItem.key}!`);
      setSelectedItem(null);
    }
  };

  return (
    <PanelLayout
      title="Pending Review Queue"
      breadcrumb={[
        { label: "Reviewer", href: `/org/${orgId}/reviewer` },
        { label: "Queue" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Assigned Verification Items</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Module M05: Required reviewer inspects criteria, evidence, and exact revision snapshot.
          </p>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Revision</TableHead>
                <TableHead>Criticality</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono font-bold text-xs text-blue-600">{item.key}</TableCell>
                  <TableCell className="font-semibold text-xs text-app-text-primary">{item.title}</TableCell>
                  <TableCell className="text-xs font-semibold">{item.weight} pts</TableCell>
                  <TableCell className="font-mono text-xs text-app-text-muted">
                    rev {item.submittedRevision || item.currentRevision}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.criticality === "CRITICAL" ? "danger" : "warning"}>
                      {item.criticality}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => setSelectedItem(item)}>
                      Inspect
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {queue.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-xs text-app-text-muted">
                    Queue is clear. No work items currently awaiting review.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {selectedItem && (
        <Dialog
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          title={`Review [${selectedItem.key}] ${selectedItem.title}`}
          description={`Inspecting revision ${selectedItem.submittedRevision || selectedItem.currentRevision}`}
        >
          <div className="space-y-4 pt-2 text-xs">
            <p className="p-3 bg-app-sidebar/60 rounded-lg border border-app-border text-app-text-secondary">
              <strong>Criteria:</strong> {selectedItem.criteria}
            </p>
            <div className="flex justify-end gap-2 pt-4 border-t border-app-border">
              <Button variant="outline" size="sm" onClick={() => setSelectedItem(null)}>
                Cancel
              </Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleApprove}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve Work
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </PanelLayout>
  );
}

