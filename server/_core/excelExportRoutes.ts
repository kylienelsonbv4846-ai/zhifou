import ExcelJS from "exceljs";
import type { Express, Request } from "express";
import * as db from "../db";
import { sdk } from "./sdk";
import { HttpError } from "@shared/_core/errors";

function getContentDisposition(filename: string): string {
  const isAscii = /^[\x20-\x7E]*$/.test(filename);
  if (isAscii) return `attachment; filename="${filename}"`;

  const encodedFilename = encodeURIComponent(filename);
  const asciiFileName = filename.replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodedFilename}`;
}

type ExportRouteDependencies = {
  authenticateRequest: (req: Request) => Promise<{ id: number }>;
  getStudentById: typeof db.getStudentById;
  getStudentAnswers: typeof db.getStudentAnswers;
  getClassById: typeof db.getClassById;
  getClassStatistics: typeof db.getClassStatistics;
  getClassSessionsData: typeof db.getClassSessionsData;
  getStudentsByClass: typeof db.getStudentsByClass;
  getSessionById: typeof db.getSessionById;
};

async function authenticateExportRequest(
  req: Request,
  authenticateRequest: ExportRouteDependencies["authenticateRequest"]
): Promise<{ id: number } | null> {
  try {
    return await authenticateRequest(req);
  } catch (error) {
    if (error instanceof HttpError && (error.statusCode === 401 || error.statusCode === 403)) {
      return null;
    }
    throw error;
  }
}

/** Registers Excel report export routes with injectable data/auth dependencies for isolated tests. */
export function registerExcelExportRoutes(
  app: Express,
  overrides: Partial<ExportRouteDependencies> = {}
) {
  const {
    authenticateRequest = sdk.authenticateRequest.bind(sdk),
    getStudentById = db.getStudentById,
    getStudentAnswers = db.getStudentAnswers,
    getClassById = db.getClassById,
    getClassStatistics = db.getClassStatistics,
    getClassSessionsData = db.getClassSessionsData,
    getStudentsByClass = db.getStudentsByClass,
    getSessionById = db.getSessionById,
  } = overrides;

  // Excel export route for student reports; all source data is reloaded after owner validation.
  app.post("/api/export-student-report", async (req, res) => {
    try {
      const user = await authenticateExportRequest(req, authenticateRequest);
      if (!user)
        return res.status(401).json({ error: "Authentication required" });
      const studentId = Number(req.body?.studentId);
      if (!Number.isSafeInteger(studentId) || studentId <= 0) {
        return res.status(400).json({ error: "studentId is required" });
      }
      const student = await getStudentById(studentId);
      const classRecord = student ? await getClassById(student.classId) : null;
      if (!student || !classRecord || classRecord.teacherId !== user.id) {
        return res.status(404).json({ error: "Student not found" });
      }
      const studentName = student.name;
      const studentAnswers = await getStudentAnswers(studentId);
      const totalCorrect = studentAnswers.filter(
        answer => answer.isCorrect
      ).length;
      const studentStats = {
        totalAnswered: studentAnswers.length,
        totalCorrect,
        correctRate: studentAnswers.length
          ? Math.round((totalCorrect / studentAnswers.length) * 100)
          : 0,
      };
      const totalSessions = new Set(
        studentAnswers.map(answer => answer.sessionId)
      ).size;

      // Create a new workbook
      const workbook = new ExcelJS.Workbook();

      // Add summary sheet with new structure
      const summarySheet = workbook.addWorksheet("统计数据");
      summarySheet.columns = [
        { header: "学生姓名", key: "studentName", width: 15 },
        { header: "总会话数", key: "totalSessions", width: 12 },
        { header: "总答题数", key: "totalAnswered", width: 12 },
        { header: "正确数", key: "totalCorrect", width: 12 },
        { header: "正确率(%)", key: "correctRate", width: 12 },
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
      const detailSheet = workbook.addWorksheet("答题详情");
      detailSheet.columns = [
        { header: "题号", key: "questionNum", width: 8 },
        { header: "会话ID", key: "sessionId", width: 12 },
        { header: "正确答案", key: "correctAnswer", width: 10 },
        { header: "答案", key: "answer", width: 8 },
        { header: "是否正确", key: "isCorrect", width: 12 },
        { header: "提交时间", key: "time", width: 20 },
      ];

      const detailRows = studentAnswers.map((answer: any, index: number) => ({
        questionNum: index + 1,
        sessionId: answer.sessionId,
        correctAnswer: answer.correctAnswer
          ? answer.correctAnswer.toUpperCase()
          : "N/A",
        answer: answer.answer ? answer.answer.toUpperCase() : "N/A",
        isCorrect: answer.isCorrect ? "✓" : "✗",
        time: answer.answeredAt
          ? new Date(answer.answeredAt).toLocaleString("zh-CN")
          : "N/A",
      }));
      detailSheet.addRows(detailRows);

      // Set red color for incorrect answers (✗)
      detailSheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          // Skip header row
          const isCorrectCell = row.getCell(5); // "是否正确" column is the 5th column
          if (isCorrectCell.value === "✗") {
            isCorrectCell.font = { color: { argb: "FFFF0000" } }; // Red color
          }
        }
      });

      // Generate Excel file
      const buffer = await workbook.xlsx.writeBuffer();

      // Send as response
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      const timestamp = new Date().toISOString().split("T")[0];
      const fileName = `学生报告-${studentName}-${timestamp}.xlsx`;
      res.setHeader("Content-Disposition", getContentDisposition(fileName));
      res.send(buffer);
    } catch (error) {
      console.error("Excel export error:", error);
      res.status(500).json({ error: "Failed to generate Excel file" });
    }
  });

  // Excel export route for class reports; only the owning teacher may export this class.
  app.post("/api/export-class-report", async (req: any, res: any) => {
    try {
      const user = await authenticateExportRequest(req, authenticateRequest);
      if (!user)
        return res.status(401).json({ error: "Authentication required" });
      const classId = Number(req.body?.classId);
      if (!Number.isSafeInteger(classId) || classId <= 0) {
        return res.status(400).json({ error: "classId is required" });
      }
      const classRecord = await getClassById(classId);
      if (!classRecord || classRecord.teacherId !== user.id) {
        return res.status(404).json({ error: "Class not found" });
      }

      // Get class statistics
      const classStats = await getClassStatistics(classId);
      if (!classStats) {
        return res.status(404).json({ error: "Class not found" });
      }

      // Get class sessions data
      const sessionsData = await getClassSessionsData(classId);

      // Get all students in the class
      const classStudents = await getStudentsByClass(classId);

      // Create a new workbook
      const workbook = new ExcelJS.Workbook();

      // ===== Sheet 1: Class Overview =====
      const overviewSheet = workbook.addWorksheet("班级数据总览");
      overviewSheet.columns = [
        { header: "班级名称", key: "className", width: 20 },
        { header: "学生总数", key: "studentCount", width: 12 },
        { header: "总会话数", key: "sessionCount", width: 12 },
        { header: "总答题数", key: "totalAnswers", width: 12 },
        { header: "正确数", key: "correctAnswers", width: 12 },
        { header: "班级平均正确率(%)", key: "accuracy", width: 15 },
        { header: "最高分学生", key: "topStudent", width: 20 },
        { header: "最高分率(%)", key: "topAccuracy", width: 12 },
        { header: "最低分学生", key: "bottomStudent", width: 20 },
        { header: "最低分率(%)", key: "bottomAccuracy", width: 12 },
      ];

      overviewSheet.addRows([
        {
          className: classStats.className,
          studentCount: classStats.studentCount,
          sessionCount: classStats.sessionCount,
          totalAnswers: classStats.totalAnswers,
          correctAnswers: classStats.correctAnswers,
          accuracy: classStats.accuracy,
          topStudent: classStats.topStudent?.name || "N/A",
          topAccuracy: classStats.topStudent?.accuracy || 0,
          bottomStudent: classStats.bottomStudent?.name || "N/A",
          bottomAccuracy: classStats.bottomStudent?.accuracy || 0,
        },
      ]);

      // ===== Sheet 2: Detailed Class Data =====
      const detailSheet = workbook.addWorksheet("班级详细数据");

      // Build detailed data structure
      const detailRows: any[] = [];

      for (const sessionData of sessionsData) {
        const session = await getSessionById(sessionData.sessionId);
        if (!session) continue;

        // For each question in this session, calculate class-wide statistics
        for (const question of sessionData.questions) {
          const questionAnswers = sessionData.answers.filter(
            (a: any) => a.questionId === question.questionId
          );
          const correctCount = questionAnswers.filter(
            (a: any) => a.isCorrect
          ).length;
          const totalCount = questionAnswers.length;
          const correctRate =
            totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

          detailRows.push({
            sessionId: sessionData.sessionId,
            sessionDate: new Date(session.createdAt).toLocaleString("zh-CN"),
            questionNum: question.orderIndex + 1,
            questionText: question.questionText?.substring(0, 50) || "N/A",
            correctAnswer: question.correctAnswer?.toUpperCase() || "N/A",
            classCorrectRate: `${correctRate}%`,
            classParticipants: totalCount,
            classCorrectCount: correctCount,
          });
        }
      }

      // Add detailed data rows
      if (detailRows.length > 0) {
        detailSheet.columns = [
          { header: "会话ID", key: "sessionId", width: 12 },
          { header: "会话时间", key: "sessionDate", width: 20 },
          { header: "题号", key: "questionNum", width: 8 },
          { header: "题目内容", key: "questionText", width: 30 },
          { header: "正确答案", key: "correctAnswer", width: 10 },
          { header: "班级正确率(%)", key: "classCorrectRate", width: 15 },
          { header: "班级参与人数", key: "classParticipants", width: 12 },
          { header: "班级正确人数", key: "classCorrectCount", width: 12 },
        ];
        detailSheet.addRows(detailRows);

        // Merge cells for consecutive same sessionId values in column A
        let mergeStartRow = 2; // Start from row 2 (first data row, after header)
        for (let i = 2; i <= detailRows.length + 1; i++) {
          const currentSessionId = detailRows[i - 2]?.sessionId;
          const nextSessionId = detailRows[i - 1]?.sessionId;

          // If next row has different sessionId or we're at the last row, merge the range
          if (
            nextSessionId !== currentSessionId ||
            i === detailRows.length + 1
          ) {
            if (i - mergeStartRow > 0) {
              // Merge cells from mergeStartRow to i-1 in column A (sessionId column)
              detailSheet.mergeCells(`A${mergeStartRow}:A${i - 1}`);
              // Center align the merged cell
              const mergedCell = detailSheet.getCell(`A${mergeStartRow}`);
              mergedCell.alignment = {
                vertical: "middle",
                horizontal: "center",
              };
            }
            mergeStartRow = i;
          }
        }
      } else {
        detailSheet.columns = [
          { header: "会话ID", key: "sessionId", width: 12 },
          { header: "会话时间", key: "sessionDate", width: 20 },
          { header: "题号", key: "questionNum", width: 8 },
          { header: "题目内容", key: "questionText", width: 30 },
          { header: "正确答案", key: "correctAnswer", width: 10 },
          { header: "班级正确率(%)", key: "classCorrectRate", width: 15 },
          { header: "班级参与人数", key: "classParticipants", width: 12 },
          { header: "班级正确人数", key: "classCorrectCount", width: 12 },
        ];
      }

      // ===== Sheet 3: Student Performance in Class =====
      const studentPerfSheet = workbook.addWorksheet("学生表现");
      studentPerfSheet.columns = [
        { header: "学生姓名", key: "studentName", width: 15 },
        { header: "总答题数", key: "totalAnswered", width: 12 },
        { header: "正确数", key: "totalCorrect", width: 12 },
        { header: "正确率(%)", key: "correctRate", width: 12 },
      ];

      const studentPerfRows = classStudents.map((student: any) => {
        const studentAnswers = sessionsData.flatMap((s: any) =>
          s.answers.filter((a: any) => a.studentId === student.id)
        );
        const totalAnswered = studentAnswers.length;
        const totalCorrect = studentAnswers.filter(
          (a: any) => a.isCorrect
        ).length;
        const correctRate =
          totalAnswered > 0
            ? Math.round((totalCorrect / totalAnswered) * 100)
            : 0;

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
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      const timestamp = new Date().toISOString().split("T")[0];
      const fileName = `班级报告-${classId}-${timestamp}.xlsx`;
      res.setHeader("Content-Disposition", getContentDisposition(fileName));
      res.send(buffer);
    } catch (error) {
      console.error("Class Excel export error:", error);
      res.status(500).json({ error: "Failed to generate Excel file" });
    }
  });
}
