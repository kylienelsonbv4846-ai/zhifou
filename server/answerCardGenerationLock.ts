import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import * as db from "./db";

export async function withAnswerCardGenerationLock<T>(
  lockName: string,
  generate: () => Promise<T>
): Promise<T> {
  const ownerToken = randomUUID();
  const acquired = await db.acquireAnswerCardGenerationLock(lockName, ownerToken);
  if (!acquired) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "答题卡正在生成，请稍后重试",
    });
  }

  try {
    return await generate();
  } finally {
    try {
      await db.releaseAnswerCardGenerationLock(lockName, ownerToken);
    } catch (error) {
      // The lease expires automatically if the database is temporarily unavailable.
      console.error("[AnswerCards] Failed to release generation lease:", error);
    }
  }
}
