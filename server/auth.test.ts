import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  registerInputSchema,
  loginInputSchema,
  hashPassword,
  verifyPassword,
  validateEmail,
  sanitizeUser,
} from "./auth";
import { z } from "zod";

describe("Authentication Security Tests", () => {
  describe("Password Hashing and Verification", () => {
    it("should hash password correctly", async () => {
      const password = "TestPassword123!";
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(20);
    });

    it("should verify correct password", async () => {
      const password = "TestPassword123!";
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it("should reject incorrect password", async () => {
      const password = "TestPassword123!";
      const wrongPassword = "WrongPassword123!";
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });

    it("should generate different hashes for same password", async () => {
      const password = "TestPassword123!";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("Email Validation", () => {
    it("should validate correct email format", () => {
      expect(validateEmail("user@example.com")).toBe(true);
      expect(validateEmail("test.user@example.co.uk")).toBe(true);
      expect(validateEmail("user+tag@example.com")).toBe(true);
    });

    it("should reject invalid email format", () => {
      expect(validateEmail("invalid")).toBe(false);
      expect(validateEmail("invalid@")).toBe(false);
      expect(validateEmail("@example.com")).toBe(false);
      expect(validateEmail("user@.com")).toBe(false);
    });

    it("should reject email exceeding max length", () => {
      const longEmail = "a".repeat(320) + "@example.com";
      expect(validateEmail(longEmail)).toBe(false);
    });
  });

  describe("Register Input Validation", () => {
    it("should validate correct registration input", () => {
      const input = {
        name: "John Doe",
        email: "john@example.com",
        password: "SecurePassword123!",
      };

      expect(() => registerInputSchema.parse(input)).not.toThrow();
    });

    it("should reject password without uppercase letter", () => {
      const input = {
        name: "John Doe",
        email: "john@example.com",
        password: "securepassword123!",
      };

      expect(() => registerInputSchema.parse(input)).toThrow();
    });

    it("should reject password without lowercase letter", () => {
      const input = {
        name: "John Doe",
        email: "john@example.com",
        password: "SECUREPASSWORD123!",
      };

      expect(() => registerInputSchema.parse(input)).toThrow();
    });

    it("should reject password without number", () => {
      const input = {
        name: "John Doe",
        email: "john@example.com",
        password: "SecurePassword!",
      };

      expect(() => registerInputSchema.parse(input)).toThrow();
    });

    it("should reject password without special character", () => {
      const input = {
        name: "John Doe",
        email: "john@example.com",
        password: "SecurePassword123",
      };

      expect(() => registerInputSchema.parse(input)).toThrow();
    });

    it("should reject password shorter than 8 characters", () => {
      const input = {
        name: "John Doe",
        email: "john@example.com",
        password: "Pass1!",
      };

      expect(() => registerInputSchema.parse(input)).toThrow();
    });

    it("should reject invalid email format", () => {
      const input = {
        name: "John Doe",
        email: "invalid-email",
        password: "SecurePassword123!",
      };

      expect(() => registerInputSchema.parse(input)).toThrow();
    });

    it("should reject name shorter than 2 characters", () => {
      const input = {
        name: "J",
        email: "john@example.com",
        password: "SecurePassword123!",
      };

      expect(() => registerInputSchema.parse(input)).toThrow();
    });

    it("should trim and lowercase email", () => {
      const input = {
        name: "John Doe",
        email: "JOHN@EXAMPLE.COM",
        password: "SecurePassword123!",
      };

      const parsed = registerInputSchema.parse(input);
      expect(parsed.email).toBe("john@example.com");
    });
  });

  describe("Login Input Validation", () => {
    it("should validate correct login input", () => {
      const input = {
        email: "john@example.com",
        password: "SecurePassword123!",
      };

      expect(() => loginInputSchema.parse(input)).not.toThrow();
    });

    it("should reject invalid email format", () => {
      const input = {
        email: "invalid-email",
        password: "SecurePassword123!",
      };

      expect(() => loginInputSchema.parse(input)).toThrow();
    });

    it("should reject empty password", () => {
      const input = {
        email: "john@example.com",
        password: "",
      };

      expect(() => loginInputSchema.parse(input)).toThrow();
    });

    it("should lowercase email", () => {
      const input = {
        email: "JOHN@EXAMPLE.COM",
        password: "SecurePassword123!",
      };

      const parsed = loginInputSchema.parse(input);
      expect(parsed.email).toBe("john@example.com");
    });
  });

  describe("User Data Sanitization", () => {
    it("should remove passwordHash from user object", () => {
      const user = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        passwordHash: "hashed_password_here",
        loginMethod: "local",
        role: "user",
        isEmailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
        wechatId: "wechat-123",
        qqId: "qq-123",
        douyinId: "douyin-123",
        openId: null,
      };

      const sanitized = sanitizeUser(user);

      expect(sanitized).not.toHaveProperty("passwordHash");
      expect(sanitized.id).toBe(1);
      expect(sanitized.name).toBe("John Doe");
      expect(sanitized.email).toBe("john@example.com");
      expect(sanitized).not.toHaveProperty("openId");
      expect(sanitized.wechatId).toBe("wechat-123");
      expect(sanitized.qqId).toBe("qq-123");
      expect(sanitized.douyinId).toBe("douyin-123");
    });
  });

  describe("SQL Injection Prevention", () => {
    it("should handle SQL injection attempts in email", () => {
      const input = {
        name: "John Doe",
        email: "test@example.com'; DROP TABLE users; --",
        password: "SecurePassword123!",
      };

      expect(() => registerInputSchema.parse(input)).toThrow();
    });

    it("should handle SQL injection attempts in name", () => {
      const input = {
        name: "'; DROP TABLE users; --",
        email: "john@example.com",
        password: "SecurePassword123!",
      };

      // This should be accepted by Zod, but the actual SQL query
      // will be parameterized and safe from injection
      const parsed = registerInputSchema.parse(input);
      expect(parsed.name).toBe("'; DROP TABLE users; --");
    });

    it("should handle XSS attempts in name", () => {
      const input = {
        name: "<script>alert('XSS')</script>",
        email: "john@example.com",
        password: "SecurePassword123!",
      };

      const parsed = registerInputSchema.parse(input);
      expect(parsed.name).toBe("<script>alert('XSS')</script>");
    });
  });

  describe("Input Length Validation", () => {
    it("should reject email exceeding max length", () => {
      const input = {
        name: "John Doe",
        email: "a".repeat(310) + "@example.com",
        password: "SecurePassword123!",
      };

      expect(() => registerInputSchema.parse(input)).toThrow();
    });

    it("should reject name exceeding max length", () => {
      const input = {
        name: "a".repeat(256),
        email: "john@example.com",
        password: "SecurePassword123!",
      };

      expect(() => registerInputSchema.parse(input)).toThrow();
    });

    it("should reject password exceeding max length", () => {
      const input = {
        name: "John Doe",
        email: "john@example.com",
        password: "SecurePassword123!" + "a".repeat(200),
      };

      expect(() => registerInputSchema.parse(input)).toThrow();
    });
  });
});
