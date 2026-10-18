import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  isEmailSendingRateLimited,
  getEmailSendingRemainingTime,
} from "./auth";

describe("Email Resend Rate Limiting Tests", () => {
  describe("Rate Limit Check", () => {
    it("should detect when email sending is rate limited", () => {
      const now = new Date();
      const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);

      expect(isEmailSendingRateLimited(twoMinutesAgo, 5)).toBe(true);
    });

    it("should allow sending when rate limit has expired", () => {
      const now = new Date();
      const sixMinutesAgo = new Date(now.getTime() - 6 * 60 * 1000);

      expect(isEmailSendingRateLimited(sixMinutesAgo, 5)).toBe(false);
    });

    it("should detect rate limit at exactly the boundary", () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      // 边界情况：恰好5分钟
      expect(isEmailSendingRateLimited(fiveMinutesAgo, 5)).toBe(false);
    });

    it("should work with different rate limit durations", () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 1 * 60 * 1000);
      const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);

      expect(isEmailSendingRateLimited(oneMinuteAgo, 2)).toBe(true);
      expect(isEmailSendingRateLimited(threeMinutesAgo, 2)).toBe(false);
    });
  });

  describe("Remaining Time Calculation", () => {
    it("should calculate remaining time correctly", () => {
      const now = new Date();
      const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);

      const remainingSeconds = getEmailSendingRemainingTime(twoMinutesAgo, 5);

      // 应该是大约180秒（3分钟）
      expect(remainingSeconds).toBeGreaterThan(175);
      expect(remainingSeconds).toBeLessThanOrEqual(180);
    });

    it("should return 0 or negative when rate limit has expired", () => {
      const now = new Date();
      const sixMinutesAgo = new Date(now.getTime() - 6 * 60 * 1000);

      const remainingSeconds = getEmailSendingRemainingTime(sixMinutesAgo, 5);

      expect(remainingSeconds).toBeLessThanOrEqual(0);
    });

    it("should return approximately 300 seconds for fresh rate limit", () => {
      const now = new Date();
      const oneSecondAgo = new Date(now.getTime() - 1000);

      const remainingSeconds = getEmailSendingRemainingTime(oneSecondAgo, 5);

      // 应该是大约299秒
      expect(remainingSeconds).toBeGreaterThan(295);
      expect(remainingSeconds).toBeLessThanOrEqual(300);
    });

    it("should handle millisecond precision", () => {
      const now = new Date();
      const halfSecondAgo = new Date(now.getTime() - 500);

      const remainingSeconds = getEmailSendingRemainingTime(halfSecondAgo, 5);

      // 应该是大约299.5秒，向上取整为300
      expect(remainingSeconds).toBeGreaterThan(299);
      expect(remainingSeconds).toBeLessThanOrEqual(300);
    });
  });

  describe("Edge Cases", () => {
    it("should handle very short rate limit durations", () => {
      const now = new Date();
      const oneSecondAgo = new Date(now.getTime() - 1000);

      expect(isEmailSendingRateLimited(oneSecondAgo, 1)).toBe(true);
    });

    it("should handle very long rate limit durations", () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      expect(isEmailSendingRateLimited(oneHourAgo, 24 * 60)).toBe(true);
    });

    it("should handle future timestamps gracefully", () => {
      const now = new Date();
      const oneMinuteInFuture = new Date(now.getTime() + 60 * 1000);

      const result = isEmailSendingRateLimited(oneMinuteInFuture, 5);
      expect(typeof result).toBe('boolean');
    });

    it("should handle timestamps at epoch", () => {
      const epoch = new Date(0);

      // 从epoch到现在已经很久了，应该不受限制
      expect(isEmailSendingRateLimited(epoch, 5)).toBe(false);
    });
  });

  describe("Rate Limit Behavior", () => {
    it("should enforce 5-minute rate limit by default", () => {
      const now = new Date();
      const fourMinutesAgo = new Date(now.getTime() - 4 * 60 * 1000);
      const sixMinutesAgo = new Date(now.getTime() - 6 * 60 * 1000);

      expect(isEmailSendingRateLimited(fourMinutesAgo, 5)).toBe(true);
      expect(isEmailSendingRateLimited(sixMinutesAgo, 5)).toBe(false);
    });

    it("should prevent rapid successive sends", () => {
      const now = new Date();
      const tenSecondsAgo = new Date(now.getTime() - 10 * 1000);
      const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);

      expect(isEmailSendingRateLimited(tenSecondsAgo, 5)).toBe(true);
      expect(isEmailSendingRateLimited(thirtySecondsAgo, 5)).toBe(true);
    });

    it("should allow sends after rate limit expires", () => {
      const now = new Date();
      const fiveMinutesAndOneSecondAgo = new Date(
        now.getTime() - (5 * 60 + 1) * 1000
      );

      expect(isEmailSendingRateLimited(fiveMinutesAndOneSecondAgo, 5)).toBe(
        false
      );
    });
  });

  describe("User Experience", () => {
    it("should provide accurate countdown for UI display", () => {
      const now = new Date();
      const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);

      const remainingSeconds = getEmailSendingRemainingTime(twoMinutesAgo, 5);

      // 应该显示大约3分钟
      const minutes = Math.floor(remainingSeconds / 60);
      const seconds = remainingSeconds % 60;

      expect(minutes).toBeGreaterThanOrEqual(2);
      expect(minutes).toBeLessThanOrEqual(3);
      expect(remainingSeconds).toBeGreaterThan(175);
      expect(remainingSeconds).toBeLessThanOrEqual(300);
    });

    it("should show user-friendly remaining time", () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

      const remainingSeconds = getEmailSendingRemainingTime(oneMinuteAgo, 5);

      // 应该显示大约4分钟
      expect(remainingSeconds).toBeGreaterThan(235);
      expect(remainingSeconds).toBeLessThanOrEqual(240);
    });
  });
});
