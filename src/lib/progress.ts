import type { WorkItem, ScopeBaseline } from "../types/index.ts";

export interface StructuredProgressResult {
  numerator: number;
  denominator: number;
  percentage: number;
  isMeasurable: boolean;
  displayText: string;
}

/**
 * Calculates Structured Progress based on Blueprint V1.1 rules:
 * Progress = Sum(Eligible Done leaf weights) / Sum(Active approved baseline weights) * 100
 */
export function calculateStructuredProgress(
  baseline: ScopeBaseline | null | undefined,
  workItems: WorkItem[]
): StructuredProgressResult {
  if (!baseline || baseline.totalWeight <= 0) {
    return {
      numerator: 0,
      denominator: 0,
      percentage: -1,
      isMeasurable: false,
      displayText: "Not Measurable",
    };
  }

  // Leaves are defined in the approved baseline
  // A leaf is considered done if the corresponding work item is in state 'DONE'
  // and has passed required review/criteria
  let earnedNumerator = 0;
  const denominator = baseline.totalWeight;

  for (const leaf of baseline.leaves) {
    if (!leaf.isEligible) continue;

    // Find live work item status
    const item = workItems.find((w) => w.id === leaf.workItemId);
    const isDone = item ? item.state === "DONE" : leaf.isDone;

    if (isDone) {
      earnedNumerator += leaf.weight;
    }
  }

  const rawPercent = (earnedNumerator / denominator) * 100;
  const roundedPercent = Math.round(rawPercent * 10) / 10; // Exact single decimal or display rounding

  return {
    numerator: earnedNumerator,
    denominator,
    percentage: roundedPercent,
    isMeasurable: true,
    displayText: `${earnedNumerator} / ${denominator} (${Math.round(rawPercent)}%)`,
  };
}

/**
 * Validates individual check-in downward revision
 */
export function validateIndividualCheckIn(
  newPercent: number,
  previousPercent: number | null | undefined,
  reason?: string
): { valid: boolean; error?: string } {
  if (newPercent < 0 || newPercent > 100) {
    return { valid: false, error: "Progress percentage must be between 0 and 100." };
  }

  if (previousPercent !== null && previousPercent !== undefined && newPercent < previousPercent) {
    if (!reason || reason.trim().length < 5) {
      return {
        valid: false,
        error: "A downward revision in progress requires a clear explanatory reason.",
      };
    }
  }

  return { valid: true };
}

export function validateCheckInSubmission(params: {
  newPercent: number;
  previousAcceptedPercent?: number;
  downwardRevisionReason?: string;
  accomplishedSummary?: string;
  nextStepsSummary?: string;
  targetFinishDate?: string;
}): { isValid: boolean; errorMessage?: string } {
  const result = validateIndividualCheckIn(
    params.newPercent,
    params.previousAcceptedPercent,
    params.downwardRevisionReason
  );
  if (!result.valid) {
    return { isValid: false, errorMessage: result.error };
  }
  if (params.accomplishedSummary && params.accomplishedSummary.trim().length < 5) {
    return { isValid: false, errorMessage: "Accomplished summary must be at least 5 characters." };
  }
  if (params.nextStepsSummary && params.nextStepsSummary.trim().length < 5) {
    return { isValid: false, errorMessage: "Next steps summary must be at least 5 characters." };
  }
  return { isValid: true };
}

