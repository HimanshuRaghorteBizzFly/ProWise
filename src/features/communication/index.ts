// ProWise communication feature module
export interface CommunicationConfig {
  enabled: boolean;
  name: string;
}

export const communicationFeatureConfig: CommunicationConfig = {
  enabled: true,
  name: "communication",
};
