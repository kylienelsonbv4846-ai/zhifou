import { COOKIE_NAME } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365;

function getSessionSecret(): Uint8Array {
  const secret = process.env.CLASSCLICKER_SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "CLASSCLICKER_SESSION_SECRET must be configured to sign or verify sessions"
    );
  }
  return new TextEncoder().encode(secret);
}

class SessionService {
  async createLocalSessionToken(
    userId: number,
    sessionVersion = 0,
    options: { expiresInSeconds?: number } = {}
  ): Promise<string> {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new Error("A valid local user ID is required to create a session");
    }
    if (!Number.isSafeInteger(sessionVersion) || sessionVersion < 0) {
      throw new Error("A valid local session version is required to create a session");
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresInSeconds = options.expiresInSeconds ?? SESSION_TTL_SECONDS;

    return new SignJWT({ token_use: "local_session", sessionVersion })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(String(userId))
      .setIssuedAt(now)
      .setExpirationTime(now + expiresInSeconds)
      .sign(getSessionSecret());
  }

  async verifyLocalSession(
    token: string | undefined | null
  ): Promise<{ userId: number; sessionVersion: number } | null> {
    if (!token) return null;
    const secret = getSessionSecret();

    try {
      const { payload } = await jwtVerify(token, secret, {
        algorithms: ["HS256"],
      });
      const userId = Number(payload.sub);
      const sessionVersion = payload.sessionVersion;

      if (
        payload.token_use !== "local_session" ||
        !Number.isSafeInteger(userId) ||
        userId <= 0 ||
        typeof sessionVersion !== "number" ||
        !Number.isSafeInteger(sessionVersion) ||
        sessionVersion < 0
      ) {
        return null;
      }

      return { userId, sessionVersion };
    } catch {
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const session = await this.verifyLocalSession(cookies[COOKIE_NAME]);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const user = await db.getUserById(session.userId);
    if (
      !user ||
      user.loginMethod !== "local" ||
      !user.isEmailVerified ||
      user.sessionVersion !== session.sessionVersion
    ) {
      throw ForbiddenError("Local account session is no longer valid");
    }

    await db.updateUserLastSignedIn(user.id);
    return user;
  }
}

const STUDENT_ACCESS_TTL_SECONDS = 60 * 60 * 6;

export async function createStudentAccessToken(
  sessionId: number,
  studentId: number
): Promise<string> {
  if (
    !Number.isSafeInteger(sessionId) ||
    sessionId <= 0 ||
    !Number.isSafeInteger(studentId) ||
    studentId <= 0
  ) {
    throw new Error("Valid session and student IDs are required");
  }

  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ token_use: "student_access", session_id: sessionId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(studentId))
    .setIssuedAt(now)
    .setExpirationTime(now + STUDENT_ACCESS_TTL_SECONDS)
    .sign(getSessionSecret());
}

export async function verifyStudentAccessToken(
  token: string | undefined | null,
  sessionId: number,
  studentId: number
): Promise<boolean> {
  if (!token) return false;
  const secret = getSessionSecret();
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    return (
      payload.token_use === "student_access" &&
      Number(payload.session_id) === sessionId &&
      Number(payload.sub) === studentId &&
      Number.isSafeInteger(Number(payload.session_id)) &&
      Number.isSafeInteger(Number(payload.sub))
    );
  } catch {
    return false;
  }
}

export const sdk = new SessionService();
