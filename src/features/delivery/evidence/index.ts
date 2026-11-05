// ProWise evidence feature module
export interface EvidenceConfig {
  enabled: boolean;
  name: string;
}

export const evidenceFeatureConfig: EvidenceConfig = {
  enabled: true,
  name: "evidence",
};
