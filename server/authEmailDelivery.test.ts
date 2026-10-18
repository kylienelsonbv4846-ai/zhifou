import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { sdk } from "./_core/sdk";
import { hashPassword } from "./auth";

const mocks = vi.hoisted(() => ({
  db: {
    getUserByEmail: vi.fn(),
    deleteUnverifiedUser: vi.fn(),
    createEmailVerificationCode: vi.fn(),
    deleteEmailVerificationCodeByCode: vi.fn(),
    getPendingRegistrationVerificationCode: vi.fn(),
    deletePendingRegistrationVerificationCodes: vi.fn(),
    getEmailVerificationCodeByCode: vi.fn(),
    getEmailVerificationCodeByUserAndEmail: vi.fn(),
    completePendingRegistrationVerification: vi.fn(),
    completeExistingEmailVerification: vi.fn(),
    getEmailVerificationTokenByToken: vi.fn(),
    incrementVerificationCodeAttempts: vi.fn(),
    createLocalAccount: vi.fn(),
    markEmailAsVerified: vi.fn(),
    getEmailSendingRateLimit: vi.fn(),
    upsertEmailSendingRateLimit: vi.fn(),
    deleteUserEmailVerificationTokens: vi.fn(),
    createEmailVerificationToken: vi.fn(),
    createEmailSendingRateLimit: vi.fn(),
    updateEmailSendingRateLimit: vi.fn(),
    deleteEmailSendingRateLimit: vi.fn(),
    claimEmailSendingRateLimit: vi.fn(),
    deleteEmailVerificationToken: vi.fn(),
    deleteUserPasswordResetTokens: vi.fn(),
    createPasswordResetToken: vi.fn(),
    deletePasswordResetToken: vi.fn(),
    completePasswordResetWithToken: vi.fn(),
    completePasswordResetWithCode: vi.fn(),
    createPasswordResetCode: vi.fn(),
    deletePasswordResetCode: vi.fn(),
    getUserById: vi.fn(),
    updateUserLastSignedIn: vi.fn(),
  },
  sendEmail: vi.fn(),
  sendTemplateEmail: vi.fn(),
}));

vi.mock("./db", async importOriginal => ({
  ...(await importOriginal<typeof import("./db")>()),
  ...mocks.db,
}));

vi.mock("./_core/email", async importOriginal => ({
  ...(await importOriginal<typeof import("./_core/email")>()),
  sendEmail: mocks.sendEmail,
  sendTemplateEmail: mocks.sendTemplateEmail,
}));

import { appRouter } from "./routers";

const email = "teacher@example.com";
const user = {
  id: 12,
  email,
  name: "Test Teacher",
  loginMethod: "local",
  role: "user",
  isEmailVerified: true,
  passwordHash: "test-hash",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
  openId: null,
};

function createCaller() {
  const ctx = {
    user: null,
    req: { protocol: "https", headers: {} },
    res: { cookie: vi.fn(), clearCookie: vi.fn() },
  } as unknown as TrpcContext;

  return appRouter.createCaller(ctx);
}

