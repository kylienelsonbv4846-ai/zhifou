import { randomUUID } from "node:crypto";
import { users } from "../drizzle/schema";
import { getDb } from "./db";

export async function createTestUser() {
  const database = await getDb();
  if (!database) throw new Error("Database not available");

  const email = `test-${randomUUID()}@example.test`;
  const insertResult = await database.insert(users).values({
    name: "Test User",
    email,
    loginMethod: "local",
    role: "user",
  });
  const userId = Number(
    (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId
  );

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("Failed to create test user");
  }
  return { database, userId };
}
