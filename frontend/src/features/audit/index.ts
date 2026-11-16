// ProWise audit feature module
export interface AuditConfig {
  enabled: boolean;
  name: string;
}

export const auditFeatureConfig: AuditConfig = {
  enabled: true,
  name: "audit",
};
