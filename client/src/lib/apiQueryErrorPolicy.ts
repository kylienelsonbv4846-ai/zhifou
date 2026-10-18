import { UNAUTHED_ERR_MSG } from "@shared/const";
import { TRPCClientError } from "@trpc/client";

const HANDLED_QUERY_ERROR_CODES = new Set([
  "BAD_REQUEST",
  "CONFLICT",
  "FORBIDDEN",
  "NOT_FOUND",
  "PRECONDITION_FAILED",
  "TOO_MANY_REQUESTS",
  "UNAUTHORIZED",
]);

/**
 * Suppress only typed business errors whose UI flow handles them. Message text
 * is never enough to hide an error: unknown and server-side failures stay visible.
 */
export function shouldLogQueryErrorCode(code?: string): boolean {
  return code === undefined || !HANDLED_QUERY_ERROR_CODES.has(code);
}

/**
 * Redirect only for the exact tRPC authentication failure emitted by the
 * server. Both the structured code and canonical message must match.
 */
export function shouldRedirectToLoginForQueryError(error: unknown): boolean {
  return (
    error instanceof TRPCClientError &&
    error.data?.code === "UNAUTHORIZED" &&
    error.message === UNAUTHED_ERR_MSG
  );
}
