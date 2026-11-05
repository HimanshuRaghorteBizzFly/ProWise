// ProWise repositories feature module
export interface RepositoriesConfig {
  enabled: boolean;
  name: string;
}

export const repositoriesFeatureConfig: RepositoriesConfig = {
  enabled: true,
  name: "repositories",
};
