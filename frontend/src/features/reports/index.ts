// ProWise reports feature module
export interface ReportsConfig {
  enabled: boolean;
  name: string;
}

export const reportsFeatureConfig: ReportsConfig = {
  enabled: true,
  name: "reports",
};
