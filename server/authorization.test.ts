import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  db: {
    getClassById: vi.fn(),
    getStudentById: vi.fn(),
    getQuestionFolderById: vi.fn(),
    getQuestionSetById: vi.fn(),
    getQuestionById: vi.fn(),
    getSessionById: vi.fn(),
    deleteClass: vi.fn(),
    updateStudent: vi.fn(),
    createQuestionSet: vi.fn(),
  },
}));

vi.mock("./db", async importOriginal => ({
  ...(await importOriginal<typeof import("./db")>()),
  ...mocks.db,
}));

import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(id: number): TrpcContext {
  const user: AuthenticatedUser = {
    id,
    openId: `authorization-test-${id}`,
    email: `teacher-${id}@example.com`,
    name: `Teacher ${id}`,
    loginMethod: "local",
    passwordHash: null,
    avatarUrl: null,
    wechatId: null,
    qqId: null,
    douyinId: null,
    role: "user",
    isEmailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("teacher resource ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.getClassById.mockResolvedValue({
      id: 11,
      teacherId: 1,
      name: "Private class",
    });
    mocks.db.getStudentById.mockResolvedValue({
      id: 22,
      classId: 11,
      name: "Private student",
      cardNumber: 3,
    });
    mocks.db.getQuestionFolderById.mockResolvedValue({
      id: 33,
      teacherId: 1,
      name: "Private folder",
      parentFolderId: null,
    });
    mocks.db.getQuestionSetById.mockResolvedValue({
      id: 44,
      teacherId: 1,
      title: "Private set",
      folderId: null,
    });
    mocks.db.getQuestionById.mockResolvedValue({ id: 55, setId: 44 });
    mocks.db.getSessionById.mockResolvedValue({
      id: 66,
      teacherId: 1,
      classId: 11,
      setId: 44,
      status: "active",
    });
  });

  it("rejects another teacher's reads and writes across private resource types", async () => {
    const otherTeacher = appRouter.createCaller(createContext(2));

    await expect(otherTeacher.classes.get({ classId: 11 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(otherTeacher.classes.delete({ classId: 11 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(otherTeacher.students.update({ studentId: 22, name: "Unauthorized rename" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(otherTeacher.questionFolders.get({ folderId: 33 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(otherTeacher.questionSets.get({ setId: 44 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(otherTeacher.sessions.get({ sessionId: 66 })).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mocks.db.deleteClass).not.toHaveBeenCalled();
    expect(mocks.db.updateStudent).not.toHaveBeenCalled();
  });

  it("does not reveal whether a class exists to another teacher", async () => {
    const otherTeacher = appRouter.createCaller(createContext(2));
    mocks.db.getClassById
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 11,
        teacherId: 1,
        name: "Private class",
      });

    const missingResult = await otherTeacher.classes.get({ classId: 12 }).catch(error => error);
    const foreignResult = await otherTeacher.classes.get({ classId: 11 }).catch(error => error);

    expect(missingResult).toMatchObject({
      code: "NOT_FOUND",
      message: "资源不存在或无权访问",
    });
    expect(foreignResult).toMatchObject({
      code: "NOT_FOUND",
      message: "资源不存在或无权访问",
    });
  });

  it("rejects using another teacher's folder as a new question set parent", async () => {
    const otherTeacher = appRouter.createCaller(createContext(2));

    await expect(otherTeacher.questionSets.create({
      title: "Unauthorized set",
      folderId: 33,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mocks.db.createQuestionSet).not.toHaveBeenCalled();
  });
});
