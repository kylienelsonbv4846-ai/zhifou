import { afterEach, describe, expect, it, vi } from "vitest";
import { sendEmailViaTencentCloud } from "./_core/email";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Tencent Cloud SES Email Service", () => {
  it("returns false without credentials and does not make a network request", async () => {
    vi.stubEnv("TENCENT_SECRET_ID", "");
    vi.stubEnv("TENCENT_SECRET_KEY", "");
    vi.stubEnv("SENDER_EMAIL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendEmailViaTencentCloud({
        to: "test@example.com",
        subject: "Test",
        text: "Test",
      })
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a signed request using dummy credentials and the default region", async () => {
    vi.stubEnv("TENCENT_SECRET_ID", "test-secret-id");
    vi.stubEnv("TENCENT_SECRET_KEY", "test-secret-key");
    vi.stubEnv("SENDER_EMAIL", "sender@example.test");
    vi.stubEnv("TENCENT_SES_REGION", "");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ Response: { MessageId: "mock-message-id" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendEmailViaTencentCloud({
        to: "recipient@example.test",
        subject: "Test subject",
        text: "Test message",
      })
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://ses.tencentcloudapi.com/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-TC-Action": "SendEmail",
          "X-TC-Region": "ap-hongkong",
          Authorization: expect.stringContaining("Credential=test-secret-id/"),
        }),
      })
    );
  });

  it("returns false when the SES API responds with an error", async () => {
    vi.stubEnv("TENCENT_SECRET_ID", "test-secret-id");
    vi.stubEnv("TENCENT_SECRET_KEY", "test-secret-key");
    vi.stubEnv("SENDER_EMAIL", "sender@example.test");
    const fetchMock = vi.fn().mockResolvedValue({
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
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendEmailViaTencentCloud({
        to: "invalid-email",
        subject: "Test",
        text: "Test",
      })
    ).resolves.toBe(false);
  });

  it("returns false when the network request throws", async () => {
    vi.stubEnv("TENCENT_SECRET_ID", "test-secret-id");
    vi.stubEnv("TENCENT_SECRET_KEY", "test-secret-key");
    vi.stubEnv("SENDER_EMAIL", "sender@example.test");
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendEmailViaTencentCloud({
        to: "recipient@example.test",
        subject: "Test",
        text: "Test",
      })
    ).resolves.toBe(false);
  });
});
