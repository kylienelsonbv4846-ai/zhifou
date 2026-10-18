import { describe, expect, it } from "vitest";
import { shouldLogMutationErrorCode } from "./apiMutationErrorPolicy";

describe("shouldLogMutationErrorCode", () => {
  it.each([
    "BAD_REQUEST",
    "CONFLICT",
    "FORBIDDEN",
    "NOT_FOUND",
    "PAYLOAD_TOO_LARGE",
    "PRECONDITION_FAILED",
    "TOO_MANY_REQUESTS",
    "UNAUTHORIZED",
  ])("suppresses the handled %s business error", code => {
    expect(shouldLogMutationErrorCode(code)).toBe(false);
  });

  it("keeps logging server errors and errors without a tRPC code", () => {
    expect(shouldLogMutationErrorCode("INTERNAL_SERVER_ERROR")).toBe(true);
    expect(shouldLogMutationErrorCode("SERVICE_UNAVAILABLE")).toBe(true);
    expect(shouldLogMutationErrorCode(undefined)).toBe(true);
  });
});
