import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { COOKIE_NAME } from "@shared/const";
import { protectedProcedure, router } from "./trpc";
import { appRouter } from "../routers";
import { hashPassword } from "../auth";
import { getSessionCookieOptions } from "./cookies";

const dbMocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  getUserByEmail: vi.fn(),
  updateUserLastSignedIn: vi.fn(),
}));

vi.mock("../db", () => dbMocks);

import { createStudentAccessToken, sdk, verifyStudentAccessToken } from "./sdk";

const localUser = {
  id: 42,
  openId: "local_test_user",
  name: "Local Teacher",
  email: "teacher@example.com",
  loginMethod: "local",
  passwordHash: "not-returned-by-auth-me",
  avatarUrl: null,
  wechatId: null,
  qqId: null,
  douyinId: null,
  role: "user" as const,
  isEmailVerified: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  lastSignedIn: new Date("2026-01-01T00:00:00.000Z"),
};

describe("independent local JWT sessions", () => {
  beforeEach(() => {
    vi.stubEnv(
      "CLASSCLICKER_SESSION_SECRET",
      "test-local-jwt-secret-that-is-long-enough"
    );
    vi.clearAllMocks();
    dbMocks.getUserById.mockResolvedValue(localUser);
    dbMocks.updateUserLastSignedIn.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolves a local JWT cookie into a user accepted by protectedProcedure without external OAuth", async () => {
    const token = await sdk.createLocalSessionToken(localUser.id);
    const req = {
      headers: { cookie: `${COOKIE_NAME}=${token}` },
    } as Request;
    const user = await sdk.authenticateRequest(req);

    const protectedRouter = router({
      currentUserId: protectedProcedure.query(({ ctx }) => ctx.user.id),
    });
    const caller = protectedRouter.createCaller({
      req,
      res: {} as Response,
      user,
    });

    await expect(caller.currentUserId()).resolves.toBe(localUser.id);
    expect(dbMocks.getUserById).toHaveBeenCalledWith(localUser.id);
    expect(dbMocks.updateUserLastSignedIn).toHaveBeenCalledWith(localUser.id);
  });

  it("rejects a local session when its user no longer exists", async () => {
    dbMocks.getUserById.mockResolvedValue(undefined);
    const token = await sdk.createLocalSessionToken(localUser.id);
    const req = {
      headers: { cookie: `${COOKIE_NAME}=${token}` },
    } as Request;

    await expect(sdk.authenticateRequest(req)).rejects.toThrow(
      "Local account session is no longer valid"
    );
  });

  it("requires a valid positive user ID when issuing a local session", async () => {
    await expect(sdk.createLocalSessionToken(0)).rejects.toThrow(
      "A valid local user ID is required to create a session"
    );
  });

  it("creates a persistent first-party cookie from local email login", async () => {
    const password = "TestPassword123!";
    dbMocks.getUserByEmail.mockResolvedValue({
      ...localUser,
      passwordHash: await hashPassword(password),
    });

    const cookieCalls: Array<{
      name: string;
      value: string;
      options: Record<string, unknown>;
    }> = [];
    const ctx = {
      req: {
        protocol: "https",
        headers: {},
      } as Request,
      res: {
        cookie: (
          name: string,
          value: string,
          options: Record<string, unknown>
        ) => cookieCalls.push({ name, value, options }),
      } as Response,
      user: null,
    };

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.login({
      email: localUser.email,
      password,
    });

    expect(result.success).toBe(true);
    expect(cookieCalls).toHaveLength(1);
    expect(cookieCalls[0]?.name).toBe(COOKIE_NAME);
    expect(cookieCalls[0]?.options).toMatchObject({
      httpOnly: true,
      sameSite: "none",
      secure: true,
      path: "/",
      maxAge: 31_536_000_000,
    });

    const sessionReq = {
      headers: { cookie: `${COOKIE_NAME}=${cookieCalls[0]?.value}` },
    } as Request;
    await expect(sdk.authenticateRequest(sessionReq)).resolves.toMatchObject({
      id: localUser.id,
      email: localUser.email,
    });
  });

  it("uses a non-secure Lax cookie for plain HTTP local development", () => {
    const cookieOptions = getSessionCookieOptions({
      protocol: "http",
      headers: {},
    } as Request);

    expect(cookieOptions).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });
  });

  it("binds student access tokens to exactly one session and student", async () => {
    const token = await createStudentAccessToken(101, 202);

    await expect(verifyStudentAccessToken(token, 101, 202)).resolves.toBe(true);
    await expect(verifyStudentAccessToken(token, 102, 202)).resolves.toBe(false);
    await expect(verifyStudentAccessToken(token, 101, 203)).resolves.toBe(false);

    const teacherSession = await sdk.createLocalSessionToken(202);
    await expect(verifyStudentAccessToken(teacherSession, 101, 202)).resolves.toBe(false);
  });
});
