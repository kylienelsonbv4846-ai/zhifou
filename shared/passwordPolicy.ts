import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_POLICY_MESSAGE =
  "密码至少8个字符，且包含大小写字母、数字和特殊字符(!@#$%^&*)";

/**
 * Keep the server and browser rules identical to the requirements already
 * shown on the registration and legacy reset-link forms.
 */
export const PASSWORD_POLICY_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[a-zA-Z\d!@#$%^&*]{8,128}$/;

export const passwordPolicySchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, "密码长度至少8个字符")
  .max(PASSWORD_MAX_LENGTH, "密码长度不能超过128个字符")
  .regex(PASSWORD_POLICY_PATTERN, PASSWORD_POLICY_MESSAGE);
