// ProWise platform feature module
export interface PlatformConfig {
  enabled: boolean;
  name: string;
}

export const platformFeatureConfig: PlatformConfig = {
  enabled: true,
  name: "platform",
};
