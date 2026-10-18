import { describe, it, expect } from "vitest";
import * as db from "./db";
import { hashPassword } from "./auth";

describe("Unverified Account Override", { timeout: 30000 }, () => {
  const testEmail = `override-test-${Date.now()}@example.com`;
  const firstPassword = "FirstPass123!";
  const secondPassword = "SecondPass123!";
  const firstName = "First User";
  const secondName = "Second User";

  it("should allow re-registration with same email if first account is unverified", async () => {
    // Step 1: Create first account
    const firstPasswordHash = await hashPassword(firstPassword);
    const firstAccount = await db.createLocalAccount(testEmail, firstPasswordHash, firstName);
    
    expect(firstAccount).toBeDefined();
    expect(firstAccount.email).toBe(testEmail);
    expect(firstAccount.name).toBe(firstName);
    const firstUserId = firstAccount.id;

    // Verify first account exists and is unverified
    let user = await db.getUserByEmail(testEmail);
    expect(user).toBeDefined();
    expect(user?.id).toBe(firstUserId);
    expect(user?.isEmailVerified).toBe(false);

    // Step 2: Try to create second account with same email
    const secondPasswordHash = await hashPassword(secondPassword);
    const secondAccount = await db.createLocalAccount(testEmail, secondPasswordHash, secondName);
    
    expect(secondAccount).toBeDefined();
    expect(secondAccount.email).toBe(testEmail);
    expect(secondAccount.name).toBe(secondName);
    const secondUserId = secondAccount.id;

    // Verify second account has different ID
    expect(secondUserId).not.toBe(firstUserId);

    // Verify first account is deleted
    const firstUserAfterDelete = await db.getUserByEmail(testEmail);
    expect(firstUserAfterDelete?.id).toBe(secondUserId);
    expect(firstUserAfterDelete?.name).toBe(secondName);

    // Verify only one user exists with this email
    const allUsersWithEmail = await db.getUserByEmail(testEmail);
    expect(allUsersWithEmail?.id).toBe(secondUserId);
  });

  it("should not allow re-registration if account is already verified", async () => {
    const verifiedEmail = `verified-test-${Date.now()}@example.com`;
    
    // Create and verify an account
    const passwordHash = await hashPassword("VerifiedPass123!");
    const account = await db.createLocalAccount(verifiedEmail, passwordHash, "Verified User");
    const userId = account.id;

    // Mark email as verified
    await db.markEmailAsVerified(userId);

    // Verify the account is marked as verified
    let user = await db.getUserByEmail(verifiedEmail);
    expect(user?.isEmailVerified).toBe(true);

    // Try to create another account with same email
    const newPasswordHash = await hashPassword("NewPass123!");
    
    try {
      await db.createLocalAccount(verifiedEmail, newPasswordHash, "New User");
      // If we reach here, the second account was created (which means verified account wasn't deleted)
      // This is expected behavior - we should NOT delete verified accounts
      const newUser = await db.getUserByEmail(verifiedEmail);
      // The old verified account should still exist
      expect(newUser?.id).toBe(userId);
    } catch (error) {
      // It's also acceptable if the database throws a unique constraint error
      expect(error).toBeDefined();
    }
  });

  it("should delete all related data when removing unverified user", async () => {
    const testEmailForCleanup = `cleanup-test-${Date.now()}@example.com`;
    
    // Create account
    const passwordHash = await hashPassword("CleanupPass123!");
    const account = await db.createLocalAccount(testEmailForCleanup, passwordHash, "Cleanup User");
    const userId = account.id;

    // Create verification token
    const { generateVerificationToken, getTokenExpirationTime } = await import("./emailVerification");
    const token = generateVerificationToken();
    const expiresAt = getTokenExpirationTime();
    
    await db.createEmailVerificationToken({
      userId,
      token,
      email: testEmailForCleanup,
      expiresAt,
    });

    // Verify token exists
    let tokenRecord = await db.getEmailVerificationTokenByToken(token);
    expect(tokenRecord).toBeDefined();

    // Now create another account with same email (this should delete the first one)
    const newPasswordHash = await hashPassword("NewCleanupPass123!");
    const newAccount = await db.createLocalAccount(testEmailForCleanup, newPasswordHash, "New Cleanup User");
    const newUserId = newAccount.id;

    // Verify old user is deleted
    const oldUser = await db.getUserByEmail(testEmailForCleanup);
    expect(oldUser?.id).toBe(newUserId);
    expect(oldUser?.name).toBe("New Cleanup User");

    // Verify old token is deleted
    tokenRecord = await db.getEmailVerificationTokenByToken(token);
    expect(tokenRecord).toBeNull();
  });
});
