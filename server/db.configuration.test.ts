import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("database configuration failures", () => {
  it("throws when DATABASE_URL is missing rather than returning a disconnected client", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { getDb } = await import("./db");

    await expect(getDb()).rejects.toThrow("DATABASE_URL must be configured");
  });
});
