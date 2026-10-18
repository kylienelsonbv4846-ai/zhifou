import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { HttpError } from "@shared/_core/errors";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    // Resolve the first-party JWT cookie into the current local account.
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Invalid/revoked sessions are anonymous; infrastructure failures must surface as 5xx.
    if (error instanceof HttpError && (error.statusCode === 401 || error.statusCode === 403)) {
      user = null;
    } else {
      throw error;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
