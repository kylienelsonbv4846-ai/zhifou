import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  generateVerificationToken,
  getTokenExpirationTime,
  isTokenExpired,
  generateVerificationLink,
  generateVerificationEmailHTML,
  generateVerificationEmailText,
} from "./emailVerification";

describe("Email Verification Tests", () => {
  describe("Token Generation", () => {
    it("should generate a unique verification token", () => {
      const token1 = generateVerificationToken();
      const token2 = generateVerificationToken();

      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
    });

    it("should generate a token with sufficient length", () => {
      const token = generateVerificationToken();
      // 32 bytes = 64 hex characters
      expect(token.length).toBe(64);
    });

    it("should generate a token with only hex characters", () => {
      const token = generateVerificationToken();
      expect(/^[a-f0-9]{64}$/.test(token)).toBe(true);
    });
  });

  describe("Token Expiration", () => {
    it("should calculate expiration time 24 hours in the future", () => {
      const now = new Date();
      const expirationTime = getTokenExpirationTime();

      const timeDifference = expirationTime.getTime() - now.getTime();
      const hoursInMs = 24 * 60 * 60 * 1000;

      // Allow 1 second tolerance
      expect(Math.abs(timeDifference - hoursInMs)).toBeLessThan(1000);
    });

    it("should detect expired tokens", () => {
      const pastTime = new Date();
      pastTime.setHours(pastTime.getHours() - 1);

      expect(isTokenExpired(pastTime)).toBe(true);
    });

    it("should detect non-expired tokens", () => {
      const futureTime = new Date();
      futureTime.setHours(futureTime.getHours() + 1);

      expect(isTokenExpired(futureTime)).toBe(false);
    });
  });

  describe("Verification Link Generation", () => {
    it("should generate a valid verification link", () => {
      const token = generateVerificationToken();
      const link = generateVerificationLink(token);

      expect(link).toContain("/verify-email?token=");
      expect(link).toContain(token);
    });

    it("should include token in the link", () => {
      const token = "test-token-12345";
      const link = generateVerificationLink(token);

      expect(link).toContain(`token=${token}`);
    });

    it("should generate HTTPS links in production", () => {
      const token = generateVerificationToken();
      const link = generateVerificationLink(token);

      // Link should contain a protocol (http or https)
      expect(link).toMatch(/^https?:\/\//);
    });
  });

  describe("Email Content Generation", () => {
    it("should generate HTML email with user name", () => {
      const userName = "John Doe";
      const link = "http://example.com/verify-email?token=abc123";
      const html = generateVerificationEmailHTML(userName, link);

      expect(html).toContain(userName);
      expect(html).toContain(link);
      expect(html).toContain("ClassClicker");
      expect(html).toContain("邮箱验证");
    });

    it("should generate HTML email with verification link", () => {
      const link = "http://example.com/verify-email?token=abc123";
      const html = generateVerificationEmailHTML("User", link);

      expect(html).toContain(`href="${link}"`);
    });

    it("should generate HTML email with security warning", () => {
      const html = generateVerificationEmailHTML("User", "http://example.com");

      expect(html).toContain("24小时");
      expect(html).toContain("安全");
    });

    it("should escape HTML special characters in user name", () => {
      const userName = "<script>alert('XSS')</script>";
      const html = generateVerificationEmailHTML(userName, "http://example.com");

      // Should not contain unescaped script tags
      expect(html).not.toContain("<script>alert");
      expect(html).toContain("&lt;");
    });

    it("should generate plain text email with user name", () => {
      const userName = "John Doe";
      const link = "http://example.com/verify-email?token=abc123";
      const text = generateVerificationEmailText(userName, link);

      expect(text).toContain(userName);
      expect(text).toContain(link);
      expect(text).toContain("ClassClicker");
    });

    it("should generate plain text email with security warning", () => {
      const text = generateVerificationEmailText("User", "http://example.com");

      expect(text).toContain("24小时");
      expect(text).toContain("安全");
    });

    it("should have consistent information in HTML and plain text", () => {
      const userName = "Test User";
      const link = "http://example.com/verify-email?token=xyz789";

      const html = generateVerificationEmailHTML(userName, link);
      const text = generateVerificationEmailText(userName, link);

      // Both should contain the key information
      expect(html).toContain(userName);
      expect(text).toContain(userName);
      expect(html).toContain(link);
      expect(text).toContain(link);
    });
  });

  describe("Email Security", () => {
    it("should not expose sensitive information in plain text", () => {
      const text = generateVerificationEmailText("User", "http://example.com");

      expect(text).not.toContain("password");
      expect(text).not.toContain("secret");
      expect(text).not.toContain("token");
    });

    it("should include security disclaimers", () => {
      const html = generateVerificationEmailHTML("User", "http://example.com");

      expect(html).toContain("没有注册");
      expect(html).toContain("忽略");
    });

    it("should not include user password in email", () => {
      const html = generateVerificationEmailHTML("User", "http://example.com");
      const text = generateVerificationEmailText("User", "http://example.com");

      expect(html).not.toContain("password");
      expect(text).not.toContain("password");
    });
  });

  describe("Email Formatting", () => {
    it("should generate valid HTML structure", () => {
      const html = generateVerificationEmailHTML("User", "http://example.com");

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html>");
      expect(html).toContain("</html>");
      expect(html).toContain("<body>");
      expect(html).toContain("</body>");
    });

    it("should include CSS styling", () => {
      const html = generateVerificationEmailHTML("User", "http://example.com");

      expect(html).toContain("<style>");
      expect(html).toContain("</style>");
      expect(html).toContain("font-family");
    });

    it("should include action button in HTML", () => {
      const html = generateVerificationEmailHTML("User", "http://example.com");

      expect(html).toContain("button");
      expect(html).toContain("验证邮箱");
    });

    it("should be mobile-friendly", () => {
      const html = generateVerificationEmailHTML("User", "http://example.com");

      expect(html).toContain("max-width");
      expect(html).toContain("meta");
    });
  });

  describe("XSS Prevention", () => {
    it("should escape HTML in user name", () => {
      const maliciousName = "<img src=x>";
      const html = generateVerificationEmailHTML(maliciousName, "http://example.com");

      expect(html).toContain("&lt;");
      expect(html).toContain("&gt;");
    });

    it("should escape quotes in user name", () => {
      const nameWithQuotes = 'User "Admin" Name';
      const html = generateVerificationEmailHTML(nameWithQuotes, "http://example.com");

      expect(html).toContain("&quot;");
    });

    it("should escape ampersands in user name", () => {
      const nameWithAmpersand = "Smith & Co.";
      const html = generateVerificationEmailHTML(nameWithAmpersand, "http://example.com");

      expect(html).toContain("&amp;");
    });
  });
});
