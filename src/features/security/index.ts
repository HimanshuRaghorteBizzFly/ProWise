// ProWise security feature module
export interface SecurityConfig {
  enabled: boolean;
  name: string;
}

export const securityFeatureConfig: SecurityConfig = {
  enabled: true,
  name: "security",
};
