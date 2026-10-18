import express from "express";
import { createServer } from "http";
import net from "net";
import fs from "fs";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import ExcelJS from "exceljs";
import {
  getStorageContentType,
  storageGetObjectBuffer,
  checkStorageReadiness,
} from "../storage";
import * as db from "../db";
import { sdk, verifyStudentAccessToken } from "./sdk";

/**
 * Generate RFC 5987 compliant Content-Disposition header
 * Supports both ASCII and non-ASCII (UTF-8) filenames
 * @param filename The filename to encode
 * @returns Content-Disposition header value
 */
function getContentDisposition(filename: string): string {
  // Check if filename contains only ASCII characters
  const isAscii = /^[\x20-\x7E]*$/.test(filename);
  
  if (isAscii) {
    // Simple ASCII filename
    return `attachment; filename="${filename}"`;
  } else {
    // RFC 5987 encoding for non-ASCII filenames
    // For non-ASCII filenames, use only filename* parameter with UTF-8 encoding
    // Format: filename*=UTF-8''<percent-encoded-filename>
    const encodedFilename = encodeURIComponent(filename);
    // Also provide a fallback ASCII filename
    const asciiFileName = filename.replace(/[^\x20-\x7E]/g, '_');
    return `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodedFilename}`;
  }
}

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
  } catch {
    // Anonymous access is allowed only for a signed session/student media capability below.
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
      console.error("[Storage] Failed to serve object:", error);
      const code = (error as NodeJS.ErrnoException).code;
      const status = code === "ENOENT" ? 404 : code ? 500 : 400;
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
  
  // Excel export route for student reports; all source data is reloaded after owner validation.
  app.post("/api/export-student-report", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req).catch(() => null);
      if (!user) return res.status(401).json({ error: "Authentication required" });
      const studentId = Number(req.body?.studentId);
      if (!Number.isSafeInteger(studentId) || studentId <= 0) {
        return res.status(400).json({ error: "studentId is required" });
      }
      const student = await db.getStudentById(studentId);
      const classRecord = student ? await db.getClassById(student.classId) : null;
      if (!student || !classRecord || classRecord.teacherId !== user.id) {
        return res.status(404).json({ error: "Student not found" });
      }
      const studentName = student.name;
      const studentAnswers = await db.getStudentAnswers(studentId);
      const totalCorrect = studentAnswers.filter(answer => answer.isCorrect).length;
      const studentStats = {
        totalAnswered: studentAnswers.length,
        totalCorrect,
        correctRate: studentAnswers.length
          ? Math.round((totalCorrect / studentAnswers.length) * 100)
          : 0,
      };
      const totalSessions = new Set(studentAnswers.map(answer => answer.sessionId)).size;
      
      // Create a new workbook
      const workbook = new ExcelJS.Workbook();
      
      // Add summary sheet with new structure
      const summarySheet = workbook.addWorksheet('统计数据');
      summarySheet.columns = [
        { header: '学生姓名', key: 'studentName', width: 15 },
        { header: '总会话数', key: 'totalSessions', width: 12 },
        { header: '总答题数', key: 'totalAnswered', width: 12 },
        { header: '正确数', key: 'totalCorrect', width: 12 },
        { header: '正确率(%)', key: 'correctRate', width: 12 },
      ];
      summarySheet.addRows([
        {
          studentName: studentName,
          totalSessions: totalSessions || 0,
          totalAnswered: studentStats.totalAnswered,
          totalCorrect: studentStats.totalCorrect,
          correctRate: studentStats.correctRate,
        },
      ]);
      
      // Add detail sheet
      const detailSheet = workbook.addWorksheet('答题详情');
      detailSheet.columns = [
        { header: '题号', key: 'questionNum', width: 8 },
        { header: '会话ID', key: 'sessionId', width: 12 },
        { header: '正确答案', key: 'correctAnswer', width: 10 },
        { header: '答案', key: 'answer', width: 8 },
        { header: '是否正确', key: 'isCorrect', width: 12 },
        { header: '提交时间', key: 'time', width: 20 },
      ];
      
      const detailRows = studentAnswers.map((answer: any, index: number) => ({
        questionNum: index + 1,
        sessionId: answer.sessionId,
        correctAnswer: answer.correctAnswer ? answer.correctAnswer.toUpperCase() : 'N/A',
        answer: answer.answer ? answer.answer.toUpperCase() : 'N/A',
        isCorrect: answer.isCorrect ? '✓' : '✗',
        time: answer.answeredAt ? new Date(answer.answeredAt).toLocaleString('zh-CN') : 'N/A',
      }));
      detailSheet.addRows(detailRows);
      
      // Set red color for incorrect answers (✗)
      detailSheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) { // Skip header row
          const isCorrectCell = row.getCell(5); // "是否正确" column is the 5th column
          if (isCorrectCell.value === '✗') {
            isCorrectCell.font = { color: { argb: 'FFFF0000' } }; // Red color
          }
        }
      });
      
      // Generate Excel file
      const buffer = await workbook.xlsx.writeBuffer();
      
      // Send as response
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `学生报告-${studentName}-${timestamp}.xlsx`;
      res.setHeader('Content-Disposition', getContentDisposition(fileName));
      res.send(buffer);
    } catch (error) {
      console.error('Excel export error:', error);
      res.status(500).json({ error: 'Failed to generate Excel file', details: (error as any).message });
    }
  });
  
  // Excel export route for class reports; only the owning teacher may export this class.
  app.post("/api/export-class-report", async (req: any, res: any) => {
    try {
      const user = await sdk.authenticateRequest(req).catch(() => null);
      if (!user) return res.status(401).json({ error: 'Authentication required' });
      const classId = Number(req.body?.classId);
      if (!Number.isSafeInteger(classId) || classId <= 0) {
        return res.status(400).json({ error: 'classId is required' });
      }
      const classRecord = await db.getClassById(classId);
      if (!classRecord || classRecord.teacherId !== user.id) {
        return res.status(404).json({ error: 'Class not found' });
      }
      
      // Import db functions
      const { getClassStatistics, getClassSessionsData, getStudentsByClass, getSessionById } = await import('../db');
      
      // Get class statistics
      const classStats = await getClassStatistics(classId);
      if (!classStats) {
        return res.status(404).json({ error: 'Class not found' });
      }
      
      // Get class sessions data
      const sessionsData = await getClassSessionsData(classId);
      
      // Get all students in the class
      const classStudents = await getStudentsByClass(classId);
      
      // Create a new workbook
      const workbook = new ExcelJS.Workbook();
      
      // ===== Sheet 1: Class Overview =====
      const overviewSheet = workbook.addWorksheet('班级数据总览');
      overviewSheet.columns = [
        { header: '班级名称', key: 'className', width: 20 },
        { header: '学生总数', key: 'studentCount', width: 12 },
        { header: '总会话数', key: 'sessionCount', width: 12 },
        { header: '总答题数', key: 'totalAnswers', width: 12 },
        { header: '正确数', key: 'correctAnswers', width: 12 },
        { header: '班级平均正确率(%)', key: 'accuracy', width: 15 },
        { header: '最高分学生', key: 'topStudent', width: 20 },
        { header: '最高分率(%)', key: 'topAccuracy', width: 12 },
        { header: '最低分学生', key: 'bottomStudent', width: 20 },
        { header: '最低分率(%)', key: 'bottomAccuracy', width: 12 },
      ];
      
      overviewSheet.addRows([
        {
          className: classStats.className,
          studentCount: classStats.studentCount,
          sessionCount: classStats.sessionCount,
          totalAnswers: classStats.totalAnswers,
          correctAnswers: classStats.correctAnswers,
          accuracy: classStats.accuracy,
          topStudent: classStats.topStudent?.name || 'N/A',
          topAccuracy: classStats.topStudent?.accuracy || 0,
          bottomStudent: classStats.bottomStudent?.name || 'N/A',
          bottomAccuracy: classStats.bottomStudent?.accuracy || 0,
        },
      ]);
      
      // ===== Sheet 2: Detailed Class Data =====
      const detailSheet = workbook.addWorksheet('班级详细数据');
      
      // Build detailed data structure
      const detailRows: any[] = [];
      
      for (const sessionData of sessionsData) {
        const session = await getSessionById(sessionData.sessionId);
        if (!session) continue;
        
        // For each question in this session, calculate class-wide statistics
        for (const question of sessionData.questions) {
          const questionAnswers = sessionData.answers.filter((a: any) => a.questionId === question.questionId);
          const correctCount = questionAnswers.filter((a: any) => a.isCorrect).length;
          const totalCount = questionAnswers.length;
          const correctRate = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
          
          detailRows.push({
            sessionId: sessionData.sessionId,
            sessionDate: new Date(session.createdAt).toLocaleString('zh-CN'),
            questionNum: question.orderIndex + 1,
            questionText: question.questionText?.substring(0, 50) || 'N/A',
            correctAnswer: question.correctAnswer?.toUpperCase() || 'N/A',
            classCorrectRate: `${correctRate}%`,
            classParticipants: totalCount,
            classCorrectCount: correctCount,
          });
        }
      }
      
      // Add detailed data rows
      if (detailRows.length > 0) {
        detailSheet.columns = [
          { header: '会话ID', key: 'sessionId', width: 12 },
          { header: '会话时间', key: 'sessionDate', width: 20 },
          { header: '题号', key: 'questionNum', width: 8 },
          { header: '题目内容', key: 'questionText', width: 30 },
          { header: '正确答案', key: 'correctAnswer', width: 10 },
          { header: '班级正确率(%)', key: 'classCorrectRate', width: 15 },
          { header: '班级参与人数', key: 'classParticipants', width: 12 },
          { header: '班级正确人数', key: 'classCorrectCount', width: 12 },
        ];
        detailSheet.addRows(detailRows);
        
        // Merge cells for consecutive same sessionId values in column A
        let mergeStartRow = 2; // Start from row 2 (first data row, after header)
        for (let i = 2; i <= detailRows.length + 1; i++) {
          const currentSessionId = detailRows[i - 2]?.sessionId;
          const nextSessionId = detailRows[i - 1]?.sessionId;
          
          // If next row has different sessionId or we're at the last row, merge the range
          if (nextSessionId !== currentSessionId || i === detailRows.length + 1) {
            if (i - mergeStartRow > 0) {
              // Merge cells from mergeStartRow to i-1 in column A (sessionId column)
              detailSheet.mergeCells(`A${mergeStartRow}:A${i - 1}`);
              // Center align the merged cell
              const mergedCell = detailSheet.getCell(`A${mergeStartRow}`);
              mergedCell.alignment = { vertical: 'middle', horizontal: 'center' };
            }
            mergeStartRow = i;
          }
        }
      } else {
        detailSheet.columns = [
          { header: '会话ID', key: 'sessionId', width: 12 },
          { header: '会话时间', key: 'sessionDate', width: 20 },
          { header: '题号', key: 'questionNum', width: 8 },
          { header: '题目内容', key: 'questionText', width: 30 },
          { header: '正确答案', key: 'correctAnswer', width: 10 },
          { header: '班级正确率(%)', key: 'classCorrectRate', width: 15 },
          { header: '班级参与人数', key: 'classParticipants', width: 12 },
          { header: '班级正确人数', key: 'classCorrectCount', width: 12 },
        ];
      }
      
      // ===== Sheet 3: Student Performance in Class =====
      const studentPerfSheet = workbook.addWorksheet('学生表现');
      studentPerfSheet.columns = [
        { header: '学生姓名', key: 'studentName', width: 15 },
        { header: '总答题数', key: 'totalAnswered', width: 12 },
        { header: '正确数', key: 'totalCorrect', width: 12 },
        { header: '正确率(%)', key: 'correctRate', width: 12 },
      ];
      
      const studentPerfRows = classStudents.map((student: any) => {
        const studentAnswers = sessionsData.flatMap((s: any) => s.answers.filter((a: any) => a.studentId === student.id));
        const totalAnswered = studentAnswers.length;
        const totalCorrect = studentAnswers.filter((a: any) => a.isCorrect).length;
        const correctRate = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
        
        return {
          studentName: student.name,
          totalAnswered,
          totalCorrect,
          correctRate,
        };
      });
      
      studentPerfSheet.addRows(studentPerfRows);
      
      // Generate Excel file
      const buffer = await workbook.xlsx.writeBuffer();
      
      // Send as response
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `班级报告-${classId}-${timestamp}.xlsx`;
      res.setHeader('Content-Disposition', getContentDisposition(fileName));
      res.send(buffer);
    } catch (error) {
      console.error('Class Excel export error:', error);
      res.status(500).json({ error: 'Failed to generate Excel file', details: (error as any).message });
    }
  });
  
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
