import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import fs from "fs";
import crypto from "node:crypto";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { generateSingleCard } from "./answerCardGenerator";
import { generateGlobalCards, getCachedGlobalCards } from "./globalAnswerCardGenerator";
import { withAnswerCardGenerationLock } from "./answerCardGenerationLock";
import { storagePut, storageGet, storageGetObjectBuffer, storageObjectExists } from "./storage";
import {
  requireOwnedClass,
  requireOwnedFolder,
  requireOwnedQuestion,
  requireOwnedQuestionSet,
  requireOwnedSession,
  requireOwnedStudent,
  requireQuestionInOwnedSession,
} from "./authorization";
import { registerInputSchema, loginInputSchema, hashPassword, verifyPassword, sanitizeUser, resendVerificationEmailSchema, requestPasswordResetSchema, resetPasswordSchema } from "./auth";
import { passwordPolicySchema } from "@shared/passwordPolicy";
import { generateVerificationToken, getTokenExpirationTime, isTokenExpired, generateVerificationLink, generateVerificationEmailHTML, generateVerificationEmailText, getAppBaseUrl } from "./emailVerification";
import { generateVerificationCode, getCodeExpirationTime, isCodeExpired, generateVerificationCodeEmailHTML, generateVerificationCodeEmailText, MAX_VERIFICATION_CODE_ATTEMPTS } from "./emailVerificationCode";
import { generatePasswordResetCode, getCodeExpirationTime as getPasswordResetCodeExpirationTime, isCodeExpired as isPasswordResetCodeExpired, generatePasswordResetEmailHTML, generatePasswordResetEmailText } from "./passwordResetCode";
import { sendEmail, sendTemplateEmail } from "./_core/email";
import {
  sdk,
  createStudentAccessToken,
  verifyStudentAccessToken,
} from "./_core/sdk";

const EMAIL_RESEND_RATE_LIMIT_MINUTES = 5;
const PASSWORD_RESET_RATE_LIMIT_MINUTES = 5;
const VERIFICATION_RESEND_MESSAGE =
  "如果该邮箱存在未完成验证的账户且邮件服务正常，验证邮件会发送；如未收到，请稍后重试。";
const PASSWORD_RESET_MESSAGE =
  "如果该邮箱已注册且邮件服务正常，密码重置邮件会发送；如未收到，请稍后重试。";

async function trySendEmail(
  send: () => Promise<boolean>,
  context: string
): Promise<boolean> {
  try {
    return await send();
  } catch (error) {
    console.error(context, error);
    return false;
  }
}

function inaccessible(): TRPCError {
  return new TRPCError({ code: "NOT_FOUND", message: "资源不存在或无权访问" });
}

function assertOwnedQuestionMediaUrl(teacherId: number, mediaUrl: string | null | undefined) {
  if (!mediaUrl) return;
  try {
    const origin = "https://classclicker.invalid";
    const parsed = new URL(mediaUrl, origin);
    if (parsed.origin !== origin || !parsed.pathname.startsWith("/api/storage/")) return;
    const encodedKey = parsed.pathname.slice("/api/storage/".length);
    const key = encodedKey.split("/").map(segment => decodeURIComponent(segment)).join("/");
    if (key.startsWith("questions/") && !key.startsWith(`questions/${teacherId}/`)) {
      throw inaccessible();
    }
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({ code: "BAD_REQUEST", message: "媒体地址格式无效" });
  }
}

function addParticipantTokenToMediaUrl(
  url: string | null,
  token: string,
  sessionId: number,
  studentId: number
): string | null {
  if (!url || !url.startsWith("/api/storage/")) return url;
  const [pathname, query = ""] = url.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("access_token", token);
  params.set("session_id", String(sessionId));
  params.set("student_id", String(studentId));
  return `${pathname}?${params.toString()}`;
}

function normalizeSubmittedAnswer(answer: string, questionType: string): string {
  const normalized = answer.trim().toUpperCase();
  if (questionType === "multiple_choice") {
    if (!/^[A-D]{1,4}$/.test(normalized) || new Set(normalized).size !== normalized.length) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "多选答案格式无效" });
    }
    return normalized.split("").sort().join("");
  }

  const allowedAnswers = questionType === "true_false" ? ["A", "B"] : ["A", "B", "C", "D"];
  if (normalized.length !== 1 || !allowedAnswers.includes(normalized)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "答案选项无效" });
  }
  return normalized;
}

function isSubmittedAnswerCorrect(answer: string, correctAnswer: string, questionType: string): boolean {
  const normalizedCorrect = questionType === "multiple_choice"
    ? correctAnswer.trim().toUpperCase().split("").sort().join("")
    : correctAnswer.trim().toUpperCase();
  return answer === normalizedCorrect;
}

