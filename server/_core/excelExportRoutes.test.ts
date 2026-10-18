import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@shared/_core/errors";
import { registerExcelExportRoutes } from "./excelExportRoutes";

type ExportRouteOverrides = NonNullable<
  Parameters<typeof registerExcelExportRoutes>[1]
>;

const runningServers: Server[] = [];

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });
}

async function postExport(
  path: string,
  overrides: ExportRouteOverrides
): Promise<{ status: number; body: unknown }> {
  const app = express();
  app.use(express.json());
  registerExcelExportRoutes(app, overrides);

  const server = createServer(app);
  runningServers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server did not bind to a TCP port");
  }

  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      path.includes("student") ? { studentId: 1 } : { classId: 1 }
    ),
  });

  return { status: response.status, body: await response.json() };
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(runningServers.splice(0).map(closeServer));
});

describe("Excel export route failure responses", () => {
  it("maps an invalid or expired session to 401", async () => {
    const response = await postExport("/api/export-student-report", {
      authenticateRequest: async () => {
        throw new HttpError(403, "Invalid session cookie");
      },
    });

    expect(response).toEqual({
      status: 401,
      body: { error: "Authentication required" },
    });
  });

  it.each([
    ["student", "/api/export-student-report"],
    ["class", "/api/export-class-report"],
  ] as const)("returns a sanitized 500 when %s export authentication fails on the database", async (_kind, path) => {
    const exception = new Error("auth database failure: private connection details");
    exception.stack = "private authentication stack";
    const errorLog = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await postExport(path, {
      authenticateRequest: async () => {
        throw exception;
      },
    });

    expect(response).toEqual({
      status: 500,
      body: { error: "Failed to generate Excel file" },
    });
    expect(JSON.stringify(response.body)).not.toContain(exception.message);
    expect(JSON.stringify(response.body)).not.toContain(exception.stack);
    expect(errorLog).toHaveBeenCalled();
  });

  it("does not expose a student export exception to the HTTP client", async () => {
    const exception = new Error(
      "student export database failure: secret connection string"
    );
    exception.stack = "student export stack trace";
    const errorLog = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await postExport("/api/export-student-report", {
      authenticateRequest: async () => ({ id: 1 }),
      getStudentById: async () => {
        throw exception;
      },
    });

    expect(response).toEqual({
      status: 500,
      body: { error: "Failed to generate Excel file" },
    });
    expect(JSON.stringify(response.body)).not.toContain(exception.message);
    expect(JSON.stringify(response.body)).not.toContain(exception.stack);
    expect(errorLog).toHaveBeenCalledWith("Excel export error:", exception);
  });

  it("does not expose a class export exception to the HTTP client", async () => {
    const exception = new Error(
      "class export database failure: secret connection string"
    );
    exception.stack = "class export stack trace";
    const errorLog = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await postExport("/api/export-class-report", {
      authenticateRequest: async () => ({ id: 1 }),
      getClassById: async () => {
        throw exception;
      },
    });

    expect(response).toEqual({
      status: 500,
      body: { error: "Failed to generate Excel file" },
    });
    expect(JSON.stringify(response.body)).not.toContain(exception.message);
    expect(JSON.stringify(response.body)).not.toContain(exception.stack);
    expect(errorLog).toHaveBeenCalledWith(
      "Class Excel export error:",
      exception
    );
  });
});
