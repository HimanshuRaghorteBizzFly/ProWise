// ProWise workspaces feature module
export interface WorkspacesConfig {
  enabled: boolean;
  name: string;
}

export const workspacesFeatureConfig: WorkspacesConfig = {
  enabled: true,
  name: "workspaces",
};
