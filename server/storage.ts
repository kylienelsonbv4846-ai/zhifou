import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type StoredObject = {
  key: string;
  url: string;
};

type PresignAction = "put" | "get";

type StorageError = Error & { code?: string };

const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".zip": "application/zip",
  ".mp4": "video/mp4",
  ".m4v": "video/x-m4v",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

/**
 * Local, persistent file storage. FILE_STORAGE_DIR should point to a durable
 * volume on self-hosted servers; the default is ./data/uploads under cwd.
 */
export function getFileStorageRoot(): string {
  const configuredRoot = process.env.FILE_STORAGE_DIR?.trim();
  return path.resolve(
    configuredRoot || path.join(process.cwd(), "data", "uploads")
  );
}

/** Validate the selected backend without exposing credentials or writing an object. */
export async function checkStorageReadiness(): Promise<void> {
  if (useWebDevStorage()) {
    getWebDevCredentials();
    return;
  }

  const root = getFileStorageRoot();
  await mkdir(root, { recursive: true });
  await access(root, fsConstants.W_OK);
}

function normalizeKey(relKey: string): string {
  const key = relKey.replace(/^\/+/, "");
  const segments = key.split(/[\\/]/);
  if (
    !key ||
    key.length > 1024 ||
    segments.some(
      segment =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes("\0")
    )
  ) {
    throw new Error("Invalid storage object key");
  }
  return segments.join("/");
}

function getObjectPath(key: string): string {
  const root = getFileStorageRoot();
  const objectPath = path.resolve(root, ...key.split("/"));
  if (!objectPath.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid storage object key");
  }
  return objectPath;
}

function getStableObjectUrl(key: string): string {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `/api/storage/${encodedKey}`;
}

function useWebDevStorage(): boolean {
  const configuredDriver = process.env.CLASSCLICKER_STORAGE_BACKEND
    ?.trim()
    .toLowerCase();
  if (configuredDriver === "filesystem") return false;
  if (configuredDriver === "webdev") return true;
  if (configuredDriver) {
    throw new Error(
      "CLASSCLICKER_STORAGE_BACKEND must be either filesystem or webdev"
    );
  }

  // WebDev provides these server-only runtime variables. A standard self-hosted
  // server has neither and therefore keeps using its local persistent volume.
  return Boolean(
    process.env.MANUS_API_URL?.trim() && process.env.MANUS_API_KEY?.trim()
  );
}

function getPlatformStorageKey(key: string): string {
  if (/^[\x20-\x7e]+$/.test(key)) return key;

  // The platform presign API accepts ASCII paths only. Keep the logical key in
  // the app database/URL and map only its physical object key deterministically.
  const extension = path.extname(key).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 16);
  const digest = createHash("sha256").update(key).digest("hex");
  return `objects/${digest}${extension}`;
}

function storageError(message: string, code?: string): StorageError {
  const error = new Error(message) as StorageError;
  if (code) error.code = code;
  return error;
}

function getWebDevCredentials(): { apiUrl: string; apiKey: string } {
  const apiUrl = process.env.MANUS_API_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.MANUS_API_KEY?.trim();
  if (!apiUrl || !apiKey) {
    throw new Error(
      "WebDev storage was selected but its runtime API credentials are unavailable"
    );
  }
  return { apiUrl, apiKey };
}

async function getPresignedUrl(
  action: PresignAction,
  key: string
): Promise<string> {
  const { apiUrl, apiKey } = getWebDevCredentials();
  const query = new URLSearchParams({ path: getPlatformStorageKey(key) });
  const response = await fetch(
    `${apiUrl}/v1/storage/presign/${action}?${query.toString()}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  if (!response.ok) {
    if (action === "get" && response.status === 404) {
      throw storageError("Stored object not found", "ENOENT");
    }
    throw new Error(`WebDev storage URL request failed (HTTP ${response.status})`);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (
    !payload ||
    typeof payload !== "object" ||
    !("url" in payload) ||
    typeof payload.url !== "string"
  ) {
    throw new Error("WebDev storage returned an invalid presigned URL response");
  }

  const signedUrl = new URL(payload.url);
  if (signedUrl.protocol !== "https:") {
    throw new Error("WebDev storage returned a non-HTTPS presigned URL");
  }
  return signedUrl.toString();
}

function getUploadContentType(contentType: string, key: string): string {
  const trimmed = contentType.trim();
  if (/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(trimmed)) {
    return trimmed;
  }
  return CONTENT_TYPES[path.extname(key).toLowerCase()] || "application/octet-stream";
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<StoredObject> {
  const key = normalizeKey(relKey);

  if (useWebDevStorage()) {
    const signedUrl = await getPresignedUrl("put", key);
    const response = await fetch(signedUrl, {
      method: "PUT",
      headers: { "Content-Type": getUploadContentType(contentType, key) },
      body: typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data),
    });
    if (!response.ok) {
      throw new Error(`WebDev storage upload failed (HTTP ${response.status})`);
    }
    await response.body?.cancel().catch(() => undefined);
    return { key, url: getStableObjectUrl(key) };
  }

  const objectPath = getObjectPath(key);
  await mkdir(path.dirname(objectPath), { recursive: true, mode: 0o750 });
  await writeFile(objectPath, data, { mode: 0o640 });
  return { key, url: getStableObjectUrl(key) };
}

export async function storageGet(relKey: string): Promise<StoredObject> {
  const key = normalizeKey(relKey);
  return { key, url: getStableObjectUrl(key) };
}

export async function storageObjectExists(relKey: string): Promise<boolean> {
  const key = normalizeKey(relKey);
  if (useWebDevStorage()) {
    try {
      const signedUrl = await getPresignedUrl("get", key);
      const response = await fetch(signedUrl, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
      });
      await response.body?.cancel().catch(() => undefined);
      if (response.status === 404) return false;
      if (response.ok || response.status === 416) return true;
      throw new Error(`WebDev storage existence check failed (HTTP ${response.status})`);
    } catch (error) {
      if ((error as StorageError).code === "ENOENT") return false;
      throw error;
    }
  }

  try {
    await access(getObjectPath(key));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function storageGetObjectBuffer(relKey: string): Promise<Buffer> {
  const key = normalizeKey(relKey);
  if (useWebDevStorage()) {
    const signedUrl = await getPresignedUrl("get", key);
    const response = await fetch(signedUrl);
    if (response.status === 404) {
      throw storageError("Stored object not found", "ENOENT");
    }
    if (!response.ok) {
      throw new Error(`WebDev storage download failed (HTTP ${response.status})`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  return readFile(getObjectPath(key));
}

export function getStorageContentType(relKey: string): string {
  const key = normalizeKey(relKey);
  return (
    CONTENT_TYPES[path.extname(key).toLowerCase()] || "application/octet-stream"
  );
}
