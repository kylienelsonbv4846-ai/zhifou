import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";
import { hashPassword, verifyPassword } from "./auth";
import { generateVerificationToken, getTokenExpirationTime, isTokenExpired } from "./emailVerification";

describe("Registration Flow", () => {
  const testEmail = `test-${Date.now()}-${Math.random()}@example.com`;
  const testPassword = "TestPass123!";
  const testName = "Test User";
  let userId: number;

  describe("Local Account Creation", () => {
    it("should create a new local account with valid data", async () => {
      const passwordHash = await hashPassword(testPassword);
      const result = await db.createLocalAccount(testEmail, passwordHash, testName);
      
      expect(result).toBeDefined();
      expect(result.email).toBe(testEmail);
      expect(result.name).toBe(testName);
      expect(result.id).toBeGreaterThan(0);
      
      userId = result.id;
    });

    it("should retrieve the created user by email", async () => {
      const user = await db.getUserByEmail(testEmail);
      
      expect(user).toBeDefined();
      expect(user?.email).toBe(testEmail);
      expect(user?.name).toBe(testName);
      expect(user?.loginMethod).toBe("local");
      expect(user?.isEmailVerified).toBe(false);
    });

    it("should verify the password hash", async () => {
      const user = await db.getUserByEmail(testEmail);
      expect(user?.passwordHash).toBeDefined();
      
      if (user?.passwordHash) {
        const isValid = await verifyPassword(testPassword, user.passwordHash);
        expect(isValid).toBe(true);
        
        const isInvalid = await verifyPassword("WrongPassword123!", user.passwordHash);
        expect(isInvalid).toBe(false);
      }
    });

    it("should allow re-registration with same email if first account is unverified", async () => {
      // This is the new behavior: unverified accounts can be overridden
      const newPasswordHash = await hashPassword("NewPass123!");
      const newResult = await db.createLocalAccount(testEmail, newPasswordHash, "New User");
      
      // Should create a new account
      expect(newResult).toBeDefined();
      expect(newResult.email).toBe(testEmail);
      expect(newResult.name).toBe("New User");
      
      // Old account should be deleted, so userId should be different
      expect(newResult.id).not.toBe(userId);
      
      // Update userId to the new one for subsequent tests
      userId = newResult.id;
    });
  });

  describe("Email Verification Token", () => {
    it("should create an email verification token", async () => {
      const token = generateVerificationToken();
      const expiresAt = getTokenExpirationTime();
      
      const tokenId = await db.createEmailVerificationToken({
        userId,
        token,
        email: testEmail,
        expiresAt,
      });
      
      expect(tokenId).toBeGreaterThan(0);
    });

    it("should retrieve the verification token by token string", async () => {
      const token = generateVerificationToken();
      const expiresAt = getTokenExpirationTime();
      
      await db.createEmailVerificationToken({
        userId,
        token,
        email: testEmail,
        expiresAt,
      });
      
      const tokenRecord = await db.getEmailVerificationTokenByToken(token);
      
      expect(tokenRecord).toBeDefined();
      expect(tokenRecord?.token).toBe(token);
      expect(tokenRecord?.email).toBe(testEmail);
      expect(tokenRecord?.userId).toBe(userId);
    });

    it("should verify token expiration time", async () => {
      const expiresAt = getTokenExpirationTime();
      
      // Token should not be expired immediately
      expect(isTokenExpired(expiresAt)).toBe(false);
      
      // Past date should be expired
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);
      expect(isTokenExpired(pastDate)).toBe(true);
    });

    it("should delete expired verification token", async () => {
      const token = generateVerificationToken();
      const expiresAt = getTokenExpirationTime();
      
      await db.createEmailVerificationToken({
        userId,
        token,
        email: testEmail,
        expiresAt,
      });
      
      await db.deleteEmailVerificationToken(token);
      
      const tokenRecord = await db.getEmailVerificationTokenByToken(token);
      expect(tokenRecord).toBeNull();
    });
  });

  describe("Email Verification", () => {
    it("should mark user email as verified", async () => {
      const userBefore = await db.getUserByEmail(testEmail);
      expect(userBefore?.isEmailVerified).toBe(false);
      
      await db.markEmailAsVerified(userId);
      
      const userAfter = await db.getUserByEmail(testEmail);
      expect(userAfter?.isEmailVerified).toBe(true);
    });
  });

  describe("Local Account Lookup", () => {
    it("should check if email is taken", async () => {
      const isTaken = await db.isEmailTaken(testEmail);
      expect(isTaken).toBe(true);
    });

    it("should return false for non-existent email", async () => {
      const isTaken = await db.isEmailTaken("nonexistent@example.com");
      expect(isTaken).toBe(false);
    });
  });
});
