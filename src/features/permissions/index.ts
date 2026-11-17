// ProWise permissions feature module
export interface PermissionsConfig {
  enabled: boolean;
  name: string;
}

export const permissionsFeatureConfig: PermissionsConfig = {
  enabled: true,
  name: "permissions",
};
