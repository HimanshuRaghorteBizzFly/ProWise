// ProWise settings feature module
export interface SettingsConfig {
  enabled: boolean;
  name: string;
}

export const settingsFeatureConfig: SettingsConfig = {
  enabled: true,
  name: "settings",
};
