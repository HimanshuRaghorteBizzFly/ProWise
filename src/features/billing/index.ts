// ProWise billing feature module
export interface BillingConfig {
  enabled: boolean;
  name: string;
}

export const billingFeatureConfig: BillingConfig = {
  enabled: true,
  name: "billing",
};
