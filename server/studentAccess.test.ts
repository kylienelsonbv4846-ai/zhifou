import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  db: {
    getSessionById: vi.fn(),
    getStudentById: vi.fn(),
    getClassById: vi.fn(),
    getQuestionSetById: vi.fn(),
    getSessionQueue: vi.fn(),
    getQuestionById: vi.fn(),
    getAnswersBySessionAndQuestion: vi.fn(),
    submitAnswer: vi.fn(),
  },
}));

vi.mock("./db", async importOriginal => ({
  ...(await importOriginal<typeof import("./db")>()),
  ...mocks.db,
}));

import { appRouter } from "./routers";
import { createStudentAccessToken } from "./_core/sdk";

const session = { id: 101, classId: 202, setId: 303, teacherId: 71, status: "active" };
const student = { id: 404, classId: 202, name: "Student Four", cardNumber: 4 };
const classRecord = { id: 202, teacherId: 71, name: "Class Seven" };
const questionSet = { id: 303, teacherId: 71, title: "Test set" };
const queue = [{ sessionId: 101, questionId: 505, orderIndex: 0, isActive: true }];
const question = {
  id: 505,
  setId: 303,
  questionText: "Choose one",
  questionType: "single_choice",
  optionA: "Alpha",
  optionB: "Beta",
  optionC: null,
  optionD: null,
  questionMediaUrl: "/api/storage/questions/71/question.png",
  questionMediaType: "image",
  optionAMediaUrl: null,
  optionBMediaUrl: null,
  optionCMediaUrl: null,
  optionDMediaUrl: null,
  correctAnswer: "B",
};

