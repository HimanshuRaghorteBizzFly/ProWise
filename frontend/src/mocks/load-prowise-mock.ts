import rawMock from "./prowise-mock.json";
import { ProwiseMockSchema, type ProwiseMock } from "./prowise-mock-schema";
import { mocksAllowed, readPermissionEnv, type PermissionEnv } from "@/lib/permissions";

let cached: ProwiseMock | null = null;

export function parseProwiseMock(value: unknown): ProwiseMock {
  return ProwiseMockSchema.parse(value);
}

/** The same dataset shape with every collection empty: what normal use (no NEXT_PUBLIC_USE_MOCKS) gets. */
export function emptyProwiseMock(): ProwiseMock {
  const empty = Object.fromEntries(
    Object.entries(rawMock as Record<string, unknown>).map(([key, value]) => [key, Array.isArray(value) ? [] : value]),
  );
  return parseProwiseMock(empty);
}

/**
 * Sample data only with NEXT_PUBLIC_USE_MOCKS=true outside production (tests and previews). Otherwise the dataset is
 * empty, so no sample company, person or number can reach the UI even through a forgotten fallback.
 */
export function loadProwiseMock(env: PermissionEnv = readPermissionEnv()): ProwiseMock {
  if (!mocksAllowed(env)) return emptyProwiseMock();
  if (!cached) {
    cached = parseProwiseMock(rawMock);
  }
  return cached;
}
