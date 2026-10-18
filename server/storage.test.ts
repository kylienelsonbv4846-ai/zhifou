import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getFileStorageRoot,
  getStorageContentType,
  storageGet,
  storageGetObjectBuffer,
  storageObjectExists,
  storagePut,
} from "./storage";

describe("local persistent file storage", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "classclicker-storage-"));
    vi.stubEnv("FILE_STORAGE_DIR", root);
    vi.stubEnv("CLASSCLICKER_STORAGE_BACKEND", "filesystem");
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  it("uses the configured persistent root", () => {
    expect(getFileStorageRoot()).toBe(root);
  });

  it("writes files under the configured root and returns stable same-origin URLs", async () => {
    const result = await storagePut(
      "questions/42/photo 1.png",
      Buffer.from("image bytes"),
      "image/png"
    );

    expect(result).toEqual({
      key: "questions/42/photo 1.png",
      url: "/api/storage/questions/42/photo%201.png",
    });
    await expect(
      readFile(path.join(root, "questions/42/photo 1.png"))
    ).resolves.toEqual(Buffer.from("image bytes"));
  });

  it("reads stored objects and maps their content type", async () => {
    await storagePut("answer-cards/card-1.pdf", Buffer.from("pdf"));

    await expect(
      storageGetObjectBuffer("answer-cards/card-1.pdf")
    ).resolves.toEqual(Buffer.from("pdf"));
    expect(getStorageContentType("answer-cards/card-1.pdf")).toBe(
      "application/pdf"
    );
  });

  it("distinguishes existing files from cache misses", async () => {
    await expect(storageObjectExists("cache/missing.pdf")).resolves.toBe(false);
    await storagePut("cache/existing.pdf", Buffer.from("pdf"));
    await expect(storageObjectExists("cache/existing.pdf")).resolves.toBe(true);
  });

  it("returns stable URLs without requiring the file to exist yet", async () => {
    await expect(storageGet("questions/42/image.png")).resolves.toEqual({
      key: "questions/42/image.png",
      url: "/api/storage/questions/42/image.png",
    });
  });

  it("rejects traversal-like and malformed object keys", async () => {
    await expect(storageGet("questions/../secret.txt")).rejects.toThrow(
      "Invalid storage object key"
    );
    await expect(storageGet("questions\\..\\secret.txt")).rejects.toThrow(
      "Invalid storage object key"
    );
    await expect(storageGet("questions//image.png")).rejects.toThrow(
      "Invalid storage object key"
    );
  });

  it("uses a safe fallback content type for unknown extensions", () => {
    expect(getStorageContentType("files/archive.unknown")).toBe(
      "application/octet-stream"
    );
  });
});

describe("WebDev durable object storage adapter", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("CLASSCLICKER_STORAGE_BACKEND", "webdev");
    vi.stubEnv("MANUS_API_URL", "https://runtime.example");
    vi.stubEnv("MANUS_API_KEY", "test-runtime-key");

    fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const requestUrl = new URL(String(input));
        if (requestUrl.hostname === "runtime.example") {
          return new Response(
            JSON.stringify({ url: "https://objects.example/signed" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (requestUrl.hostname === "objects.example") {
          if (init?.method === "PUT") return new Response(null, { status: 200 });
          if (!init?.method || init.method === "GET") {
            const headers = new Headers(init?.headers);
            return headers.has("Range")
              ? new Response("x", { status: 206 })
              : new Response("remote bytes", { status: 200 });
          }
        }
        return new Response(null, { status: 404 });
      }
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uploads through a presigned URL while preserving the same-origin contract", async () => {
    const result = await storagePut(
      "questions/42/photo 1.png",
      Buffer.from("image bytes"),
      "image/png"
    );

    expect(result).toEqual({
      key: "questions/42/photo 1.png",
      url: "/api/storage/questions/42/photo%201.png",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [presignInput, presignInit] = fetchMock.mock.calls[0] as [
      RequestInfo | URL,
      RequestInit,
    ];
    const presignUrl = new URL(String(presignInput));
    expect(presignUrl.pathname).toBe("/v1/storage/presign/put");
    expect(presignUrl.searchParams.get("path")).toBe("questions/42/photo 1.png");
    expect(presignInit.headers).toMatchObject({
      Authorization: "Bearer test-runtime-key",
    });

    const [uploadInput, uploadInit] = fetchMock.mock.calls[1] as [
      RequestInfo | URL,
      RequestInit,
    ];
    expect(String(uploadInput)).toBe("https://objects.example/signed");
    expect(uploadInit.method).toBe("PUT");
    expect(uploadInit.headers).toMatchObject({ "Content-Type": "image/png" });
    expect(Buffer.from(uploadInit.body as Uint8Array)).toEqual(
      Buffer.from("image bytes")
    );
  });

  it("maps non-ASCII logical keys to deterministic ASCII physical keys", async () => {
    const result = await storagePut(
      "questions/42/图片.png",
      Buffer.from("image bytes"),
      "image/png"
    );
    const [presignInput] = fetchMock.mock.calls[0] as [RequestInfo | URL];
    const presignUrl = new URL(String(presignInput));

    expect(result.key).toBe("questions/42/图片.png");
    expect(presignUrl.searchParams.get("path")).toMatch(
      /^objects\/[a-f0-9]{64}\.png$/
    );
  });

  it("downloads a stored object through a fresh server-side presigned URL", async () => {
    await expect(
      storageGetObjectBuffer("answer-cards/card-1.pdf")
    ).resolves.toEqual(Buffer.from("remote bytes"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [downloadInput, downloadInit] = fetchMock.mock.calls[1] as [
      RequestInfo | URL,
      RequestInit | undefined,
    ];
    expect(String(downloadInput)).toBe("https://objects.example/signed");
    expect(downloadInit?.method ?? "GET").toBe("GET");
  });

  it("checks object existence using a small ranged GET", async () => {
    await expect(
      storageObjectExists("global-answer-cards/all-cards.pdf")
    ).resolves.toBe(true);
    const [, requestInit] = fetchMock.mock.calls[1] as [
      RequestInfo | URL,
      RequestInit,
    ];
    expect(requestInit.headers).toMatchObject({ Range: "bytes=0-0" });
  });
});
