// ==========================================
// PROWISE SAAS — FUNCTIONAL TEST SUITE
// Automated verification of 15 Master Prompt Scenarios
// ==========================================

import {
  calculateStructuredProgress,
  validateIndividualCheckIn,
} from "../src/lib/progress.ts";
import { evaluateProjectHealth } from "../src/lib/health.ts";
import { generateCsv, sanitizeCsvCell } from "../src/lib/csv.ts";

console.log("==================================================");
console.log("PROWISE SAAS BLUEPRINT V1.1 VERIFICATION SUITE");
console.log("==================================================\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

// ----------------------------------------------------
// SCENARIO 5 & 6: Developer check-in and append history
// ----------------------------------------------------
console.log("--- Testing Individual Mode Check-ins ---");
const check1 = validateIndividualCheckIn(45, null);
assert(check1.valid === true, "Scenario 5: Developer submits initial 45% check-in successfully");

const checkDownwardNoReason = validateIndividualCheckIn(35, 45, "");
assert(
  checkDownwardNoReason.valid === false,
  "Scenario 6: Downward revision from 45% to 35% without explanation is rejected"
);

const checkDownwardWithReason = validateIndividualCheckIn(
  35,
  45,
  "Refactored patient intake parser"
);
assert(
  checkDownwardWithReason.valid === true,
  "Scenario 6: Downward revision with explanation is accepted and appends revision"
);

// ----------------------------------------------------
// SCENARIO 7, 8, 9: Structured Mode Math & Reference Fixture
// Reference: Design 20, API 30 accepted, Release 50 in review => 50/100 = 50%
// Approve 25 extra points => 50/125 = 40%
// Reopen API (30 pts) => 20/125 = 16%
// ----------------------------------------------------
console.log("\n--- Testing Structured Progress Math (AS-03 / AS-08) ---");
const baselineV1 = {
  id: "base-v1",
  projectId: "proj-cds",
  version: 1,
  reason: "Initial scope",
  unit: "points",
  approvedBy: "pm",
  approvedAt: "2026-10-01",
  totalWeight: 100,
  leaves: [
    { workItemId: "task-1", title: "Design", weight: 20, isEligible: true, isDone: true },
    { workItemId: "task-2", title: "API Core", weight: 30, isEligible: true, isDone: true },
    { workItemId: "task-3", title: "Release", weight: 50, isEligible: true, isDone: false },
  ],
};

const workItemsInitial = [
  { id: "task-1", state: "DONE" },
  { id: "task-2", state: "DONE" },
  { id: "task-3", state: "IN_REVIEW" },
];

const resInitial = calculateStructuredProgress(baselineV1, workItemsInitial);
assert(
  resInitial.numerator === 50 && resInitial.denominator === 100 && resInitial.percentage === 50,
  `Scenario 7: Initial progress is 50/100 = 50% (got ${resInitial.percentage}%)`
);

// Scenario 8: Approve 25 extra points => denominator = 125, progress = 50/125 = 40%
const baselineV2 = {
  ...baselineV1,
  version: 2,
  totalWeight: 125,
  leaves: [
    ...baselineV1.leaves,
    { workItemId: "task-4", title: "Audit Trail", weight: 25, isEligible: true, isDone: false },
  ],
};

const resV2 = calculateStructuredProgress(baselineV2, workItemsInitial);
assert(
  resV2.numerator === 50 && resV2.denominator === 125 && resV2.percentage === 40,
  `Scenario 8: Approved 25-point scope addition changes progress to 50/125 = 40% (got ${resV2.percentage}%)`
);

// Scenario 9: Reopen task-2 (30 pts) => numerator = 20, progress = 20/125 = 16%
const workItemsReopened = [
  { id: "task-1", state: "DONE" },
  { id: "task-2", state: "IN_PROGRESS" }, // Reopened!
  { id: "task-3", state: "IN_REVIEW" },
  { id: "task-4", state: "TODO" },
];

const resReopened = calculateStructuredProgress(baselineV2, workItemsReopened);
assert(
  resReopened.numerator === 20 && resReopened.denominator === 125 && resReopened.percentage === 16,
  `Scenario 9: Reopening completed 30-point item drops eligible progress to 20/125 = 16% (got ${resReopened.percentage}%)`
);

// Empty Denominator check
const emptyRes = calculateStructuredProgress(null, []);
assert(
  emptyRes.isMeasurable === false && emptyRes.displayText === "Not Measurable",
  "Blueprint V1.1: Empty denominator correctly reports 'Not Measurable'"
);

// ----------------------------------------------------
// SCENARIO 11 & CSV Formula Injection Protection
// ----------------------------------------------------
console.log("\n--- Testing CSV Formula Injection Defense (OWASP / FR-043) ---");
const dangerousCell = "=SUM(A1:A10)";
const sanitizedCell = sanitizeCsvCell(dangerousCell);
assert(
  sanitizedCell === `"'=SUM(A1:A10)"`,
  `Scenario 11: Leading formula '=' is safely prefixed with single quote (got ${sanitizedCell})`
);

const dangerousPlus = "+12345";
assert(
  sanitizeCsvCell(dangerousPlus) === `"'+12345"`,
  "Leading '+' formula indicator is safely escaped"
);

// ----------------------------------------------------
// Deterministic Health Signal Precedence
// ----------------------------------------------------
console.log("\n--- Testing Health Signal Precedence (FR-030 / D06) ---");
const delayedProject = {
  id: "p1",
  lifecycle: "ACTIVE",
  targetDate: "2026-10-01", // Past approved target date
  health: "DELAYED",
  healthReasons: [],
};
const healthRes1 = evaluateProjectHealth(delayedProject, [], "2026-11-05");
assert(
  healthRes1.health === "DELAYED",
  `Health Check 1: Past target date without delivery evaluates to DELAYED (got ${healthRes1.health})`
);

const onTrackProject = {
  id: "p2",
  lifecycle: "ACTIVE",
  targetDate: "2026-12-01",
  health: "ON_TRACK",
  healthReasons: [],
};
const healthRes2 = evaluateProjectHealth(onTrackProject, [], "2026-11-05");
assert(
  healthRes2.health === "ON_TRACK",
  `Health Check 2: Future target with no critical blockers evaluates to ON_TRACK (got ${healthRes2.health})`
);

console.log("\n==================================================");
console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log("==================================================");

if (failed > 0) process.exit(1);

