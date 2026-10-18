import { UNAUTHED_ERR_MSG } from "@shared/const";
import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";
import {
  shouldLogQueryErrorCode,
  shouldRedirectToLoginForQueryError,
} from "./apiQueryErrorPolicy";

function createTrpcError(message: string, code?: string): TRPCClientError {
  const error = new TRPCClientError(message);
  if (code !== undefined) {
    Object.assign(error, { data: { code } });
  }
  return error;
}

describe("shouldLogQueryErrorCode", () => {
  it.each([
    "BAD_REQUEST",
    "CONFLICT",
    "FORBIDDEN",
    "NOT_FOUND",
    "PRECONDITION_FAILED",
    "TOO_MANY_REQUESTS",
    "UNAUTHORIZED",
  ])("does not log handled %s business errors", code => {
    expect(shouldLogQueryErrorCode(code)).toBe(false);
  });

  it("continues logging missing, unknown, and server error codes", () => {
    expect(shouldLogQueryErrorCode(undefined)).toBe(true);
    expect(shouldLogQueryErrorCode("UNKNOWN_CODE")).toBe(true);
    expect(shouldLogQueryErrorCode("INTERNAL_SERVER_ERROR")).toBe(true);
    expect(shouldLogQueryErrorCode("SERVICE_UNAVAILABLE")).toBe(true);
  });
});

describe("shouldRedirectToLoginForQueryError", () => {
  it("redirects only for the exact tRPC UNAUTHORIZED error", () => {
    expect(
      shouldRedirectToLoginForQueryError(
        createTrpcError(UNAUTHED_ERR_MSG, "UNAUTHORIZED")
      )
    ).toBe(true);
  });

  it("does not redirect when the canonical message has another or no code", () => {
    expect(
      shouldRedirectToLoginForQueryError(
        createTrpcError(UNAUTHED_ERR_MSG, "INTERNAL_SERVER_ERROR")
      )
    ).toBe(false);
    expect(
      shouldRedirectToLoginForQueryError(createTrpcError(UNAUTHED_ERR_MSG))
    ).toBe(false);
    expect(
      shouldRedirectToLoginForQueryError(
        createTrpcError(UNAUTHED_ERR_MSG, "UNKNOWN_CODE")
      )
    ).toBe(false);
  });

  it("does not redirect for other messages or non-tRPC errors", () => {
    expect(
      shouldRedirectToLoginForQueryError(
        createTrpcError("资源不存在", "UNAUTHORIZED")
      )
    ).toBe(false);
    expect(shouldRedirectToLoginForQueryError(new Error(UNAUTHED_ERR_MSG))).toBe(
      false
    );
  });
});
