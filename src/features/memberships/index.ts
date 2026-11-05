// ProWise memberships feature module
export interface MembershipsConfig {
  enabled: boolean;
  name: string;
}

export const membershipsFeatureConfig: MembershipsConfig = {
  enabled: true,
  name: "memberships",
};