function createCaller() {
  const ctx = {
    user: null,
    req: { protocol: "https", headers: {} },
    res: { cookie: vi.fn(), clearCookie: vi.fn() },
  } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

describe("student session capability API", () => {
  beforeEach(() => {
    vi.stubEnv("CLASSCLICKER_SESSION_SECRET", "test-student-capability-secret-long-enough");
    vi.clearAllMocks();
    mocks.db.getSessionById.mockResolvedValue(session);
    mocks.db.getStudentById.mockResolvedValue(student);
    mocks.db.getClassById.mockResolvedValue(classRecord);
    mocks.db.getQuestionSetById.mockResolvedValue(questionSet);
    mocks.db.getSessionQueue.mockResolvedValue(queue);
    mocks.db.getQuestionById.mockResolvedValue(question);
    mocks.db.getAnswersBySessionAndQuestion.mockResolvedValue([
      { studentId: student.id, answer: "A", isCorrect: false },
      { studentId: 405, answer: "B", isCorrect: true },
    ]);
    mocks.db.submitAnswer.mockResolvedValue(9001);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns only the linked student's safe question view and signs its private media URL", async () => {
    const caller = createCaller();
    const token = await createStudentAccessToken(session.id, student.id);
    const result = await caller.studentAccess.getSession({
      sessionId: session.id,
      studentId: student.id,
      token,
    });

    expect(result).toMatchObject({
      className: classRecord.name,
      studentName: student.name,
      submittedAnswer: "A",
      question: { id: question.id, questionText: question.questionText },
    });
    expect(result.question).not.toHaveProperty("correctAnswer");
    expect(JSON.stringify(result)).not.toContain('"correctAnswer"');
    const mediaUrl = new URL(result.question.questionMediaUrl!, "https://classclicker.test");
    expect(mediaUrl.searchParams.get("access_token")).toBe(token);
    expect(mediaUrl.searchParams.get("session_id")).toBe(String(session.id));
    expect(mediaUrl.searchParams.get("student_id")).toBe(String(student.id));
    expect(result).not.toHaveProperty("students");
    expect(result).not.toHaveProperty("answers");
    expect(JSON.stringify(result)).not.toContain('"studentId":405');
  });

  it("rejects a token replayed for a different student before loading database records", async () => {
    const caller = createCaller();
    const token = await createStudentAccessToken(session.id, student.id);

    await expect(caller.studentAccess.getSession({
      sessionId: session.id,
      studentId: student.id + 1,
      token,
    })).rejects.toThrow("学生答题链接无效或已过期");
    expect(mocks.db.getSessionById).not.toHaveBeenCalled();
  });

  it.each(["pending", "completed"]) ("rejects student access while the session is %s", async status => {
    mocks.db.getSessionById.mockResolvedValue({ ...session, status });
    const caller = createCaller();
    const token = await createStudentAccessToken(session.id, student.id);

    await expect(caller.studentAccess.getSession({
      sessionId: session.id,
      studentId: student.id,
      token,
    })).rejects.toThrow("资源不存在或无权访问");
    expect(mocks.db.getSessionQueue).not.toHaveBeenCalled();
  });

  it("rejects a queue transition with no active question instead of exposing question one", async () => {
    mocks.db.getSessionQueue.mockResolvedValue([{ ...queue[0], isActive: false }]);
    const caller = createCaller();
    const token = await createStudentAccessToken(session.id, student.id);

    await expect(caller.studentAccess.getSession({
      sessionId: session.id,
      studentId: student.id,
      token,
    })).rejects.toThrow("资源不存在或无权访问");
  });

  it("rejects inconsistent teacher ownership for a signed participant link", async () => {
    mocks.db.getClassById.mockResolvedValue({ ...classRecord, teacherId: 999 });
    const caller = createCaller();
    const token = await createStudentAccessToken(session.id, student.id);

    await expect(caller.studentAccess.getSession({
      sessionId: session.id,
      studentId: student.id,
      token,
    })).rejects.toThrow("资源不存在或无权访问");
  });

  it("rejects stale-question submissions without writing an answer", async () => {
    const caller = createCaller();
    const token = await createStudentAccessToken(session.id, student.id);

    await expect(caller.studentAccess.submit({
      sessionId: session.id,
      studentId: student.id,
      questionId: question.id + 1,
      token,
      answer: "A",
    })).rejects.toThrow("当前题目已变化，请刷新后重试");
    expect(mocks.db.submitAnswer).not.toHaveBeenCalled();
  });

  it("acknowledges a valid submission without exposing correctness", async () => {
    const caller = createCaller();
    const token = await createStudentAccessToken(session.id, student.id);

    const result = await caller.studentAccess.submit({
      sessionId: session.id,
      studentId: student.id,
      questionId: question.id,
      token,
      answer: "A",
    });

    expect(result).toEqual({ accepted: true });
    expect(result).not.toHaveProperty("isCorrect");
    expect(mocks.db.submitAnswer).toHaveBeenCalledWith({
      sessionId: session.id,
      questionId: question.id,
      studentId: student.id,
      answer: "A",
      isCorrect: false,
    });
  });

  it("normalizes multiple-choice combinations before scoring and saving", async () => {
    mocks.db.getQuestionById.mockResolvedValue({
      ...question,
      questionType: "multiple_choice",
      correctAnswer: "BA",
    });
    const caller = createCaller();
    const token = await createStudentAccessToken(session.id, student.id);

    const result = await caller.studentAccess.submit({
      sessionId: session.id,
      studentId: student.id,
      questionId: question.id,
      token,
      answer: "bA",
    });

    expect(result).toEqual({ accepted: true });
    expect(mocks.db.submitAnswer).toHaveBeenCalledWith({
      sessionId: session.id,
      questionId: question.id,
      studentId: student.id,
      answer: "AB",
      isCorrect: true,
    });
  });

  it("rejects duplicate option letters in a multiple-choice answer", async () => {
    mocks.db.getQuestionById.mockResolvedValue({ ...question, questionType: "multiple_choice" });
    const caller = createCaller();
    const token = await createStudentAccessToken(session.id, student.id);

    await expect(caller.studentAccess.submit({
      sessionId: session.id,
      studentId: student.id,
      questionId: question.id,
      token,
      answer: "AAB",
    })).rejects.toThrow("多选答案格式无效");
    expect(mocks.db.submitAnswer).not.toHaveBeenCalled();
  });

  it("rejects out-of-range answers for true/false questions", async () => {
    mocks.db.getQuestionById.mockResolvedValue({ ...question, questionType: "true_false" });
    const caller = createCaller();
    const token = await createStudentAccessToken(session.id, student.id);

    await expect(caller.studentAccess.submit({
      sessionId: session.id,
      studentId: student.id,
      questionId: question.id,
      token,
      answer: "C",
    })).rejects.toThrow("答案选项无效");
    expect(mocks.db.submitAnswer).not.toHaveBeenCalled();
  });
});
