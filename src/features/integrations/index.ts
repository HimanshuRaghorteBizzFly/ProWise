// ProWise integrations feature module
export interface IntegrationsConfig {
  enabled: boolean;
  name: string;
}

export const integrationsFeatureConfig: IntegrationsConfig = {
  enabled: true,
  name: "integrations",
};
