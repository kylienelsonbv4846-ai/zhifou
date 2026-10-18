import express from "express";
import { createServer } from "http";
import net from "net";
import fs from "fs";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import {
  getStorageContentType,
  storageGetObjectBuffer,
  checkStorageReadiness,
} from "../storage";
import * as db from "../db";
import { sdk, verifyStudentAccessToken } from "./sdk";
import { registerExcelExportRoutes } from "./excelExportRoutes";
import { HttpError } from "@shared/_core/errors";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

function storageKeyFromUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const origin = "https://classclicker.invalid";
    const parsed = new URL(value, origin);
    if (parsed.origin !== origin || !parsed.pathname.startsWith("/api/storage/")) return null;
    return parsed.pathname
      .slice("/api/storage/".length)
      .split("/")
      .map(segment => decodeURIComponent(segment))
      .join("/");
  } catch {
    return null;
  }
}

function queryString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

async function mayReadStoredObject(req: express.Request, key: string): Promise<boolean> {
  if (key.startsWith("answer-cards/")) return true;
  const ownerMatch = /^questions\/(\d+)\/.+/.exec(key);
  if (!ownerMatch) return false;
  const ownerId = Number(ownerMatch[1]);
  if (!Number.isSafeInteger(ownerId) || ownerId <= 0) return false;

  try {
    const user = await sdk.authenticateRequest(req);
    if (user.id === ownerId) return true;
  } catch (error) {
    // Only invalid/expired sessions are anonymous; authentication infrastructure failures are 5xx.
    if (!(error instanceof HttpError) || (error.statusCode !== 401 && error.statusCode !== 403)) {
      throw error;
    }
  }

  const token = queryString(req.query.access_token);
  const sessionId = Number(queryString(req.query.session_id));
  const studentId = Number(queryString(req.query.student_id));
  if (
    !token ||
    !Number.isSafeInteger(sessionId) ||
    sessionId <= 0 ||
    !Number.isSafeInteger(studentId) ||
    studentId <= 0 ||
    !(await verifyStudentAccessToken(token, sessionId, studentId))
  ) {
    return false;
  }

  const [session, student] = await Promise.all([
    db.getSessionById(sessionId),
    db.getStudentById(studentId),
  ]);
  if (
    !session ||
    !student ||
    session.status !== "active" ||
    session.teacherId !== ownerId ||
    student.classId !== session.classId
  ) {
    return false;
  }

  const queue = await db.getSessionQueue(sessionId);
  const activeIndex = queue.findIndex(item => item.isActive);
  if (activeIndex < 0) return false;
  const activeItem = queue[activeIndex];
  if (!activeItem) return false;
  const question = await db.getQuestionById(activeItem.questionId);
  if (!question || question.setId !== session.setId) return false;

  const allowedKeys = [
    question.questionMediaUrl,
    question.optionAMediaUrl,
    question.optionBMediaUrl,
    question.optionCMediaUrl,
    question.optionDMediaUrl,
  ].map(storageKeyFromUrl).filter((value): value is string => Boolean(value));
  return allowedKeys.includes(key);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use((_req, res, next) => {
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });
  let lastReadinessCheck = 0;
  let readinessResult: { status: 200 | 503; body: { status: "ready" | "not_ready" } } | null = null;
  app.get("/readyz", async (_req, res) => {
    const now = Date.now();
    if (readinessResult && now - lastReadinessCheck < 5_000) {
      return res.status(readinessResult.status).json(readinessResult.body);
    }

    try {
      await db.checkDatabaseReadiness();
      if (process.env.NODE_ENV === "production") {
        const sessionSecret = process.env.CLASSCLICKER_SESSION_SECRET?.trim() || "";
        const emailReady = Boolean(
          process.env.TENCENT_SECRET_ID?.trim() &&
          process.env.TENCENT_SECRET_KEY?.trim() &&
          process.env.TENCENT_SES_REGION?.trim() &&
          process.env.SENDER_EMAIL?.trim()
        );
        if (sessionSecret.length < 48 || !emailReady) {
          throw new Error("Required application runtime configuration is missing");
        }
        await checkStorageReadiness();
      }
      readinessResult = { status: 200, body: { status: "ready" } };
    } catch (error) {
      console.error("[Readiness] Required service or schema check failed:", error);
      readinessResult = { status: 503, body: { status: "not_ready" } };
    }
    lastReadinessCheck = now;
    return res.status(readinessResult.status).json(readinessResult.body);
  });
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "64mb" }));
  app.use(express.urlencoded({ limit: "64mb", extended: true }));

  // Answer-card templates are public; question media is owner-only except for the
  // exact active-question media carried by a signed student capability.
  app.get("/api/storage/*", async (req, res) => {
    let key = "";
    try {
      const encodedKey = req.path.slice("/api/storage/".length);
      key = encodedKey.split("/").map(decodeURIComponent).join("/");
      if (!(await mayReadStoredObject(req, key))) {
        return res.status(404).json({ error: "File not found" });
      }
      const buffer = await storageGetObjectBuffer(key);
      res.setHeader("Content-Type", getStorageContentType(key));
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
      res.setHeader(
        "Cache-Control",
        key.startsWith("answer-cards/") ? "public, max-age=86400" : "private, no-store"
      );
      return res.send(buffer);
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? (error as NodeJS.ErrnoException).code
          : undefined;
      const status = code === "ENOENT" ? 404 : error instanceof URIError ? 400 : 500;
      if (status === 500) console.error("[Storage] Failed to serve object:", error);
      return res
        .status(status)
        .json({
          error:
            status === 404
              ? "File not found"
              : status === 400
                ? "Invalid file key"
                : "File storage is unavailable",
        });
    }
  });
  
  registerExcelExportRoutes(app);
  
  // Answer cards are served from the local persistent file store via tRPC API
  // See trpc.answerCards.generateSingle and trpc.answerCards.generateBatch
  // for the persistent file-store implementation
  // 
  // Legacy route removed: /answer-cards/:filename
  // This route previously served files from public/answer-cards/ directory
  // which was not persistent in production environments
  
  // tRPC API - includes the persistent file-store answer card endpoints
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Static files
  // Note: public/answer-cards/ files are no longer served from here
  // Answer cards are generated on-demand and stored on the local persistent volume
  serveStatic(app);

  // Vite dev server
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  }

  app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(error);
    const candidate = error && typeof error === "object"
      ? error as { status?: unknown; statusCode?: unknown }
      : {};
    const rawStatus = typeof candidate.status === "number"
      ? candidate.status
      : candidate.statusCode;
    const status = typeof rawStatus === "number" && rawStatus >= 400 && rawStatus < 500
      ? rawStatus
      : 500;
    if (status === 500) console.error("[Express] Unhandled route error:", error);
    return res.status(status).json({
      error: status === 413
        ? "Request entity too large"
        : status < 500
          ? "Invalid request"
          : "Internal server error",
    });
  });

  const configuredPort = process.env.PORT;
  const port = configuredPort
    ? Number(configuredPort)
    : await findAvailablePort();
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${configuredPort}`);
  }
  const host = process.env.HOST?.trim() || "0.0.0.0";
  server.listen(port, host, () => {
    console.log(`Server running on http://${host}:${port}/`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
