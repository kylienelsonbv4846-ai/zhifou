import { describe, expect, it, vi } from "vitest";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import type { TrpcContext } from "./context";
import { protectedProcedure, router } from "./trpc";

describe("protectedProcedure", () => {
  it("rejects anonymous callers with the shared UNAUTHORIZED contract before the resolver runs", async () => {
    const resolver = vi.fn(() => "private data");
    const testRouter = router({
      privateData: protectedProcedure.query(() => resolver()),
    });
    const caller = testRouter.createCaller({
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
      user: null,
    });

    await expect(caller.privateData()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: UNAUTHED_ERR_MSG,
    });
    expect(resolver).not.toHaveBeenCalled();
  });
});