describe("authentication email delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});

    mocks.db.getUserByEmail.mockResolvedValue(null);
    mocks.db.getEmailSendingRateLimit.mockResolvedValue(null);
    mocks.db.getPendingRegistrationVerificationCode.mockResolvedValue(null);
    mocks.db.getEmailVerificationCodeByCode.mockResolvedValue(null);
    mocks.db.getEmailVerificationCodeByUserAndEmail.mockResolvedValue(null);
    mocks.db.getEmailVerificationTokenByToken.mockResolvedValue(null);
    mocks.db.getUserById.mockResolvedValue(null);
    mocks.db.updateUserLastSignedIn.mockResolvedValue(undefined);
    mocks.db.deletePendingRegistrationVerificationCodes.mockResolvedValue(undefined);
    mocks.db.upsertEmailSendingRateLimit.mockResolvedValue(undefined);
    mocks.db.incrementVerificationCodeAttempts.mockResolvedValue(undefined);
    mocks.db.createLocalAccount.mockResolvedValue({ id: 42, email, name: "Test Teacher" });
    mocks.db.completePendingRegistrationVerification.mockResolvedValue({ id: 42, email, name: "Test Teacher" });
    mocks.db.completeExistingEmailVerification.mockResolvedValue({ id: 12, email, name: "Test Teacher" });
    mocks.db.markEmailAsVerified.mockResolvedValue(undefined);
    mocks.db.claimEmailSendingRateLimit.mockResolvedValue(true);
    mocks.db.createEmailVerificationCode.mockResolvedValue(1);
    mocks.db.createEmailVerificationToken.mockResolvedValue(1);
    mocks.db.createEmailSendingRateLimit.mockResolvedValue(1);
    mocks.db.createPasswordResetToken.mockResolvedValue(1);
    mocks.db.completePasswordResetWithToken.mockResolvedValue(true);
    mocks.db.completePasswordResetWithCode.mockResolvedValue(true);
    mocks.db.createPasswordResetCode.mockResolvedValue(undefined);
    mocks.sendEmail.mockResolvedValue(false);
    mocks.sendTemplateEmail.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fails registration and removes a verification code when SES does not send it", async () => {
    const caller = createCaller();

    await expect(
      caller.auth.register({
        name: "Test Teacher",
        email,
        password: "SecurePass123!",
      })
    ).rejects.toThrow("验证邮件发送失败");

    const createdCode =
      mocks.db.createEmailVerificationCode.mock.calls[0]?.[0].code;
    expect(createdCode).toMatch(/^[A-Z0-9]{6}$/);
    const pendingRegistration = mocks.db.createEmailVerificationCode.mock.calls[0]?.[0];
    expect(pendingRegistration.name).toBe("Test Teacher");
    expect(pendingRegistration.passwordHash).toMatch(/^\$2/);
    expect(pendingRegistration.passwordHash).not.toBe("SecurePass123!");
    expect(mocks.db.deleteEmailVerificationCodeByCode).toHaveBeenCalledWith(
      createdCode
    );
    expect(mocks.db.deleteEmailSendingRateLimit).toHaveBeenCalledWith(0, email);
  });

  it("returns a typed conflict for an already registered email without sending another code", async () => {
    mocks.db.getUserByEmail.mockResolvedValue(user);

    await expect(
      createCaller().auth.register({
        name: "Test Teacher",
        email,
        password: "SecurePass123!",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "邮箱已被使用",
    });

    expect(mocks.db.claimEmailSendingRateLimit).not.toHaveBeenCalled();
    expect(mocks.db.createEmailVerificationCode).not.toHaveBeenCalled();
    expect(mocks.sendTemplateEmail).not.toHaveBeenCalled();
  });

  it("resends a pending registration code and retains only a password hash", async () => {
    const oldPending = {
      id: 5,
      userId: 0,
      email,
      name: "Test Teacher",
      passwordHash: "$2b$12$already-hashed",
      code: "OLD123",
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mocks.db.getPendingRegistrationVerificationCode.mockResolvedValue(oldPending);
    mocks.sendTemplateEmail.mockResolvedValue(true);

    const result = await createCaller().auth.resendVerificationEmail({ email });
    const replacement = mocks.db.createEmailVerificationCode.mock.calls[0]?.[0];

    expect(replacement.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(replacement.code).not.toBe(oldPending.code);
    expect(replacement.passwordHash).toBe(oldPending.passwordHash);
    expect(mocks.sendTemplateEmail).toHaveBeenCalledWith({
      to: email,
      templateId: 168247,
      templateData: { code: replacement.code },
    });
    expect(mocks.db.createEmailVerificationCode).toHaveBeenCalledWith(expect.objectContaining({
      userId: 0,
      email,
      code: replacement.code,
      name: oldPending.name,
      passwordHash: oldPending.passwordHash,
      attempts: 0,
      verified: false,
    }));
    expect(mocks.db.deleteEmailVerificationCodeByCode).not.toHaveBeenCalledWith(oldPending.code);
    expect(result.success).toBe(true);
  });

  it("creates the account only after a pending email code is verified", async () => {
    const pendingCode = {
      id: 8,
      userId: 0,
      email,
      name: "Test Teacher",
      passwordHash: "$2b$12$server-hash",
      code: "ABC123",
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mocks.db.getPendingRegistrationVerificationCode.mockResolvedValue(pendingCode);
    mocks.db.getUserByEmail.mockResolvedValue(null);

    const result = await createCaller().auth.verifyEmail({ email, code: "ABC123" });

    expect(mocks.db.completePendingRegistrationVerification).toHaveBeenCalledWith(
      email,
      pendingCode.id,
      "ABC123"
    );
    expect(mocks.db.createLocalAccount).not.toHaveBeenCalled();
    expect(mocks.db.markEmailAsVerified).not.toHaveBeenCalled();
    expect(result.user).toMatchObject({ id: 42, email, name: "Test Teacher" });
  });

  it("counts an incorrect registration code against that email's active code", async () => {
    const pendingCode = {
      id: 19,
      userId: 0,
      email,
      name: "Test Teacher",
      passwordHash: "$2b$12$server-hash",
      code: "ABC123",
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mocks.db.getPendingRegistrationVerificationCode.mockResolvedValue(pendingCode);

    await expect(
      createCaller().auth.verifyEmail({ email, code: "XYZ789" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "验证码无效或已过期，请重新获取",
    });

    expect(mocks.db.incrementVerificationCodeAttempts).toHaveBeenCalledWith(19);
    expect(mocks.db.createLocalAccount).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("returns a handled client error for an expired registration code", async () => {
    mocks.db.getPendingRegistrationVerificationCode.mockResolvedValue({
      id: 20,
      userId: 0,
      email,
      name: "Test Teacher",
      passwordHash: "$2b$12$server-hash",
      code: "ABC123",
      expiresAt: new Date(Date.now() - 60_000),
      attempts: 0,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      createCaller().auth.verifyEmail({ email, code: "ABC123" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "验证码已过期，请重新获取",
    });

    expect(mocks.db.incrementVerificationCodeAttempts).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("rejects the correct registration code after five failed attempts", async () => {
    mocks.db.getPendingRegistrationVerificationCode.mockResolvedValue({
      id: 20,
      userId: 0,
      email,
      name: "Test Teacher",
      passwordHash: "$2b$12$server-hash",
      code: "ABC123",
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 5,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      createCaller().auth.verifyEmail({ email, code: "ABC123" })
    ).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: "验证码尝试次数过多，请重新获取验证码",
    });

    expect(mocks.db.incrementVerificationCodeAttempts).not.toHaveBeenCalled();
    expect(mocks.db.createLocalAccount).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("does not create a local session for an unverified account", async () => {
    const password = "SecurePass123!";
    const passwordHash = await hashPassword(password);
    const setCookie = vi.fn();
    mocks.db.getUserByEmail.mockResolvedValue({
      ...user,
      isEmailVerified: false,
      passwordHash,
    });
    const ctx = {
      user: null,
      req: { protocol: "https", headers: {} },
      res: { cookie: setCookie, clearCookie: vi.fn() },
    } as unknown as TrpcContext;

    await expect(
      appRouter.createCaller(ctx).auth.login({ email, password })
    ).rejects.toThrow("邮箱或密码错误");

    expect(setCookie).not.toHaveBeenCalled();
    expect(mocks.db.updateUserLastSignedIn).not.toHaveBeenCalled();
  });

  it("returns the same typed login failure for unknown emails, wrong passwords, and non-local accounts", async () => {
    const password = "SecurePass123!";
    const wrongPasswordHash = await hashPassword("DifferentSecurePass456!");
    const expectedFailure = {
      code: "UNAUTHORIZED",
      message: "邮箱或密码错误",
    };

    mocks.db.getUserByEmail.mockResolvedValueOnce(null);
    await expect(
      createCaller().auth.login({ email, password })
    ).rejects.toMatchObject(expectedFailure);

    mocks.db.getUserByEmail.mockResolvedValueOnce({
      ...user,
      passwordHash: wrongPasswordHash,
    });
    await expect(
      createCaller().auth.login({ email, password })
    ).rejects.toMatchObject(expectedFailure);

    mocks.db.getUserByEmail.mockResolvedValueOnce({
      ...user,
      loginMethod: "external",
      passwordHash: null,
    });
    await expect(
      createCaller().auth.login({ email, password })
    ).rejects.toMatchObject(expectedFailure);

    expect(console.error).not.toHaveBeenCalled();
    expect(mocks.db.updateUserLastSignedIn).not.toHaveBeenCalled();
  });

  it("rejects existing JWT sessions for an unverified local account", async () => {
    const previousSecret = process.env.CLASSCLICKER_SESSION_SECRET;
    process.env.CLASSCLICKER_SESSION_SECRET = "auth-security-regression-test-signing-key-0123456789";
    try {
      const token = await sdk.createLocalSessionToken(user.id);
      mocks.db.getUserById.mockResolvedValue({ ...user, isEmailVerified: false });
      const req = {
        headers: { cookie: `${COOKIE_NAME}=${token}` },
      } as Parameters<typeof sdk.authenticateRequest>[0];

      await expect(sdk.authenticateRequest(req)).rejects.toThrow(
        "Local account session is no longer valid"
      );
      expect(mocks.db.updateUserLastSignedIn).not.toHaveBeenCalled();
    } finally {
      if (previousSecret === undefined) delete process.env.CLASSCLICKER_SESSION_SECRET;
      else process.env.CLASSCLICKER_SESSION_SECRET = previousSecret;
    }
  });

  it("continues to accept unexpired email-verification links issued by older self-hosted versions", async () => {
    const token = "legacy-verification-token";
    mocks.db.getEmailVerificationTokenByToken.mockResolvedValue({
      id: 31,
      userId: user.id,
      token,
      email,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });
    mocks.db.getUserByEmail.mockResolvedValue({ ...user, isEmailVerified: false });

    const result = await createCaller().auth.verifyEmailToken({ token });

    expect(mocks.db.markEmailAsVerified).toHaveBeenCalledWith(user.id);
    expect(mocks.db.deleteEmailVerificationToken).toHaveBeenCalledWith(token);
    expect(mocks.db.deleteEmailSendingRateLimit).toHaveBeenCalledWith(user.id, email);
    expect(result.user).toMatchObject({ id: user.id, email, name: user.name });
  });

  it("does not claim a resend was delivered and discards the unsent token", async () => {
    mocks.db.getUserByEmail.mockResolvedValue({
      ...user,
      isEmailVerified: false,
    });
    const caller = createCaller();

    const result = await caller.auth.resendVerificationEmail({ email });
    const missingAccountResult = await (async () => {
      mocks.db.getUserByEmail.mockResolvedValue(null);
      return caller.auth.resendVerificationEmail({ email });
    })();

    expect(result).toEqual(missingAccountResult);
    expect(result.message).toContain("邮件服务正常");
    expect(mocks.db.deleteEmailVerificationToken).toHaveBeenCalledWith(
      expect.any(String)
    );
  });

  it("keeps password-reset link responses generic and removes an unsent token", async () => {
    mocks.db.getUserByEmail.mockResolvedValue(user);
    const caller = createCaller();

    const result = await caller.auth.requestPasswordReset({ email });
    expect(mocks.db.deletePasswordResetToken).toHaveBeenCalledWith(
      expect.any(String)
    );

    mocks.db.getUserByEmail.mockResolvedValue(null);
    const missingAccountResult = await caller.auth.requestPasswordReset({
      email,
    });

    expect(result).toEqual(missingAccountResult);
    expect(result.message).toContain("如果该邮箱已注册");
  });

  it("does not write reset state when production lacks APP_BASE_URL", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousAppBaseUrl = process.env.APP_BASE_URL;
    process.env.NODE_ENV = "production";
    delete process.env.APP_BASE_URL;
    mocks.db.getUserByEmail.mockResolvedValue(user);

    try {
      await expect(
        createCaller().auth.requestPasswordReset({ email })
      ).rejects.toThrow("APP_BASE_URL");
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousAppBaseUrl === undefined) delete process.env.APP_BASE_URL;
      else process.env.APP_BASE_URL = previousAppBaseUrl;
    }

    expect(mocks.db.deleteUserPasswordResetTokens).not.toHaveBeenCalled();
    expect(mocks.db.createPasswordResetToken).not.toHaveBeenCalled();
    expect(mocks.db.createEmailSendingRateLimit).not.toHaveBeenCalled();
    expect(mocks.db.updateEmailSendingRateLimit).not.toHaveBeenCalled();
    expect(mocks.db.claimEmailSendingRateLimit).not.toHaveBeenCalled();
  });

  it("sends reset codes with a reset-specific subject and discards unsent codes", async () => {
    mocks.db.getUserByEmail.mockResolvedValue(user);
    const caller = createCaller();

    const result = await caller.auth.requestPasswordResetCode({ email });
    const mail = mocks.sendEmail.mock.calls[0]?.[0];
    const unsentCode = mocks.db.deletePasswordResetCode.mock.calls[0]?.[1];

    expect(mail.subject).toBe("ClassClicker - 密码重置验证码");
    expect(mail.text).toContain(unsentCode);
    expect(mocks.db.deletePasswordResetCode).toHaveBeenCalledWith(
      email,
      expect.stringMatching(/^[0-9A-Z]{6}$/)
    );

    mocks.db.getUserByEmail.mockResolvedValue(null);
    const missingAccountResult = await caller.auth.requestPasswordResetCode({
      email,
    });
    expect(result).toEqual(missingAccountResult);
    expect(missingAccountResult.message).toContain("如果该邮箱已注册");
  });

  it("returns the same password-reset-code response for missing, OAuth, and unverified accounts", async () => {
    const caller = createCaller();
    const missing = await caller.auth.requestPasswordResetCode({ email });

    mocks.db.getUserByEmail.mockResolvedValue({ ...user, loginMethod: "oauth" });
    const oauth = await caller.auth.requestPasswordResetCode({ email });

    mocks.db.getUserByEmail.mockResolvedValue({ ...user, isEmailVerified: false });
    const unverified = await caller.auth.requestPasswordResetCode({ email });

    expect(missing).toEqual(oauth);
    expect(missing).toEqual(unverified);
    expect(mocks.db.claimEmailSendingRateLimit).not.toHaveBeenCalled();
  });

  it("uses one generic failure for invalid reset codes and rejects weak passwords before DB writes", async () => {
    const caller = createCaller();

    await expect(
      caller.auth.verifyPasswordResetCode({ email, code: "000000", newPassword: "password" })
    ).rejects.toThrow();
    expect(mocks.db.completePasswordResetWithCode).not.toHaveBeenCalled();

    mocks.db.completePasswordResetWithCode.mockResolvedValue(false);
    await expect(
      caller.auth.verifyPasswordResetCode({ email, code: "000000", newPassword: "SecurePass123!" })
    ).rejects.toThrow("验证码无效或已过期");
    expect(mocks.db.getUserByEmail).not.toHaveBeenCalled();
  });
});
