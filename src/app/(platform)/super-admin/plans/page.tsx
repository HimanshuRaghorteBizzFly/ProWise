"use client";

import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layers, Check } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminPlansPage() {
  const plans = [
    { name: "Starter", price: "$499/mo", desc: "For boutique engineering consultancies", features: ["Up to 10 projects", "Solo & Structured mode", "Standard GitHub integration", "Community support"] },
    { name: "Professional", price: "$1,299/mo", desc: "For scaling venture-backed delivery teams", features: ["Up to 50 projects", "Unlimited repositories", "Priority email alerts", "Advanced workload analytics", "Audit log export"] },
    { name: "Enterprise Custom", price: "$4,999/mo", desc: "For regulated healthcare & financial enterprises", features: ["Unlimited workspaces", "Dedicated isolated encryption", "SLA: 15-min incident response", "Custom SSO / SAML / OIDC", "HIPAA & SOC 2 compliance pack"] },
  ];

  return (
    <PanelLayout
      title="Commercial Subscription Plans"
      breadcrumb={[
        { label: "Super Admin", href: "/super-admin" },
        { label: "Subscription Plans" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Tier Configuration</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Configure commercial pricing tiers and tenant resource limits.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((p, idx) => (
            <Card key={idx} className="p-6 flex flex-col justify-between space-y-4">
              <div>
                <Badge variant={idx === 2 ? "default" : "secondary"}>{p.name}</Badge>
                <div className="text-2xl font-extrabold text-app-text-primary mt-2">{p.price}</div>
                <p className="text-xs text-app-text-secondary mt-1">{p.desc}</p>
                <div className="space-y-2 mt-4 pt-4 border-t border-app-border">
                  {p.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-app-text-secondary">
                      <Check className="w-4 h-4 text-green-500 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => toast.info(`Editing plan tier ${p.name}`)}
              >
                Modify Tier
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}

