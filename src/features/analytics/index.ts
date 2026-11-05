// ProWise analytics feature module
export interface AnalyticsConfig {
  enabled: boolean;
  name: string;
}

export const analyticsFeatureConfig: AnalyticsConfig = {
  enabled: true,
  name: "analytics",
};
