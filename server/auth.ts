import bcryptjs from "bcryptjs";
import { z } from "zod";
import { passwordPolicySchema } from "../shared/passwordPolicy";

/**
 * 密码验证规则：
 * - 最少8个字符
 * - 至少包含一个大写字母
 * - 至少包含一个小写字母
 * - 至少包含一个数字
 * - 至少包含一个特殊字符 (!@#$%^&*)
 */
/**
 * 注册输入验证schema
 */
export const registerInputSchema = z.object({
  email: z
    .string()
    .email("邮箱格式不正确")
    .min(5, "邮箱长度至少5个字符")
    .max(320, "邮箱长度不能超过320个字符")
    .toLowerCase()
    .trim(),
  password: passwordPolicySchema,
  name: z
    .string()
    .min(2, "名字长度至少2个字符")
    .max(255, "名字长度不能超过255个字符")
    .trim(),
});

export type RegisterInput = z.infer<typeof registerInputSchema>;

/**
 * 登录输入验证schema
 */
export const loginInputSchema = z.object({
  email: z
    .string()
    .email("邮箱格式不正确")
    .toLowerCase()
    .trim(),
  password: z.string().min(1, "密码不能为空"),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

/**
 * 哈希密码 - 使用bcrypt
 * @param password 明文密码
 * @returns 哈希后的密码
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcryptjs.genSalt(12); // 12轮salt，安全性和性能平衡
  return bcryptjs.hash(password, salt);
}

/**
 * 验证密码
 * @param password 明文密码
 * @param hash 哈希后的密码
 * @returns 密码是否匹配
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

/**
 * 验证邮箱格式
 * @param email 邮箱地址
 * @returns 邮箱格式是否正确
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 320;
}

/**
 * 清理敏感信息 - 防止信息泄露
 * @param user 用户对象
 * @returns 清理后的用户对象
 */
export function sanitizeUser(user: any) {
  if (!user) throw new Error("Cannot sanitize an empty user record");
  const {
    id,
    name,
    email,
    loginMethod,
    avatarUrl,
    wechatId,
    qqId,
    douyinId,
    role,
    isEmailVerified,
    createdAt,
    updatedAt,
    lastSignedIn,
  } = user;
  return {
    id,
    name,
    email,
    loginMethod,
    avatarUrl,
    wechatId,
    qqId,
    douyinId,
    role,
    isEmailVerified,
    createdAt,
    updatedAt,
    lastSignedIn,
  };
}


/**
 * 检查邮件发送是否超过速率限制
 * @param lastSentAt 上次发送时间
 * @param rateLimitMinutes 速率限制时间（分钟）
 * @returns 是否超过速率限制
 */
export function isEmailSendingRateLimited(lastSentAt: Date, rateLimitMinutes: number = 5): boolean {
  const now = new Date();
  const timeDifference = now.getTime() - lastSentAt.getTime();
  const limitMs = rateLimitMinutes * 60 * 1000;
  
  return timeDifference < limitMs;
}

/**
 * 计算距离下次发送的剩余时间（秒）
 * @param lastSentAt 上次发送时间
 * @param rateLimitMinutes 速率限制时间（分钟）
 * @returns 剩余秒数
 */
export function getEmailSendingRemainingTime(lastSentAt: Date, rateLimitMinutes: number = 5): number {
  const now = new Date();
  const timeDifference = now.getTime() - lastSentAt.getTime();
  const limitMs = rateLimitMinutes * 60 * 1000;
  
  const remainingMs = limitMs - timeDifference;
  return Math.ceil(remainingMs / 1000);
}

/**
 * 重新发送验证邮件输入验证schema
 */
export const resendVerificationEmailSchema = z.object({
  email: z
    .string()
    .email("邮箱格式不正确")
    .toLowerCase()
    .trim(),
});

export type ResendVerificationEmailInput = z.infer<typeof resendVerificationEmailSchema>;


/**
 * 请求密码重置输入验证schema
 */
export const requestPasswordResetSchema = z.object({
  email: z
    .string()
    .email("邮箱格式不正确")
    .toLowerCase()
    .trim(),
});

export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

/**
 * 重置密码输入验证schema
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "重置令牌不能为空"),
  password: passwordPolicySchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "两次输入的密码不一致",
  path: ["confirmPassword"],
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
