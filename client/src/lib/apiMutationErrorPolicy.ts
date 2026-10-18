const HANDLED_MUTATION_ERROR_CODES = new Set([
  "BAD_REQUEST",
  "CONFLICT",
  "FORBIDDEN",
  "NOT_FOUND",
  "PAYLOAD_TOO_LARGE",
  "PRECONDITION_FAILED",
  "TOO_MANY_REQUESTS",
  "UNAUTHORIZED",
]);

/** Returns false only for typed client/business errors already presented by the UI. */
export function shouldLogMutationErrorCode(code: string | undefined): boolean {
  return code === undefined || !HANDLED_MUTATION_ERROR_CODES.has(code);
}
