const HANDLED_MUTATION_ERROR_CODES = new Set([
  "BAD_REQUEST",
  "CONFLICT",
  "TOO_MANY_REQUESTS",
  "UNAUTHORIZED",
]);

/** Returns false only for typed client/business errors already presented by the UI. */
export function shouldLogMutationErrorCode(code: string | undefined): boolean {
  return code === undefined || !HANDLED_MUTATION_ERROR_CODES.has(code);
}
