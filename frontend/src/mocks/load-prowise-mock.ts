import rawMock from "./prowise-mock.json";
import { ProwiseMockSchema, type ProwiseMock } from "./prowise-mock-schema";

let cached: ProwiseMock | null = null;

export function parseProwiseMock(value: unknown): ProwiseMock {
  return ProwiseMockSchema.parse(value);
}

export function loadProwiseMock(): ProwiseMock {
  if (!cached) {
    cached = parseProwiseMock(rawMock);
  }
  return cached;
}
