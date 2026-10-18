import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail, sendEmailViaSendGrid, sendEmailViaTencentCloud } from "./_core/email";

describe("Email Service", () => {
  beforeEach(() => {
    // Mock fetch
    global.fetch = vi.fn();
    // Set up environment variables for Tencent Cloud
    process.env.TENCENT_SECRET_ID = "test-secret-id";
    process.env.TENCENT_SECRET_KEY = "test-secret-key";
    process.env.SENDER_EMAIL = "verify@alanhe.top";
    process.env.TENCENT_SES_REGION = "ap-hongkong";
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.TENCENT_SECRET_ID;
    delete process.env.TENCENT_SECRET_KEY;
    delete process.env.SENDER_EMAIL;
    delete process.env.TENCENT_SES_REGION;
  });

  describe("sendEmail (Tencent Cloud)", () => {
    it("should send email via Tencent Cloud SES API", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Response: {
            MessageId: "test-message-id",
            RequestId: "test-request-id",
          },
        }),
      });

      const result = await sendEmail({
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test</p>",
        text: "Test",
      });

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://ses.tencentcloudapi.com/",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-TC-Action": "SendEmail",
            "X-TC-Region": "ap-hongkong",
          }),
        })
      );
    });

    it("should return false when API request fails", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          Response: {
            Error: {
              Code: "InvalidParameterValue",
              Message: "Invalid parameter",
            },
          },
        }),
      });

      const result = await sendEmail({
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test</p>",
        text: "Test",
      });

      expect(result).toBe(false);
    });

    it("should return false when fetch throws error", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await sendEmail({
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test</p>",
        text: "Test",
      });

      expect(result).toBe(false);
    });

    it("should include email content in request body with Base64 encoding", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Response: {
            MessageId: "test-message-id",
          },
        }),
      });

      const emailOptions = {
        to: "user@example.com",
        subject: "Verification Email",
        html: "<h1>Verify your email</h1>",
        text: "Verify your email",
      };

      await sendEmail(emailOptions);

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      // Check that content is in Simple object with Base64 encoding
      expect(requestBody.Simple).toBeDefined();
      expect(requestBody.Simple.Html).toBe(
        Buffer.from("<h1>Verify your email</h1>").toString("base64")
      );
      expect(requestBody.Simple.Text).toBe(
        Buffer.from("Verify your email").toString("base64")
      );
      expect(requestBody.Destination).toEqual(["user@example.com"]);
      expect(requestBody.Subject).toBe("Verification Email");
    });

    it("should handle missing credentials gracefully", async () => {
      delete process.env.TENCENT_SECRET_ID;
      const mockFetch = global.fetch as any;

      const result = await sendEmail({
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test</p>",
        text: "Test",
      });

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should use text content when html is not provided", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Response: {
            MessageId: "test-message-id",
          },
        }),
      });

      await sendEmail({
        to: "user@example.com",
        subject: "Test",
        text: "Plain text content",
      });

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.Simple.Text).toBe(
        Buffer.from("Plain text content").toString("base64")
      );
      expect(requestBody.Simple.Html).toBe(Buffer.from("").toString("base64"));
    });
  });

  describe("sendEmailViaSendGrid", () => {
    beforeEach(() => {
      process.env.SENDGRID_API_KEY = "test-api-key";
      process.env.SENDGRID_FROM_EMAIL = "noreply@test.com";
    });

    afterEach(() => {
      delete process.env.SENDGRID_API_KEY;
      delete process.env.SENDGRID_FROM_EMAIL;
    });

    it("should return false when SENDGRID_API_KEY is not set", async () => {
      delete process.env.SENDGRID_API_KEY;

      const result = await sendEmailViaSendGrid({
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test</p>",
        text: "Test",
      });

      expect(result).toBe(false);
    });

    it("should send email via SendGrid API", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await sendEmailViaSendGrid({
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test</p>",
        text: "Test",
      });

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.sendgrid.com/v3/mail/send",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-api-key",
          }),
        })
      );
    });

    it("should format SendGrid request body correctly", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await sendEmailViaSendGrid({
        to: "user@example.com",
        subject: "Verification",
        html: "<h1>Verify</h1>",
        text: "Verify",
      });

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.personalizations[0].to[0].email).toBe(
        "user@example.com"
      );
      expect(requestBody.subject).toBe("Verification");
      expect(requestBody.from.email).toBe("verify@alanhe.top");
      expect(requestBody.from.name).toBeUndefined();
    });

    it("should return false when SendGrid API request fails", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized" }),
      });

      const result = await sendEmailViaSendGrid({
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test</p>",
        text: "Test",
      });

      expect(result).toBe(false);
    });
  });

  describe("sendEmailViaTencentCloud", () => {
    it("should return false when credentials are missing", async () => {
      delete process.env.TENCENT_SECRET_ID;

      const result = await sendEmailViaTencentCloud({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(result).toBe(false);
    });

    it("should handle API error responses", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Response: {
            Error: {
              Code: "InvalidParameterValue",
              Message: "Invalid email address",
            },
          },
        }),
      });

      const result = await sendEmailViaTencentCloud({
        to: "invalid-email",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(result).toBe(false);
    });

    it("should include region in request headers", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Response: {
            MessageId: "test-id",
          },
        }),
      });

      await sendEmailViaTencentCloud({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers["X-TC-Region"]).toBe("ap-hongkong");
    });
  });
});
