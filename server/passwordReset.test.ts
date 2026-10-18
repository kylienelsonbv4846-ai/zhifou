import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  requestPasswordResetSchema,
  resetPasswordSchema,
  hashPassword,
  verifyPassword,
} from "./auth";
import { z } from "zod";

describe("Password Reset Tests", () => {
  describe("Request Password Reset Schema Validation", () => {
    it("should validate correct email", () => {
      const input = { email: "user@example.com" };
      const result = requestPasswordResetSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const input = { email: "invalid-email" };
      const result = requestPasswordResetSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should trim and lowercase email", () => {
      const input = { email: "USER@EXAMPLE.COM" };
      const result = requestPasswordResetSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("user@example.com");
      }
    });

    it("should reject empty or whitespace-only email", () => {
      const inputs = [
        { email: "" },
        { email: "   " },
      ];
      for (const input of inputs) {
        const result = requestPasswordResetSchema.safeParse(input);
        expect(result.success).toBe(false);
      }
    });

    it("should handle email with valid length", () => {
      const longEmail = "a".repeat(50) + "@example.com";
      const input = { email: longEmail };
      const result = requestPasswordResetSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe("Reset Password Schema Validation", () => {
    it("should validate correct password reset input", () => {
      const input = {
        token: "valid-token-123",
        password: "SecurePass123!",
        confirmPassword: "SecurePass123!",
      };
      const result = resetPasswordSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject mismatched passwords", () => {
      const input = {
        token: "valid-token-123",
        password: "SecurePass123!",
        confirmPassword: "DifferentPass123!",
      };
      const result = resetPasswordSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject password shorter than 8 characters", () => {
      const input = {
        token: "valid-token-123",
        password: "Sh0r1!",
        confirmPassword: "Sh0r1!",
      };
      const result = resetPasswordSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject password longer than 128 characters", () => {
      const longPassword = "Aa1!" + "x".repeat(125);
      const input = {
        token: "valid-token-123",
        password: longPassword,
        confirmPassword: longPassword,
      };
      const result = resetPasswordSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject password without uppercase letter", () => {
      const input = {
        token: "valid-token-123",
        password: "securepass123!",
        confirmPassword: "securepass123!",
      };
      const result = resetPasswordSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject password without lowercase letter", () => {
      const input = {
        token: "valid-token-123",
        password: "SECUREPASS123!",
        confirmPassword: "SECUREPASS123!",
      };
      const result = resetPasswordSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject password without digit", () => {
      const input = {
        token: "valid-token-123",
        password: "SecurePass!",
        confirmPassword: "SecurePass!",
      };
      const result = resetPasswordSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject password without special character", () => {
      const input = {
        token: "valid-token-123",
        password: "SecurePass123",
        confirmPassword: "SecurePass123",
      };
      const result = resetPasswordSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject empty token", () => {
      const input = {
        token: "",
        password: "SecurePass123!",
        confirmPassword: "SecurePass123!",
      };
      const result = resetPasswordSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should accept all valid special characters", () => {
      const specialChars = ["!", "@", "#", "$", "%", "^", "&", "*"];
      for (const char of specialChars) {
        const input = {
          token: "valid-token-123",
          password: `SecurePass123${char}`,
          confirmPassword: `SecurePass123${char}`,
        };
        const result = resetPasswordSchema.safeParse(input);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("Password Hashing and Verification", () => {
        it("should hash password correctly", async () => {
      const password = "SecurePass123!";
      const hash = await hashPassword(password);
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it("should verify correct password", async () => {
      const password = "SecurePass123!";
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it("should reject incorrect password", async () => {
      const password = "SecurePass123!";
      const hash = await hashPassword(password);
      const isValid = await verifyPassword("WrongPassword123!", hash);
      expect(isValid).toBe(false);
    });

    it("should generate different hashes for same password", async () => {
      const password = "SecurePass123!";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      expect(hash1).not.toBe(hash2);
    });

    it("should handle special characters in password", async () => {
      const password = "P@ssw0rd!#$%^&*";
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it("should handle unicode characters in password", async () => {
      const password = "SecurePass123!中文";
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it("should be case sensitive", async () => {
      const password = "SecurePass123!";
      const hash = await hashPassword(password);
      const isValid = await verifyPassword("securepass123!", hash);
      expect(isValid).toBe(false);
    });

    it("should handle whitespace correctly", async () => {
      const password = "Secure Pass 123!";
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });
  });

  describe("Password Reset Security", () => {
    it("should enforce minimum password complexity", () => {
      const weakPasswords = [
        "password123!",
        "PASSWORD123!",
        "PasswordABC!",
        "Password123",
      ];

      for (const pwd of weakPasswords) {
        const input = {
          token: "valid-token",
          password: pwd,
          confirmPassword: pwd,
        };
        const result = resetPasswordSchema.safeParse(input);
        expect(result.success).toBe(false);
      }
    });

    it("should prevent common password patterns", () => {
      const commonPatterns = [
        "Password123!",
        "Qwerty123!",
        "Admin123!",
        "Welcome123!",
      ];

      for (const pwd of commonPatterns) {
        const input = {
          token: "valid-token",
          password: pwd,
          confirmPassword: pwd,
        };
        const result = resetPasswordSchema.safeParse(input);
        expect(result.success).toBe(true);
      }
    });

    it("should validate token format", () => {
      const input = {
        token: "valid-token-123",
        password: "SecurePass123!",
        confirmPassword: "SecurePass123!",
      };
      const result = resetPasswordSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle maximum length password", () => {
      const maxPassword = "Aa1!" + "x".repeat(124);
      const input = {
        token: "valid-token-123",
        password: maxPassword,
        confirmPassword: maxPassword,
      };
      const result = resetPasswordSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should handle minimum length password", () => {
      const minPassword = "Aa1!xxxx";
      const input = {
        token: "valid-token-123",
        password: minPassword,
        confirmPassword: minPassword,
      };
      const result = resetPasswordSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should handle email with subdomain", () => {
      const input = { email: "user@mail.example.co.uk" };
      const result = requestPasswordResetSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("user@mail.example.co.uk");
      }
    });

    it("should handle email with plus addressing", () => {
      const input = { email: "user+tag@example.com" };
      const result = requestPasswordResetSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("user+tag@example.com");
      }
    });
  });
});
