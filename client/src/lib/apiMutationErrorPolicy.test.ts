import { describe, expect, it } from "vitest";
import { shouldLogMutationErrorCode } from "./apiMutationErrorPolicy";

describe("shouldLogMutationErrorCode", () => {
  it("suppresses only explicitly handled business errors", () => {
    expect(shouldLogMutationErrorCode("BAD_REQUEST")).toBe(false);
    expect(shouldLogMutationErrorCode("CONFLICT")).toBe(false);
    expect(shouldLogMutationErrorCode("TOO_MANY_REQUESTS")).toBe(false);
    expect(shouldLogMutationErrorCode("UNAUTHORIZED")).toBe(false);
  });

  it("keeps logging server errors and errors without a tRPC code", () => {
    expect(shouldLogMutationErrorCode("INTERNAL_SERVER_ERROR")).toBe(true);
    expect(shouldLogMutationErrorCode("SERVICE_UNAVAILABLE")).toBe(true);
    expect(shouldLogMutationErrorCode(undefined)).toBe(true);
  });
});
