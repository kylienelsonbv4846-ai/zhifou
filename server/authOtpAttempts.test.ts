import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { hashPassword, verifyPassword } from "./auth";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import { sdk } from "./_core/sdk";

const createdPendingEmails = new Set<string>();
const createdPasswordResetCodes = new Map<string, string>();
const createdLegacyResetTokens = new Map<string, number>();
const createdTestUserIds = new Set<number>();
const createdRateLimitEmails = new Set<string>();

function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID()}@example.com`;
}

function createPublicCaller() {
  const ctx = {
    user: null,
    req: { protocol: "https", headers: {} },
    res: { cookie: vi.fn(), clearCookie: vi.fn() },
  } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  for (const email of createdPendingEmails) {
    await db.deletePendingRegistrationVerificationCodes(email);
  }
  for (const [email, code] of createdPasswordResetCodes) {
    await db.deletePasswordResetCode(email, code);
  }
  for (const [token, userId] of createdLegacyResetTokens) {
    await db.deletePasswordResetToken(token);
  }
  for (const userId of createdTestUserIds) await db.deleteUnverifiedUser(userId);
  for (const email of createdRateLimitEmails) {
    await db.deleteEmailSendingRateLimit(0, email);
  }
  createdPendingEmails.clear();
  createdPasswordResetCodes.clear();
  createdLegacyResetTokens.clear();
  createdTestUserIds.clear();
  createdRateLimitEmails.clear();
});

describe("OTP failed-attempt limits", () => {
  it("counts registration attempts by the active email code and refuses it after five failures", async () => {
    const email = uniqueEmail("registration-otp");
    const correctCode = "A2B3C4";
    createdPendingEmails.add(email);
    await db.createEmailVerificationCode({
      userId: 0,
      email,
      name: "OTP Test Teacher",
      passwordHash: "$2b$12$server-side-placeholder-hash",
      code: correctCode,
      expiresAt: new Date(Date.now() + 10 * 60_000),
      attempts: 0,
      verified: false,
    });

    const caller = createPublicCaller();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        caller.auth.verifyEmail({ email, code: "D5E6F7" })
      ).rejects.toThrow("验证码无效");
    }

    const pending = await db.getPendingRegistrationVerificationCode(email);
    expect(pending?.attempts).toBe(5);
    await expect(
      caller.auth.verifyEmail({ email, code: correctCode })
    ).rejects.toThrow("验证码尝试次数过多");
    expect(await db.getUserByEmail(email)).toBeFalsy();
  });

  it("atomically caps concurrent wrong password-reset codes and rejects the later correct code", async () => {
    const email = uniqueEmail("password-reset-otp");
    const correctCode = "123456";
    createdPasswordResetCodes.set(email, correctCode);
    await db.createPasswordResetCode(
      email,
      correctCode,
      new Date(Date.now() + 10 * 60_000)
    );

    const failures = await Promise.all(
      Array.from({ length: 8 }, () =>
        db.verifyPasswordResetCode(email, "654321")
      )
    );
    expect(failures).toEqual(Array(8).fill(false));

    const record = await db.getPasswordResetCode(email, correctCode);
    expect(record?.attempts).toBe(5);
    expect(await db.verifyPasswordResetCode(email, correctCode)).toBe(false);
    expect((await db.getPasswordResetCode(email, correctCode))?.verified).toBe(false);
  });

  it("consumes a correct password-reset code only once", async () => {
    const email = uniqueEmail("password-reset-consume");
    const code = "827364";
    createdPasswordResetCodes.set(email, code);
    await db.createPasswordResetCode(
      email,
      code,
      new Date(Date.now() + 10 * 60_000)
    );

    expect(await db.verifyPasswordResetCode(email, code)).toBe(true);
    expect(await db.verifyPasswordResetCode(email, code)).toBe(false);
  });

  it("atomically consumes a legacy password-reset token under concurrent requests", async () => {
    const email = uniqueEmail("legacy-password-reset");
    const user = await db.createLocalAccount(email, "initial-test-hash", "Legacy Reset Test");
    createdTestUserIds.add(user.id);
    expect((await db.getUserByEmail(email))?.openId).toMatch(/^local_[0-9a-f]{32}$/);
    const token = randomUUID();
    createdLegacyResetTokens.set(token, user.id);
    await db.createPasswordResetToken({
      userId: user.id,
      email,
      token,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });

    const caller = createPublicCaller();
    const passwords = ["NewPassword123!", "OtherPassword456!"];
    const results = await Promise.allSettled(
      passwords.map((password) =>
        caller.auth.resetPassword({ token, password, confirmPassword: password })
      )
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

    const updatedUser = await db.getUserByEmail(email);
    expect(updatedUser?.passwordHash).toBeTruthy();
    if (!updatedUser?.passwordHash) throw new Error("Expected the account password to be updated");
    const matchingPasswords = await Promise.all(
      passwords.map((password) => verifyPassword(password, updatedUser.passwordHash!))
    );
    expect(matchingPasswords.filter(Boolean)).toHaveLength(1);
  });

  it("allows only one concurrent email-send cooldown claim", async () => {
    const email = uniqueEmail("email-cooldown");
    createdRateLimitEmails.add(email);

    const claims = await Promise.all(
      Array.from({ length: 8 }, () =>
        db.claimEmailSendingRateLimit(0, email, new Date(), 5)
      )
    );

    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it("creates a verified local account and consumes its pending code atomically", async () => {
    const email = uniqueEmail("registration-atomic");
    const code = "K7M2Q9";
    createdPendingEmails.add(email);
    await db.createEmailVerificationCode({
      userId: 0,
      email,
      name: "Atomic Registration Test",
      passwordHash: await hashPassword("InitialPass123!"),
      code,
      expiresAt: new Date(Date.now() + 10 * 60_000),
      attempts: 0,
      verified: false,
    });

    const caller = createPublicCaller();
    const outcomes = await Promise.allSettled([
      caller.auth.verifyEmail({ email, code }),
      caller.auth.verifyEmail({ email, code }),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);

    const user = await db.getUserByEmail(email);
    expect(user).toMatchObject({ loginMethod: "local", isEmailVerified: true });
    expect(user?.openId).toMatch(/^local_[0-9a-f]{32}$/);
    if (user) createdTestUserIds.add(user.id);
    expect(await db.getPendingRegistrationVerificationCode(email)).toBeFalsy();
  });

  it("changes a password with one reset-code transaction and invalidates legacy links", async () => {
    const email = uniqueEmail("password-reset-atomic");
    const initialHash = await hashPassword("InitialPass123!");
    const user = await db.createLocalAccount(email, initialHash, "Atomic Reset Test");
    createdTestUserIds.add(user.id);
    await db.markEmailAsVerified(user.id);

    const code = "937251";
    createdPasswordResetCodes.set(email, code);
    await db.createPasswordResetCode(email, code, new Date(Date.now() + 10 * 60_000));

    const legacyToken = randomUUID();
    createdLegacyResetTokens.set(legacyToken, user.id);
    await db.createPasswordResetToken({
      userId: user.id,
      email,
      token: legacyToken,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });

    const passwordHash = await hashPassword("SecurePass456!");
    const outcomes = await Promise.all([
      db.completePasswordResetWithCode(email, code, passwordHash),
      db.completePasswordResetWithCode(email, code, passwordHash),
    ]);
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    expect(outcomes.filter((outcome) => !outcome)).toHaveLength(1);

    const updatedUser = await db.getUserByEmail(email);
    expect(updatedUser?.passwordHash).toBe(passwordHash);
    expect(await verifyPassword("SecurePass456!", updatedUser!.passwordHash!)).toBe(true);
    expect((await db.getPasswordResetCode(email, code))?.verified).toBe(true);
    expect((await db.getPasswordResetTokenByToken(legacyToken))?.usedAt).toBeTruthy();
  });

  it("rejects an old local JWT cookie after a legacy reset-token password reset", async () => {
    const previousSecret = process.env.CLASSCLICKER_SESSION_SECRET;
    process.env.CLASSCLICKER_SESSION_SECRET = "local-session-version-integration-test-secret";
    try {
      const email = uniqueEmail("legacy-reset-session-version");
      const user = await db.createLocalAccount(
        email,
        await hashPassword("InitialPass123!"),
        "Legacy Session Version Test"
      );
      createdTestUserIds.add(user.id);
      await db.markEmailAsVerified(user.id);
      const beforeReset = await db.getUserById(user.id);
      if (!beforeReset) throw new Error("Expected local account before reset");

      const oldCookie = await sdk.createLocalSessionToken(
        beforeReset.id,
        beforeReset.sessionVersion
      );
      const oldCookieRequest = {
        headers: { cookie: `${COOKIE_NAME}=${oldCookie}` },
      } as Parameters<typeof sdk.authenticateRequest>[0];
      await expect(sdk.authenticateRequest(oldCookieRequest)).resolves.toMatchObject({
        id: user.id,
      });

      const token = randomUUID();
      createdLegacyResetTokens.set(token, user.id);
      await db.createPasswordResetToken({
        userId: user.id,
        email,
        token,
        expiresAt: new Date(Date.now() + 10 * 60_000),
      });

      await expect(
        createPublicCaller().auth.resetPassword({
          token,
          password: "NewPassword123!",
          confirmPassword: "NewPassword123!",
        })
      ).resolves.toMatchObject({ success: true });

      const afterReset = await db.getUserById(user.id);
      expect(afterReset?.sessionVersion).toBe(beforeReset.sessionVersion + 1);
      await expect(sdk.authenticateRequest(oldCookieRequest)).rejects.toThrow(
        "Local account session is no longer valid"
      );
    } finally {
      if (previousSecret === undefined) delete process.env.CLASSCLICKER_SESSION_SECRET;
      else process.env.CLASSCLICKER_SESSION_SECRET = previousSecret;
    }
  });

  it("rejects an old local JWT cookie after an OTP password reset", async () => {
    const previousSecret = process.env.CLASSCLICKER_SESSION_SECRET;
    process.env.CLASSCLICKER_SESSION_SECRET = "local-session-version-integration-test-secret";
    try {
      const email = uniqueEmail("otp-reset-session-version");
      const user = await db.createLocalAccount(
        email,
        await hashPassword("InitialPass123!"),
        "OTP Session Version Test"
      );
      createdTestUserIds.add(user.id);
      await db.markEmailAsVerified(user.id);
      const beforeReset = await db.getUserById(user.id);
      if (!beforeReset) throw new Error("Expected local account before reset");

      const oldCookie = await sdk.createLocalSessionToken(
        beforeReset.id,
        beforeReset.sessionVersion
      );
      const oldCookieRequest = {
        headers: { cookie: `${COOKIE_NAME}=${oldCookie}` },
      } as Parameters<typeof sdk.authenticateRequest>[0];
      await expect(sdk.authenticateRequest(oldCookieRequest)).resolves.toMatchObject({
        id: user.id,
      });

      const code = "826451";
      createdPasswordResetCodes.set(email, code);
      await db.createPasswordResetCode(
        email,
        code,
        new Date(Date.now() + 10 * 60_000)
      );

      await expect(
        createPublicCaller().auth.verifyPasswordResetCode({
          email,
          code,
          newPassword: "NewPassword123!",
        })
      ).resolves.toMatchObject({ success: true });

      const afterReset = await db.getUserById(user.id);
      expect(afterReset?.sessionVersion).toBe(beforeReset.sessionVersion + 1);
      await expect(sdk.authenticateRequest(oldCookieRequest)).rejects.toThrow(
        "Local account session is no longer valid"
      );
    } finally {
      if (previousSecret === undefined) delete process.env.CLASSCLICKER_SESSION_SECRET;
      else process.env.CLASSCLICKER_SESSION_SECRET = previousSecret;
    }
  });

  it("deletes only expired registration and password-reset codes", async () => {
    const expiredRegistrationEmail = uniqueEmail("expired-registration");
    const activeRegistrationEmail = uniqueEmail("active-registration");
    const expiredResetEmail = uniqueEmail("expired-reset");
    const activeResetEmail = uniqueEmail("active-reset");
    const expiredCode = "EXPIRED1";
    const activeCode = "ACTIVE1";

    createdPendingEmails.add(expiredRegistrationEmail);
    createdPendingEmails.add(activeRegistrationEmail);
    await Promise.all([
      db.createEmailVerificationCode({
        userId: 0, email: expiredRegistrationEmail, code: expiredCode,
        expiresAt: new Date(Date.now() - 60_000), attempts: 0, verified: false,
      }),
      db.createEmailVerificationCode({
        userId: 0, email: activeRegistrationEmail, code: activeCode,
        expiresAt: new Date(Date.now() + 60_000), attempts: 0, verified: false,
      }),
    ]);

    createdPasswordResetCodes.set(expiredResetEmail, expiredCode);
    createdPasswordResetCodes.set(activeResetEmail, activeCode);
    await Promise.all([
      db.createPasswordResetCode(expiredResetEmail, expiredCode, new Date(Date.now() - 60_000)),
      db.createPasswordResetCode(activeResetEmail, activeCode, new Date(Date.now() + 60_000)),
    ]);

    await db.deleteExpiredVerificationCodes();
    await db.deleteExpiredPasswordResetCodes();

    expect(await db.getPendingRegistrationVerificationCode(expiredRegistrationEmail)).toBeFalsy();
    expect(await db.getPendingRegistrationVerificationCode(activeRegistrationEmail)).toBeTruthy();
    expect(await db.getPasswordResetCode(expiredResetEmail, expiredCode)).toBeFalsy();
    expect(await db.getPasswordResetCode(activeResetEmail, activeCode)).toBeTruthy();
  });
});
