import { describe, expect, it } from "vitest";
import * as db from "./db";

describe("getValidSessions", () => {
  it("should return only sessions with answers", async () => {
    const teacherId = 999;

    // 创建测试班级
    const classId = await db.createClass({
      teacherId,
      name: "Test Class for Valid Sessions",
      description: "Test class",
    });

    // 创建测试题集
    const setId = await db.createQuestionSet({
      teacherId,
      title: "Test Question Set",
      description: "Test set",
    });

    // 创建测试学生
    await db.createStudent({
      classId,
      name: "Test Student",
      cardNumber: 1,
    });

    // 创建测试题目
    await db.createQuestion({
      setId,
      questionText: "Test Question",
      questionType: "single_choice",
      optionA: "Option A",
      optionB: "Option B",
      optionC: "Option C",
      optionD: "Option D",
      correctAnswer: "A",
    });

    // 创建第一个会话（有答案）
    const session1Id = await db.createSession({
      teacherId,
      classId,
      setId,
      status: "pending",
    });

    // 添加题目到队列
    const questions = await db.getQuestionsBySet(setId);
    if (questions.length > 0) {
      await db.addToSessionQueue({
        sessionId: session1Id,
        questionId: questions[0]!.id,
        orderIndex: 0,
        isActive: true,
      });

      // 提交答案
      const students = await db.getStudentsByClass(classId);
      if (students.length > 0) {
        await db.submitAnswer({
          sessionId: session1Id,
          questionId: questions[0]!.id,
          studentId: students[0]!.id,
          answer: "A",
          isCorrect: true,
        });
      }
    }

    // 创建第二个会话（没有答案）
    const session2Id = await db.createSession({
      teacherId,
      classId,
      setId,
      status: "pending",
    });

    // 添加题目到队列但不提交答案
    if (questions.length > 0) {
      await db.addToSessionQueue({
        sessionId: session2Id,
        questionId: questions[0]!.id,
        orderIndex: 0,
        isActive: true,
      });
    }

    // 获取有效会话
    const validSessions = await db.getValidSessions(teacherId);

    // 验证结果：只应该返回有答案的会话
    const validSessionIds = validSessions.map(s => s.id);
    expect(validSessionIds).toContain(session1Id);
    expect(validSessionIds).not.toContain(session2Id);
  });

  it("should sort sessions by creation time (newest first)", async () => {
    const teacherId = 1000;

    // 创建测试班级
    const classId = await db.createClass({
      teacherId,
      name: "Test Class for Sorting",
      description: "Test class",
    });

    // 创建测试题集
    const setId = await db.createQuestionSet({
      teacherId,
      title: "Test Question Set for Sorting",
      description: "Test set",
    });

    // 创建测试学生
    await db.createStudent({
      classId,
      name: "Test Student",
      cardNumber: 2,
    });

    // 创建测试题目
    await db.createQuestion({
      setId,
      questionText: "Test Question",
      questionType: "single_choice",
      optionA: "Option A",
      optionB: "Option B",
      optionC: "Option C",
      optionD: "Option D",
      correctAnswer: "A",
    });

    // 创建两个有答案的会话
    const session1Id = await db.createSession({
      teacherId,
      classId,
      setId,
      status: "pending",
    });

    const questions = await db.getQuestionsBySet(setId);
    const students = await db.getStudentsByClass(classId);

    if (questions.length > 0 && students.length > 0) {
      await db.addToSessionQueue({
        sessionId: session1Id,
        questionId: questions[0]!.id,
        orderIndex: 0,
        isActive: true,
      });

      await db.submitAnswer({
        sessionId: session1Id,
        questionId: questions[0]!.id,
        studentId: students[0]!.id,
        answer: "A",
        isCorrect: true,
      });
    }

    // 创建第二个会话
    const session2Id = await db.createSession({
      teacherId,
      classId,
      setId,
      status: "pending",
    });

    if (questions.length > 0 && students.length > 0) {
      await db.addToSessionQueue({
        sessionId: session2Id,
        questionId: questions[0]!.id,
        orderIndex: 0,
        isActive: true,
      });

      await db.submitAnswer({
        sessionId: session2Id,
        questionId: questions[0]!.id,
        studentId: students[0]!.id,
        answer: "A",
        isCorrect: true,
      });
    }

    // 获取有效会话
    const validSessions = await db.getValidSessions(teacherId);

    // 验证排序：最新创建的会话应该在前面
    const validSessionIds = validSessions.map(s => s.id);
    const session2Index = validSessionIds.indexOf(session2Id);
    const session1Index = validSessionIds.indexOf(session1Id);

    if (session2Index !== -1 && session1Index !== -1) {
      expect(session2Index).toBeLessThan(session1Index);
    }
  });
});