async function getStudentAccessContext(input: {
  sessionId: number;
  studentId: number;
  token: string;
}) {
  if (!(await verifyStudentAccessToken(input.token, input.sessionId, input.studentId))) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "学生答题链接无效或已过期" });
  }

  const session = await db.getSessionById(input.sessionId);
  const student = await db.getStudentById(input.studentId);
  if (!session || !student || session.status !== "active" || student.classId !== session.classId) {
    throw inaccessible();
  }

  const [classRecord, questionSet] = await Promise.all([
    db.getClassById(session.classId),
    db.getQuestionSetById(session.setId),
  ]);
  if (
    !classRecord ||
    !questionSet ||
    classRecord.teacherId !== session.teacherId ||
    questionSet.teacherId !== session.teacherId
  ) {
    throw inaccessible();
  }

  const queue = await db.getSessionQueue(input.sessionId);
  const queueIndex = queue.findIndex(item => item.isActive);
  if (queueIndex < 0) throw inaccessible();
  const activeItem = queue[queueIndex];
  if (!activeItem) throw inaccessible();

  const question = await db.getQuestionById(activeItem.questionId);
  if (!question || question.setId !== session.setId) throw inaccessible();

  return { session, student, classRecord, question, queue, queueIndex };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts =>
      opts.ctx.user ? sanitizeUser(opts.ctx.user) : null
    ),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    register: publicProcedure
      .input(registerInputSchema)
      .mutation(async ({ input }) => {
        try {
          const existingUser = await db.getUserByEmail(input.email);
          if (existingUser && (existingUser.isEmailVerified || existingUser.loginMethod !== "local")) {
            throw new TRPCError({ code: "CONFLICT", message: "邮箱已被使用" });
          }

          const now = new Date();
          if (!(await db.claimEmailSendingRateLimit(0, input.email, now, EMAIL_RESEND_RATE_LIMIT_MINUTES))) {
            throw new Error("请稍后再试");
          }

          // 临时记录只保存 bcrypt 哈希，浏览器不会持久化明文密码。
          const passwordHash = await hashPassword(input.password);
          const verificationCode = generateVerificationCode();
          const expiresAt = getCodeExpirationTime();

          try {
            await db.createEmailVerificationCode({
              userId: 0,
              code: verificationCode,
              email: input.email,
              name: input.name,
              passwordHash,
              expiresAt,
              attempts: 0,
              verified: false,
            });
            await db.upsertEmailSendingRateLimit(0, input.email, new Date());
          } catch (codeError) {
            console.error("[Auth] Failed to create pending registration verification:", codeError);
            await db.deleteEmailSendingRateLimit(0, input.email);
            throw new Error("验证码生成失败，请重试");
          }

          const emailSent = await trySendEmail(
            () => sendTemplateEmail({
              to: input.email,
              templateId: 168247,
              templateData: { code: verificationCode },
            }),
            "[Auth] Failed to send verification email:"
          );
          if (!emailSent) {
            try {
              await db.deleteEmailVerificationCodeByCode(verificationCode);
              await db.deleteEmailSendingRateLimit(0, input.email);
            } catch (cleanupError) {
              console.error("[Auth] Failed to discard undelivered registration code:", cleanupError);
            }
            throw new Error("验证邮件发送失败，请检查邮件服务配置后重试");
          }

          return {
            success: true,
            message: "验证码已发送到您的邮箱，请查收",
            email: input.email,
          };
        } catch (error) {
          if (!(error instanceof TRPCError && error.code === "CONFLICT")) {
            console.error("[Auth] Registration error:", error);
          }
          throw error;
        }
      }),
    login: publicProcedure
      .input(loginInputSchema)
      .mutation(async ({ input, ctx }) => {
        const invalidCredentials = () =>
          new TRPCError({ code: "UNAUTHORIZED", message: "邮箱或密码错误" });
        try {
          const user = await db.getUserByEmail(input.email);
          if (!user) {
            throw invalidCredentials();
          }
          if (user.loginMethod !== "local" || !user.passwordHash) {
            throw invalidCredentials();
          }
          const isPasswordValid = await verifyPassword(
            input.password,
            user.passwordHash
          );
          if (!isPasswordValid || !user.isEmailVerified) {
            throw invalidCredentials();
          }
          
          // Local email accounts use first-party JWT sessions.
          const sessionToken = await sdk.createLocalSessionToken(user.id);
          
          // 设置会话Cookie
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, sessionToken, {
            ...cookieOptions,
            maxAge: ONE_YEAR_MS,
          });
          
          // 更新最后登录时间
          await db.updateUserLastSignedIn(user.id);
          
          return {
            success: true,
            user: sanitizeUser(user),
          };
        } catch (error) {
          if (!(error instanceof TRPCError && error.code === "UNAUTHORIZED")) {
            console.error("[Auth] Login error:", error);
          }
          throw error;
        }
      }),
    verifyEmail: publicProcedure
      .input(z.object({
        code: z.string().trim().min(6, "验证码不能为空").max(10, "验证码格式不正确"),
        email: z.string().email("邮箱格式不正确").trim().toLowerCase(),
      }))
      .mutation(async ({ input }) => {
        const code = input.code.toUpperCase();
        const badVerificationCode = (message: string) =>
          new TRPCError({ code: "BAD_REQUEST", message });
        try {
          const pendingRecord = await db.getPendingRegistrationVerificationCode(input.email);
          const legacyUser = pendingRecord ? null : await db.getUserByEmail(input.email);
          const legacyRecord =
            legacyUser &&
            legacyUser.loginMethod === "local" &&
            !legacyUser.isEmailVerified
              ? await db.getEmailVerificationCodeByUserAndEmail(legacyUser.id, input.email)
              : null;
          const codeRecord = pendingRecord || legacyRecord;

          if (!codeRecord || codeRecord.verified) {
            throw badVerificationCode("验证码无效或已过期，请重新获取");
          }
          if (codeRecord.attempts >= MAX_VERIFICATION_CODE_ATTEMPTS) {
            throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "验证码尝试次数过多，请重新获取验证码" });
          }
          if (isCodeExpired(codeRecord.expiresAt)) {
            throw badVerificationCode("验证码已过期，请重新获取");
          }
          if (codeRecord.code.toUpperCase() !== code) {
            await db.incrementVerificationCodeAttempts(codeRecord.id);
            throw badVerificationCode("验证码无效或已过期，请重新获取");
          }

          if (codeRecord.userId === 0) {
            if (!codeRecord.passwordHash || !codeRecord.name) {
              throw badVerificationCode("验证码无效或已过期，请重新注册");
            }
            const newUser = await db.completePendingRegistrationVerification(
              input.email,
              codeRecord.id,
              code
            );
            if (!newUser) throw badVerificationCode("验证码无效或已使用，请重新获取");

            return {
              success: true,
              message: "邮箱验证成功",
              user: { id: newUser.id, email: newUser.email, name: newUser.name },
            };
          }

          // 兼容已有自托管安装中仍未验证的本地账户。
          const existingUser = legacyUser;
          if (!existingUser || existingUser.id !== codeRecord.userId || existingUser.isEmailVerified) {
            throw badVerificationCode("验证码无效或已使用");
          }
          const verifiedUser = await db.completeExistingEmailVerification(
            existingUser.id,
            input.email,
            codeRecord.id,
            code
          );
          if (!verifiedUser) throw badVerificationCode("验证码无效或已使用");
          return {
            success: true,
            message: "邮箱验证成功",
            user: verifiedUser,
          };
        } catch (error) {
          const isExpectedVerificationError =
            error instanceof TRPCError &&
            (error.code === "BAD_REQUEST" || error.code === "TOO_MANY_REQUESTS");
          if (!isExpectedVerificationError) {
            console.error("[Auth] Email verification error:", error);
          }
          throw error;
        }
      }),
    verifyEmailToken: publicProcedure
      .input(z.object({ token: z.string().trim().min(1).max(255) }))
      .mutation(async ({ input }) => {
        try {
          const tokenRecord = await db.getEmailVerificationTokenByToken(input.token);
          if (!tokenRecord) throw new Error("验证链接无效或已使用");
          if (isTokenExpired(tokenRecord.expiresAt)) {
            await db.deleteEmailVerificationToken(input.token);
            throw new Error("验证链接已过期，请重新发送验证邮件");
          }

          const user = await db.getUserByEmail(tokenRecord.email);
          if (!user || user.id !== tokenRecord.userId || user.loginMethod !== "local") {
            throw new Error("验证链接无效或已使用");
          }

          if (!user.isEmailVerified) await db.markEmailAsVerified(user.id);
          await db.deleteEmailVerificationToken(input.token);
          if (user.email) await db.deleteEmailSendingRateLimit(user.id, user.email);

          return {
            success: true,
            message: "邮箱验证成功",
            user: { id: user.id, email: user.email, name: user.name },
          };
        } catch (error) {
          console.error("[Auth] Legacy email token verification error:", error);
          throw error;
        }
      }),
    resendVerificationEmail: publicProcedure
      .input(resendVerificationEmailSchema)
      .mutation(async ({ input }) => {
        try {
          const response = {
            success: true,
            message: VERIFICATION_RESEND_MESSAGE,
            remainingSeconds: EMAIL_RESEND_RATE_LIMIT_MINUTES * 60,
          };
          const pending = await db.getPendingRegistrationVerificationCode(input.email);

          if (pending?.passwordHash && pending.name) {
            const now = new Date();
            if (!(await db.claimEmailSendingRateLimit(0, input.email, now, EMAIL_RESEND_RATE_LIMIT_MINUTES))) return response;

            const code = generateVerificationCode();
            await db.createEmailVerificationCode({
              userId: 0,
              code,
              email: input.email,
              name: pending.name,
              passwordHash: pending.passwordHash,
              expiresAt: getCodeExpirationTime(),
              attempts: 0,
              verified: false,
            });

            const emailSent = await trySendEmail(
              () => sendTemplateEmail({
                to: input.email,
                templateId: 168247,
                templateData: { code },
              }),
              "[Auth] Failed to resend registration verification code:"
            );
            if (!emailSent) {
              try {
                await db.deleteEmailVerificationCodeByCode(code);
                await db.deleteEmailSendingRateLimit(0, input.email);
              } catch (cleanupError) {
                console.error("[Auth] Failed to discard undelivered registration code:", cleanupError);
              }
              return response;
            }

            return response;
          }

          // 兼容原有安装中的未验证本地账户；响应不披露邮箱是否存在。
          const user = await db.getUserByEmail(input.email);
          if (!user || user.isEmailVerified || user.loginMethod !== "local" || !user.email) {
            return response;
          }

          const token = generateVerificationToken();
          let verificationLink: string;
          try {
            verificationLink = generateVerificationLink(token);
          } catch (error) {
            console.error("[Auth] Cannot build public verification link:", error);
            return response;
          }
          const now = new Date();
          if (!(await db.claimEmailSendingRateLimit(user.id, user.email, now, EMAIL_RESEND_RATE_LIMIT_MINUTES))) {
            return response;
          }
          await db.deleteUserEmailVerificationTokens(user.id);
          await db.createEmailVerificationToken({
            userId: user.id,
            token,
            email: user.email,
            expiresAt: getTokenExpirationTime(),
          });
          const emailSent = await trySendEmail(
            () => sendEmail({
              to: user.email!,
              subject: "ClassClicker - 邮箱验证",
              html: generateVerificationEmailHTML(user.name || "用户", verificationLink),
              text: generateVerificationEmailText(user.name || "用户", verificationLink),
            }),
            "[Auth] Failed to resend verification email:"
          );
          if (!emailSent) {
            try {
              await db.deleteEmailVerificationToken(token);
              await db.deleteEmailSendingRateLimit(user.id, user.email);
            } catch (cleanupError) {
              console.error("[Auth] Failed to discard undelivered verification token:", cleanupError);
            }
          }
          return response;
        } catch (error) {
          console.error("[Auth] Resend verification email error:", error);
          throw error;
        }
      }),
    requestPasswordReset: publicProcedure
      .input(requestPasswordResetSchema)
      .mutation(async ({ input }) => {
        try {
          // Build and validate the public origin before any database reads or writes.
          const appBaseUrl = getAppBaseUrl();
          const response = {
            success: true,
            message: PASSWORD_RESET_MESSAGE,
            remainingSeconds: 0,
          };
          const user = await db.getUserByEmail(input.email);
          if (!user || user.loginMethod !== "local" || !user.isEmailVerified || !user.email) return response;

          const now = new Date();
          if (!(await db.claimEmailSendingRateLimit(user.id, user.email, now, PASSWORD_RESET_RATE_LIMIT_MINUTES))) {
            return response;
          }
          
          // 生成密码重置令牌
          const token = generateVerificationToken();
          const expiresAt = getTokenExpirationTime();
          
          // 删除旧的密码重置令牌
          await db.deleteUserPasswordResetTokens(user.id);
          
          // 创建新的密码重置令牌
          await db.createPasswordResetToken({
            userId: user.id,
            token,
            email: user.email!,
            expiresAt,
          });
          
          // 生成密码重置链接
          const resetLink = `${appBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;
          const htmlContent = `
            <h2>密码重置请求</h2>
            <p>您好 ${sanitizeUser(user).name || "用户"},</p>
            <p>我们收到了您的密码重置请求。请点击下方链接重置您的密码：</p>
            <p><a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">重置密码</a></p>
            <p>或复制以下链接到浏览器：</p>
            <p>${resetLink}</p>
            <p>此链接有效期为 24 小时。</p>
            <p>如果您没有请求重置密码，请忽略此邮件。</p>
            <p>ClassClicker 团队</p>
          `;
          const textContent = `
密码重置请求

您好 ${sanitizeUser(user).name || "用户"},

我们收到了您的密码重置请求。请访问以下链接重置您的密码：

${resetLink}

此链接有效期为 24 小时。

如果您没有请求重置密码，请忽略此邮件。

ClassClicker 团队
          `;
          
          const emailSent = await trySendEmail(
            () =>
              sendEmail({
                to: user.email!,
                subject: "ClassClicker - 密码重置",
                html: htmlContent,
                text: textContent,
              }),
            "[Auth] Failed to send password reset email:"
          );
          if (!emailSent) {
            try {
              await db.deletePasswordResetToken(token);
              await db.deleteEmailSendingRateLimit(user.id, user.email);
            } catch (cleanupError) {
              console.error(
                "[Auth] Failed to discard undelivered password reset token:",
                cleanupError
              );
            }
          }
          
          return response;
        } catch (error) {
          console.error("[Auth] Request password reset error:", error);
          throw error;
        }
      }),
    resetPassword: publicProcedure
      .input(resetPasswordSchema)
      .mutation(async ({ input }) => {
        try {
          const tokenRecord = await db.getPasswordResetTokenByToken(input.token);
          if (!tokenRecord) {
            throw new Error("重置令牌无效或已过期");
          }
          
          if (isTokenExpired(tokenRecord.expiresAt)) {
            await db.deletePasswordResetToken(input.token);
            throw new Error("重置令牌已过期，请重新申请");
          }
          
          if (tokenRecord.usedAt) {
            throw new Error("此重置令牌已被使用");
          }
          
          // 对新密码进行哈希
          const passwordHash = await hashPassword(input.password);
          
          // Consume the bearer token and update the password in one atomic transaction.
          const resetCompleted = await db.completePasswordResetWithToken(
            input.token,
            tokenRecord.userId,
            passwordHash
          );
          if (!resetCompleted) {
            throw new Error("重置令牌已被使用或已过期");
          }
          
          return {
            success: true,
            message: "密码重置成功，请使用新密码登录",
          };
        } catch (error) {
          console.error("[Auth] Reset password error:", error);
          throw error;
        }
      }),
    requestPasswordResetCode: publicProcedure
      .input(z.object({ email: z.string().email().trim().toLowerCase() }))
      .mutation(async ({ input }) => {
        const response = { success: true, message: PASSWORD_RESET_MESSAGE };
        try {
          const user = await db.getUserByEmail(input.email);
          if (!user || user.loginMethod !== "local" || !user.isEmailVerified || !user.email) return response;

          const now = new Date();
          if (!(await db.claimEmailSendingRateLimit(user.id, user.email, now, PASSWORD_RESET_RATE_LIMIT_MINUTES))) {
            return response;
          }

          // 生成密码重置验证码
          const code = generatePasswordResetCode();
          const expiresAt = getPasswordResetCodeExpirationTime();
          
          // 创建验证码
          await db.createPasswordResetCode(input.email, code, expiresAt);
          
          // 密码重置使用独立的邮件主题和正文，不复用“邮箱验证”模板。
          const emailSent = await trySendEmail(
            () =>
              sendEmail({
                to: input.email,
                subject: "ClassClicker - 密码重置验证码",
                html: generatePasswordResetEmailHTML(input.email, code),
                text: generatePasswordResetEmailText(input.email, code),
              }),
            "[Auth] Failed to send password reset code email:"
          );
          if (!emailSent) {
            try {
              await db.deletePasswordResetCode(input.email, code);
            } catch (cleanupError) {
              console.error(
                "[Auth] Failed to discard undelivered password reset code:",
                cleanupError
              );
            }
            try {
              await db.deleteEmailSendingRateLimit(user.id, user.email);
            } catch (cleanupError) {
              console.error("[Auth] Failed to release reset email rate limit:", cleanupError);
            }
          }
          
          return {
            success: true,
            message: PASSWORD_RESET_MESSAGE,
          };
        } catch (error) {
          console.error("[Auth] Request password reset code error:", error);
          throw error;
        }
      }),
    verifyPasswordResetCode: publicProcedure
      .input(z.object({
        email: z.string().email().trim().toLowerCase(),
        code: z.string().trim().min(6).max(6),
        newPassword: passwordPolicySchema,
      }))
      .mutation(async ({ input }) => {
        try {
          const passwordHash = await hashPassword(input.newPassword);
          const resetCompleted = await db.completePasswordResetWithCode(
            input.email,
            input.code.toUpperCase(),
            passwordHash
          );
          if (!resetCompleted) throw new Error("验证码无效或已过期");
          
          return {
            success: true,
            message: "密码重置成功，请使用新密码登录",
          };
        } catch (error) {
          console.error("[Auth] Verify password reset code error:", error);
          throw error;
        }
      }),
    
    // 更新用户资料
    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().min(1, "昵称不能为空").max(100, "昵称过长").optional(),
        avatarUrl: z.string().url("头像URL格式不正确").optional().or(z.literal(null)),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user) {
            throw new Error("未登录");
          }
          
          const updates: Record<string, any> = {};
          if (input.name !== undefined) {
            updates.name = input.name;
          }
          if (input.avatarUrl !== undefined) {
            updates.avatarUrl = input.avatarUrl;
          }
          
          if (Object.keys(updates).length === 0) {
            return ctx.user;
          }
          
          const updatedUser = await db.updateUser(ctx.user.id, updates);
          return sanitizeUser(updatedUser);
        } catch (error) {
          console.error("[Auth] Update profile error:", error);
          throw error;
        }
      }),
    
    // 微信相关接口
    bindWeChat: protectedProcedure
      .input(z.object({
        wechatId: z.string().min(1, "微信ID不能为空"),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user) {
            throw new Error("未登录");
          }
          
          // 检查微信ID是否已被其他用户使用
          const existingUser = await db.getUserByWeChatId(input.wechatId);
          if (existingUser && existingUser.id !== ctx.user.id) {
            throw new Error("此微信账号已被绑定");
          }
          
          // 更新用户的微信ID
          const updatedUser = await db.updateUser(ctx.user.id, {
            wechatId: input.wechatId,
          });
          
          return {
            success: true,
            message: "微信账号绑定成功",
            user: sanitizeUser(updatedUser),
          };
        } catch (error) {
          console.error("[Auth] Bind WeChat error:", error);
          throw error;
        }
      }),
    
    unbindWeChat: protectedProcedure
      .mutation(async ({ ctx }) => {
        try {
          if (!ctx.user) {
            throw new Error("未登录");
          }
          
          // 解绑微信ID
          const updatedUser = await db.updateUser(ctx.user.id, {
            wechatId: null,
          });
          
          return {
            success: true,
            message: "微信账号已解绑",
            user: sanitizeUser(updatedUser),
          };
        } catch (error) {
          console.error("[Auth] Verify email error:", error);
          throw error;
        }
      }),
    
    bindQQ: protectedProcedure
      .input(z.object({
        qqId: z.string().min(1, "QQ ID不能为空"),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user) {
            throw new Error("未登录");
          }
          
          // 检查QQ ID是否已被其他用户使用
          const existingUser = await db.getUserByQQId(input.qqId);
          if (existingUser && existingUser.id !== ctx.user.id) {
            throw new Error("此QQ账号已被绑定");
          }
          
          // 更新用户的QQ ID
          const updatedUser = await db.updateUser(ctx.user.id, {
            qqId: input.qqId,
          });
          
          return {
            success: true,
            message: "QQ账号绑定成功",
            user: sanitizeUser(updatedUser),
          };
        } catch (error) {
          console.error("[Auth] Bind QQ error:", error);
          throw error;
        }
      }),
    
    unbindQQ: protectedProcedure
      .mutation(async ({ ctx }) => {
        try {
          if (!ctx.user) {
            throw new Error("未登录");
          }
          
          // 解绑QQ ID
          const updatedUser = await db.updateUser(ctx.user.id, {
            qqId: null,
          });
          
          return {
            success: true,
            message: "QQ账号已解绑",
            user: sanitizeUser(updatedUser),
          };
        } catch (error) {
          console.error("[Auth] Unbind QQ error:", error);
          throw error;
        }
      }),
    
    bindDouyin: protectedProcedure
      .input(z.object({
        douyinId: z.string().min(1, "抖音ID不能为空"),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user) {
            throw new Error("未登录");
          }
          
          // 检查抖音ID是否已被其他用户使用
          const existingUser = await db.getUserByDouyinId(input.douyinId);
          if (existingUser && existingUser.id !== ctx.user.id) {
            throw new Error("此抖音账号已被绑定");
          }
          
          // 更新用户的抖音ID
          const updatedUser = await db.updateUser(ctx.user.id, {
            douyinId: input.douyinId,
          });
          
          return {
            success: true,
            message: "抖音账号绑定成功",
            user: sanitizeUser(updatedUser),
          };
        } catch (error) {
          console.error("[Auth] Bind Douyin error:", error);
          throw error;
        }
      }),
    
    unbindDouyin: protectedProcedure
      .mutation(async ({ ctx }) => {
        try {
          if (!ctx.user) {
            throw new Error("未登录");
          }
          
          // 解绑抖音ID
          const updatedUser = await db.updateUser(ctx.user.id, {
            douyinId: null,
          });
          
          return {
            success: true,
            message: "抖音账号已解绑",
            user: sanitizeUser(updatedUser),
          };
        } catch (error) {
          console.error("[Auth] Unbind Douyin error:", error);
          throw error;
        }
      }),
  }),

  // ============ Classes Router ============
  classes: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getClassesByTeacher(ctx.user.id);
    }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const classId = await db.createClass({
          teacherId: ctx.user.id,
          name: input.name,
          description: input.description || null,
        });
        return { classId };
      }),
    
    get: protectedProcedure
      .input(z.object({ classId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        return await requireOwnedClass(ctx.user.id, input.classId);
      }),
    
    update: protectedProcedure
      .input(z.object({
        classId: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireOwnedClass(ctx.user.id, input.classId);
        const { classId, ...data } = input;
        await db.updateClass(classId, data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ classId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await requireOwnedClass(ctx.user.id, input.classId);
        await db.deleteClass(input.classId);
        return { success: true };
      }),
  }),

  // ============ Students Router ============
  students: router({
    list: protectedProcedure
      .input(z.object({ classId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireOwnedClass(ctx.user.id, input.classId);
        return await db.getStudentsByClass(input.classId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        classId: z.number(),
        name: z.string().min(1).max(255),
        cardNumber: z.number().min(1).max(40).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireOwnedClass(ctx.user.id, input.classId);
        const existing = await db.getStudentsByClass(input.classId);
        const cardNumber = input.cardNumber || await db.getNextAvailableCardNumber(input.classId);
        if (existing.some(student => student.cardNumber === cardNumber)) {
          throw new TRPCError({ code: "CONFLICT", message: "该班级已使用此答题卡号" });
        }
        const studentId = await db.createStudent({
          classId: input.classId,
          name: input.name,
          cardNumber,
        });
        return { studentId, cardNumber };
      }),
    
    update: protectedProcedure
      .input(z.object({
        studentId: z.number(),
        name: z.string().min(1).max(255).optional(),
        cardNumber: z.number().min(1).max(40).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const student = await requireOwnedStudent(ctx.user.id, input.studentId);
        if (input.cardNumber !== undefined) {
          const existing = await db.getStudentsByClass(student.classId);
          if (existing.some(item => item.id !== student.id && item.cardNumber === input.cardNumber)) {
            throw new TRPCError({ code: "CONFLICT", message: "该班级已使用此答题卡号" });
          }
        }
        const { studentId, ...data } = input;
        await db.updateStudent(studentId, data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ studentId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await requireOwnedStudent(ctx.user.id, input.studentId);
        await db.deleteStudent(input.studentId);
        return { success: true };
      }),
    
    getNextCardNumber: protectedProcedure
      .input(z.object({ classId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireOwnedClass(ctx.user.id, input.classId);
        return await db.getNextAvailableCardNumber(input.classId);
      }),
    
    bulkImport: protectedProcedure
      .input(z.object({
        classId: z.number(),
        students: z.array(z.object({
          name: z.string().min(1).max(255),
          cardNumber: z.number().min(1).max(40).optional(),
        })).min(1).max(40),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireOwnedClass(ctx.user.id, input.classId);
        const results = await db.bulkImportStudents(input.classId, input.students);
        return {
          success: true,
          imported: results.length,
          students: results,
        };
      }),
  }),

  // ============ Question Sets Router ============
  // ============ Question Folders Router ============
  questionFolders: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const folders = await db.getQuestionFoldersByTeacher(ctx.user.id);
      const foldersWithCounts = await Promise.all(
        folders.map(async (folder) => ({
          ...folder,
          questionSetCount: await db.countQuestionSetsInFolder(folder.id),
          subFolderCount: await db.countSubFoldersInFolder(folder.id),
        }))
      );
      return foldersWithCounts;
    }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        parentFolderId: z.number().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireOwnedFolder(ctx.user.id, input.parentFolderId);
        const folderId = await db.createQuestionFolder({
          teacherId: ctx.user.id,
          name: input.name,
          description: input.description || null,
          parentFolderId: input.parentFolderId || null,
        });
        return { folderId };
      }),
    
    get: protectedProcedure
      .input(z.object({ folderId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await requireOwnedFolder(ctx.user.id, input.folderId);
      }),
    
    update: protectedProcedure
      .input(z.object({
        folderId: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireOwnedFolder(ctx.user.id, input.folderId);
        const { folderId, ...data } = input;
        await db.updateQuestionFolder(folderId, data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ folderId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await requireOwnedFolder(ctx.user.id, input.folderId);
        await db.deleteQuestionFolder(input.folderId);
        return { success: true };
      }),
  }),

  // ============ Question Sets Router ============
  questionSets: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getQuestionSetsByTeacher(ctx.user.id);
    }),
    
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        folderId: z.number().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireOwnedFolder(ctx.user.id, input.folderId);
        const setId = await db.createQuestionSet({
          teacherId: ctx.user.id,
          title: input.title,
          description: input.description || null,
          folderId: input.folderId || null,
        });
        return { setId };
      }),
    
    get: protectedProcedure
      .input(z.object({ setId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await requireOwnedQuestionSet(ctx.user.id, input.setId);
      }),
    
    update: protectedProcedure
      .input(z.object({
        setId: z.number(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireOwnedQuestionSet(ctx.user.id, input.setId);
        const { setId, ...data } = input;
        await db.updateQuestionSet(setId, data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ setId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await requireOwnedQuestionSet(ctx.user.id, input.setId);
        await db.deleteQuestionSet(input.setId);
        return { success: true };
      }),
    
    getClassesForSet: protectedProcedure
      .input(z.object({ setId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireOwnedQuestionSet(ctx.user.id, input.setId);
        return await db.getClassesByQuestionSet(ctx.user.id, input.setId);
      }),
    
    move: protectedProcedure
      .input(z.object({
        setId: z.number(),
        folderId: z.number().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireOwnedQuestionSet(ctx.user.id, input.setId);
        await requireOwnedFolder(ctx.user.id, input.folderId);
        await db.updateQuestionSet(input.setId, { folderId: input.folderId });
        return { success: true };
      }),
    
    getByFolder: protectedProcedure
      .input(z.object({ folderId: z.number().nullable() }))
      .query(async ({ ctx, input }) => {
        await requireOwnedFolder(ctx.user.id, input.folderId);
        return await db.getQuestionSetsByFolder(ctx.user.id, input.folderId);
      }),
  }),

  // ============ Questions Router ============
  questions: router({
    list: protectedProcedure
      .input(z.object({ setId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireOwnedQuestionSet(ctx.user.id, input.setId);
        return await db.getQuestionsBySet(input.setId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        setId: z.number(),
        questionText: z.string().min(1),
        questionType: z.enum(["multiple_choice", "single_choice", "true_false"]),
        optionA: z.string().optional(),
        optionB: z.string().optional(),
        optionC: z.string().optional(),
        optionD: z.string().optional(),
        optionAMediaUrl: z.string().optional(),
        optionBMediaUrl: z.string().optional(),
        optionCMediaUrl: z.string().optional(),
        optionDMediaUrl: z.string().optional(),
        questionMediaUrl: z.string().optional(),
        questionMediaType: z.enum(["image", "video"]).optional(),
        correctAnswer: z.string().min(1).max(10),
        orderIndex: z.number().default(0),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireOwnedQuestionSet(ctx.user.id, input.setId);
        for (const mediaUrl of [
          input.questionMediaUrl,
          input.optionAMediaUrl,
          input.optionBMediaUrl,
          input.optionCMediaUrl,
          input.optionDMediaUrl,
        ]) {
          assertOwnedQuestionMediaUrl(ctx.user.id, mediaUrl);
        }
        const questionId = await db.createQuestion(input);
        return { questionId };
      }),
    
    get: protectedProcedure
      .input(z.object({ questionId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        return await requireOwnedQuestion(ctx.user.id, input.questionId);
      }),
    
    update: protectedProcedure
      .input(z.object({
        questionId: z.number(),
        questionText: z.string().min(1).optional(),
        questionType: z.enum(["multiple_choice", "single_choice", "true_false"]).optional(),
        optionA: z.string().optional(),
        optionB: z.string().optional(),
        optionC: z.string().optional(),
        optionD: z.string().optional(),
        optionAMediaUrl: z.string().optional(),
        optionBMediaUrl: z.string().optional(),
        optionCMediaUrl: z.string().optional(),
        optionDMediaUrl: z.string().optional(),
        questionMediaUrl: z.string().optional(),
        questionMediaType: z.enum(["image", "video"]).optional(),
        correctAnswer: z.string().min(1).max(10).optional(),
        orderIndex: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireOwnedQuestion(ctx.user.id, input.questionId);
        for (const mediaUrl of [
          input.questionMediaUrl,
          input.optionAMediaUrl,
          input.optionBMediaUrl,
          input.optionCMediaUrl,
          input.optionDMediaUrl,
        ]) {
          assertOwnedQuestionMediaUrl(ctx.user.id, mediaUrl);
        }
        const { questionId, ...data } = input;
        await db.updateQuestion(questionId, data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ questionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await requireOwnedQuestion(ctx.user.id, input.questionId);
        await db.deleteQuestion(input.questionId);
        return { success: true };
      }),
  }),

  // ============ Sessions Router ============
  sessions: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getRecentSessionsByQuestionSet(ctx.user.id);
    }),
    
    validSessions: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        return await db.getValidSessions(ctx.user.id);
      }),
    }),
    
    create: protectedProcedure
      .input(z.object({
        classId: z.number(),
        setId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireOwnedClass(ctx.user.id, input.classId);
        await requireOwnedQuestionSet(ctx.user.id, input.setId);
        const sessionId = await db.createSession({
          teacherId: ctx.user.id,
          classId: input.classId,
          setId: input.setId,
          status: "pending",
        });
        
        // Add all questions from the set to the session queue
        const questions = await db.getQuestionsBySet(input.setId);
        for (let i = 0; i < questions.length; i++) {
          await db.addToSessionQueue({
            sessionId,
            questionId: questions[i]!.id,
            orderIndex: i,
            isActive: i === 0, // First question is active by default
          });
        }
        
        return { sessionId };
      }),
    
    get: protectedProcedure
      .input(z.object({ sessionId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const session = await requireOwnedSession(ctx.user.id, input.sessionId);
        const classInfo = await db.getClassById(session.classId);
        const setInfo = await db.getQuestionSetById(session.setId);
        const queue = await db.getSessionQueue(input.sessionId);
        return { ...session, class: classInfo, questionSet: setInfo, queue };
      }),
    
    start: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const session = await requireOwnedSession(ctx.user.id, input.sessionId);
        if (session.status === "completed") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "已结束的会话不能重新开始" });
        }
        if (session.status === "active") return { success: true };
        const queue = await db.getSessionQueue(input.sessionId);
        if (queue.length === 0 || !queue.some(item => item.isActive)) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "会话没有可开始的题目" });
        }
        await db.updateSession(input.sessionId, {
          status: "active",
          startedAt: new Date(),
        });
        return { success: true };
      }),
    
    complete: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await requireOwnedSession(ctx.user.id, input.sessionId);
        await db.updateSession(input.sessionId, {
          status: "completed",
          completedAt: new Date(),
        });
        return { success: true };
      }),
    
    setActiveQuestion: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        questionId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireQuestionInOwnedSession(ctx.user.id, input.sessionId, input.questionId);
        await db.setActiveQuestion(input.sessionId, input.questionId);
        return { success: true };
      }),
    
    getQueue: protectedProcedure
      .input(z.object({ sessionId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await requireOwnedSession(ctx.user.id, input.sessionId);
        return await db.getSessionQueue(input.sessionId);
      }),
    
    getQueueWithQuestions: protectedProcedure
      .input(z.object({ sessionId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await requireOwnedSession(ctx.user.id, input.sessionId);
        return await db.getSessionQueueWithQuestions(input.sessionId);
      }),
    
    delete: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await requireOwnedSession(ctx.user.id, input.sessionId);
        await db.deleteSession(input.sessionId);
        return { success: true };
      }),
    
    getStudentsWithAnswerStatus: protectedProcedure
      .input(z.object({ sessionId: z.number().int().positive(), questionId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const { session } = await requireQuestionInOwnedSession(ctx.user.id, input.sessionId, input.questionId);
        const students = await db.getStudentsByClass(session.classId);
        const answers = await db.getAnswersBySessionAndQuestion(input.sessionId, input.questionId);
        
        const answerMap = new Map();
        answers.forEach(answer => {
          answerMap.set(answer.studentId, answer);
        });
        
        return students.map(student => ({
          ...student,
          hasAnswered: answerMap.has(student.id),
          answer: answerMap.get(student.id)?.answer || null,
        }));
      }),
    
    scanAnswerCard: protectedProcedure
      .input(z.object({
        sessionId: z.number().int().positive(),
        questionId: z.number().int().positive(),
        cardNumber: z.number().int().min(1).max(40),
        answer: z.string().trim().regex(/^[A-D]{1,4}$/i),
      }))
      .mutation(async ({ ctx, input }) => {
        const { session, question } = await requireQuestionInOwnedSession(ctx.user.id, input.sessionId, input.questionId);
        const students = await db.getStudentsByClass(session.classId);
        const student = students.find(s => s.cardNumber === input.cardNumber);
        if (!student) throw inaccessible();
        const normalizedAnswer = normalizeSubmittedAnswer(input.answer, question.questionType);
        const isCorrect = isSubmittedAnswerCorrect(normalizedAnswer, question.correctAnswer, question.questionType);
        const answerId = await db.submitAnswer({
          sessionId: input.sessionId,
          questionId: input.questionId,
          studentId: student.id,
          answer: normalizedAnswer,
          isCorrect,
        });
        return { answerId, isCorrect, studentId: student.id, studentName: student.name };
      }),

    getStudentAccessLinks: protectedProcedure
      .input(z.object({ sessionId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const session = await requireOwnedSession(ctx.user.id, input.sessionId);
        const students = await db.getStudentsByClass(session.classId);
        return Promise.all(students.map(async student => ({
          studentId: student.id,
          studentName: student.name,
          token: await createStudentAccessToken(session.id, student.id),
        })));
      }),
  }),

  studentAccess: router({
    getSession: publicProcedure
      .input(z.object({
        sessionId: z.number().int().positive(),
        studentId: z.number().int().positive(),
        token: z.string().min(1).max(4096),
      }))
      .query(async ({ input }) => {
        const access = await getStudentAccessContext(input);
        const answerRows = await db.getAnswersBySessionAndQuestion(
          input.sessionId,
          access.question.id
        );
        const ownAnswer = answerRows.find(answer => answer.studentId === input.studentId);
        const question = access.question;
        return {
          className: access.classRecord.name,
          studentName: access.student.name,
          questionNumber: access.queueIndex + 1,
          questionCount: access.queue.length,
          question: {
            id: question.id,
            questionText: question.questionText,
            questionType: question.questionType,
            optionA: question.optionA,
            optionB: question.optionB,
            optionC: question.optionC,
            optionD: question.optionD,
            optionAMediaUrl: addParticipantTokenToMediaUrl(question.optionAMediaUrl, input.token, input.sessionId, input.studentId),
            optionBMediaUrl: addParticipantTokenToMediaUrl(question.optionBMediaUrl, input.token, input.sessionId, input.studentId),
            optionCMediaUrl: addParticipantTokenToMediaUrl(question.optionCMediaUrl, input.token, input.sessionId, input.studentId),
            optionDMediaUrl: addParticipantTokenToMediaUrl(question.optionDMediaUrl, input.token, input.sessionId, input.studentId),
            questionMediaUrl: addParticipantTokenToMediaUrl(question.questionMediaUrl, input.token, input.sessionId, input.studentId),
            questionMediaType: question.questionMediaType,
          },
          submittedAnswer: ownAnswer?.answer ?? null,
        };
      }),

    submit: publicProcedure
      .input(z.object({
        sessionId: z.number().int().positive(),
        studentId: z.number().int().positive(),
        questionId: z.number().int().positive(),
        token: z.string().min(1).max(4096),
        answer: z.string().trim().regex(/^[A-D]{1,4}$/i),
      }))
      .mutation(async ({ input }) => {
        const access = await getStudentAccessContext(input);
        if (input.questionId !== access.question.id) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "当前题目已变化，请刷新后重试" });
        }
        const normalizedAnswer = normalizeSubmittedAnswer(input.answer, access.question.questionType);
        await db.submitAnswer({
          sessionId: input.sessionId,
          questionId: access.question.id,
          studentId: access.student.id,
          answer: normalizedAnswer,
          isCorrect: isSubmittedAnswerCorrect(normalizedAnswer, access.question.correctAnswer, access.question.questionType),
        });
        return { accepted: true };
      }),
  }),

  // ============ Answers Router ============
  answers: router({
    submit: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        questionId: z.number(),
        studentId: z.number(),
        answer: z.string().trim().regex(/^[A-D]{1,4}$/i),
      }))
      .mutation(async ({ ctx, input }) => {
        const { session, question } = await requireQuestionInOwnedSession(ctx.user.id, input.sessionId, input.questionId);
        const student = await requireOwnedStudent(ctx.user.id, input.studentId);
        if (student.classId !== session.classId) throw inaccessible();
        const normalizedAnswer = normalizeSubmittedAnswer(input.answer, question.questionType);
        const isCorrect = isSubmittedAnswerCorrect(normalizedAnswer, question.correctAnswer, question.questionType);
        const answerId = await db.submitAnswer({
          sessionId: input.sessionId,
          questionId: input.questionId,
          studentId: input.studentId,
          answer: normalizedAnswer,
          isCorrect,
        });
        return { answerId, isCorrect };
      }),

    getStatistics: protectedProcedure
      .input(z.object({
        sessionId: z.number().int().positive(),
        questionId: z.number().int().positive(),
      }))
      .query(async ({ ctx, input }) => {
        await requireQuestionInOwnedSession(ctx.user.id, input.sessionId, input.questionId);
        return await db.getQuestionStatistics(input.sessionId, input.questionId);
      }),

    getAnswerDetails: protectedProcedure
      .input(z.object({
        sessionId: z.number().int().positive(),
        questionId: z.number().int().positive(),
      }))
      .query(async ({ ctx, input }) => {
        await requireQuestionInOwnedSession(ctx.user.id, input.sessionId, input.questionId);
        const answers = await db.getAnswersBySessionAndQuestion(input.sessionId, input.questionId);
        
        const grouped: Record<string, Array<{ studentName: string | null; studentId: number }>> = {
          'A': [],
          'B': [],
          'C': [],
          'D': [],
        };
        
        for (const answer of answers) {
          for (const option of Array.from(new Set(answer.answer.toUpperCase()))) {
            if (option in grouped) {
              grouped[option].push({
                studentName: answer.studentName || 'Unknown',
                studentId: answer.studentId,
              });
            }
          }
        }
        
        return grouped;
      }),

    getStudentAnswers: protectedProcedure
      .input(z.object({
        studentId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        await requireOwnedStudent(ctx.user.id, input.studentId);
        return await db.getStudentAnswers(input.studentId);
      }),

    getAllSessionQuestionsStatistics: protectedProcedure
      .input(z.object({ sessionId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await requireOwnedSession(ctx.user.id, input.sessionId);
        return await db.getAllSessionQuestionsStatistics(input.sessionId);
      }),

    getSessionQuestionsWithStudentAnswers: protectedProcedure
      .input(z.object({ sessionId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await requireOwnedSession(ctx.user.id, input.sessionId);
        return await db.getSessionQuestionsWithStudentAnswers(input.sessionId);
      }),

    getSessionOverallStatistics: protectedProcedure
      .input(z.object({ sessionId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await requireOwnedSession(ctx.user.id, input.sessionId);
        return await db.getSessionOverallStatistics(input.sessionId);
      }),

    getSessionStudentScoreCards: protectedProcedure
      .input(z.object({ sessionId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await requireOwnedSession(ctx.user.id, input.sessionId);
        return await db.getSessionStudentScoreCards(input.sessionId);
      }),
  }),

  // ============ Answer Cards Router ============
  answerCards: router({
    // 获取所有预生成的答题卡列表
    list: publicProcedure
      .query(async () => {
        try {
          const cards = await db.getAllAnswerCardsMetadata();
          return {
            success: true,
            cards,
            total: cards.length,
          };
        } catch (error) {
          console.error('[AnswerCards] Error fetching cards list:', error);
          throw error;
        }
      }),

    // 获取单张答题卡
    get: publicProcedure
      .input(z.object({
        cardNumber: z.number().min(1).max(80),
      }))
      .query(async ({ input }) => {
        try {
          const card = await db.getAnswerCardMetadata(input.cardNumber);
          if (!card) {
            throw new Error(`答题卡 ${input.cardNumber} 不存在`);
          }
          return {
            success: true,
            card,
          };
        } catch (error) {
          console.error('[AnswerCards] Error fetching card:', error);
          throw error;
        }
      }),

    // 检查答题卡是否已初始化
    isInitialized: publicProcedure
      .query(async () => {
        try {
          const initialized = await db.isAnswerCardsInitialized();
          return {
            success: true,
            initialized,
          };
        } catch (error) {
          console.error('[AnswerCards] Error checking initialization:', error);
          throw error;
        }
      }),

    // 下载单张答题卡PDF
    downloadSingle: publicProcedure
      .input(z.object({
        cardNumber: z.number().min(1).max(80),
      }))
      .query(async ({ input }) => {
        try {
          const card = await db.getAnswerCardMetadata(input.cardNumber);
          if (!card) {
            throw new Error(`答题卡 ${input.cardNumber} 不存在`);
          }
          // 返回本地存储文件的稳定同源 URL
          const { url } = await storageGet(card.storageKey);
          return {
            success: true,
            downloadUrl: url,
            fileName: `answer-card-${input.cardNumber}.pdf`,
          };
        } catch (error) {
          console.error('[AnswerCards] Error generating download URL:', error);
          throw error;
        }
      }),

    // 下载所有答题卡为ZIP
    downloadAll: publicProcedure
      .query(async () => {
        try {
          const cards = await db.getAllAnswerCardsMetadata();
          if (cards.length === 0) {
            throw new TRPCError({ code: "NOT_FOUND", message: "没有可用的答题卡" });
          }
          const storageKey = 'answer-cards/downloads/all-cards.zip';
          if (!(await storageObjectExists(storageKey))) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "全部答题卡压缩包尚未生成",
            });
          }

          const { url } = await storageGet(storageKey);
          return {
            success: true,
            downloadUrl: url,
            fileName: `answer-cards-all.zip`,
            totalCards: cards.length,
          };
        } catch (error) {
          console.error('[AnswerCards] Error generating download all:', error);
          throw error;
        }
      }),

    // 只有已登录教师可以触发 ZIP 缓存构建；跨实例通过数据库租约去重。
    prepareDownloadAll: protectedProcedure
      .mutation(async () => {
        const cards = await db.getAllAnswerCardsMetadata();
        if (cards.length === 0) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "请先初始化答题卡" });
        }

        const storageKey = "answer-cards/downloads/all-cards.zip";
        const getCached = async () => {
          if (!(await storageObjectExists(storageKey))) return null;
          const { url } = await storageGet(storageKey);
          return url;
        };
        const cachedUrl = await getCached();
        if (cachedUrl) {
          return { success: true, downloadUrl: cachedUrl, fileName: "answer-cards-all.zip", totalCards: cards.length };
        }

        return withAnswerCardGenerationLock("cards:all-cards-zip", async () => {
          const urlAlreadyGenerated = await getCached();
          if (urlAlreadyGenerated) {
            return { success: true, downloadUrl: urlAlreadyGenerated, fileName: "answer-cards-all.zip", totalCards: cards.length };
          }

          const JSZip = await import("jszip");
          const zip = new JSZip.default();
          for (const card of cards) {
            const buffer = await storageGetObjectBuffer(card.storageKey);
            zip.file(`card-${card.cardNumber}.pdf`, buffer);
          }
          const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });
          const { url } = await storagePut(storageKey, new Uint8Array(zipBuffer), "application/zip");
          return { success: true, downloadUrl: url, fileName: "answer-cards-all.zip", totalCards: cards.length };
        });
      }),
  }),

  // ============ Global Answer Cards Router ============
  globalAnswerCards: router({
    download: publicProcedure
      .query(async () => {
        const url = await getCachedGlobalCards();
        if (!url) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "全局答题卡尚未生成，请教师登录后初始化",
          });
        }
        return { url };
      }),

    generate: protectedProcedure
      .mutation(async () => {
        const cachedUrl = await getCachedGlobalCards();
        if (cachedUrl) return { url: cachedUrl, alreadyGenerated: true };
        return withAnswerCardGenerationLock("cards:global-pdf", async () => {
          const urlAlreadyGenerated = await getCachedGlobalCards();
          if (urlAlreadyGenerated) return { url: urlAlreadyGenerated, alreadyGenerated: true };
          return { url: await generateGlobalCards(), alreadyGenerated: false };
        });
      }),
  }),

  // ============ Answer Cards Download Router (Legacy - for backward compatibility) ============
  // The actual download happens via stable local file URLs returned by these procedures.

  // ============ File Upload Router ============
  upload: router({
    image: protectedProcedure
      .input(z.object({
        fileName: z.string().min(1).max(255),
        fileData: z.string().min(1).max(60_000_000), // base64-encoded image/video, bounded below the JSON body limit
        contentType: z.enum([
          'image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp',
          'video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v',
        ]),
      }))
      .mutation(async ({ ctx, input }) => {
        const extensions: Record<string, string> = {
          'image/avif': 'avif', 'image/gif': 'gif', 'image/jpeg': 'jpg',
          'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4',
          'video/webm': 'webm', 'video/quicktime': 'mov', 'video/x-m4v': 'm4v',
        };
        const extension = extensions[input.contentType];
        const timestamp = Date.now();
        const randomSuffix = crypto.randomBytes(12).toString('hex');
        const fileKey = `questions/${ctx.user.id}/${timestamp}-${randomSuffix}.${extension}`;
        const buffer = Buffer.from(input.fileData, 'base64');
        if (buffer.length === 0 || buffer.length > 40 * 1024 * 1024) {
          throw new TRPCError({ code: 'PAYLOAD_TOO_LARGE', message: '文件大小超出限制' });
        }
        const { url } = await storagePut(fileKey, buffer, input.contentType);
        return { url, key: fileKey };
      }),
  }),
});

export type AppRouter = typeof appRouter;

    // 在getClassesForSet后添加移动和查询功能
