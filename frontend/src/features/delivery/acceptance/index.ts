// ProWise acceptance feature module
export interface AcceptanceConfig {
  enabled: boolean;
  name: string;
}

export const acceptanceFeatureConfig: AcceptanceConfig = {
  enabled: true,
  name: "acceptance",
};
