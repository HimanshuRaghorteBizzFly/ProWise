// ProWise auth feature module
export interface AuthConfig {
  enabled: boolean;
  name: string;
}

export const authFeatureConfig: AuthConfig = {
  enabled: true,
  name: "auth",
};
