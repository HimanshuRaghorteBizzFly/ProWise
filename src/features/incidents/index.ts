// ProWise incidents feature module
export interface IncidentsConfig {
  enabled: boolean;
  name: string;
}

export const incidentsFeatureConfig: IncidentsConfig = {
  enabled: true,
  name: "incidents",
};
