// ProWise users feature module
export interface UsersConfig {
  enabled: boolean;
  name: string;
}

export const usersFeatureConfig: UsersConfig = {
  enabled: true,
  name: "users",
};
