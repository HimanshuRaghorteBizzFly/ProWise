"use client";

import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Lock, KeyRound, Server } from "lucide-react";

export default function SuperAdminSecurityPage() {
  const controls = [
    { title: "Tenant Isolation Verification", status: "Enforced", detail: "Strict org_id composite indexing and server-side object authorization" },
    { title: "Formula Injection Mitigation", status: "Enforced", detail: "OWASP-compliant single-quote prefixing on all exported CSV cells" },
    { title: "Single-Use Invitation Secret Rotation", status: "Enforced", detail: "Hashed tokens invalidated upon resend, expiry, or first successful acceptance" },
    { title: "Last-Owner Protection Protocol", status: "Enforced", detail: "Self-demotion blocked; exactly one active owner enforced per workspace" },
  ];

  return (
    <PanelLayout
      title="Platform Security Governance"
      breadcrumb={[
        { label: "Super Admin", href: "/super-admin" },
        { label: "Security & Governance" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">OWASP ASVS &amp; Blueprint Compliance</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Cryptographic boundaries, least privilege, and tenancy verification controls.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {controls.map((c, idx) => (
            <Card key={idx} className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-app-text-primary">{c.title}</span>
                <Badge variant="success">{c.status}</Badge>
              </div>
              <p className="text-xs text-app-text-secondary leading-relaxed">{c.detail}</p>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}

