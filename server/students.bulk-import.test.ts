import { describe, it, expect, afterEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// 存储所有创建的班级ID，用于清理
const createdClassIds: number[] = [];

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-bulk-import",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "test",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

// 在每个测试后清理数据
afterEach(async () => {
  const { ctx } = createAuthContext();
  const caller = appRouter.createCaller(ctx);

  for (const classId of createdClassIds) {
    try {
      await caller.classes.delete({ classId });
    } catch (error) {
      // 忽略删除失败的错误
    }
  }
  createdClassIds.length = 0;
});

describe("Students Bulk Import", () => {
  it("should bulk import students with auto-assigned card numbers", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a class first
    const classResult = await caller.classes.create({
      name: "Test Class for Bulk Import",
      description: "Testing bulk import functionality",
    });
    const classId = classResult.classId;
    createdClassIds.push(classId);

    // Bulk import students
    const importResult = await caller.students.bulkImport({
      classId,
      students: [
        { name: "张三" },
        { name: "李四" },
        { name: "王五" },
      ],
    });

    expect(importResult.success).toBe(true);
    expect(importResult.imported).toBe(3);
    expect(importResult.students).toHaveLength(3);
    expect(importResult.students[0].cardNumber).toBe(1);
    expect(importResult.students[1].cardNumber).toBe(2);
    expect(importResult.students[2].cardNumber).toBe(3);
  });

  it("should bulk import students with specific card numbers", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const classResult = await caller.classes.create({
      name: "Test Class for Specific Card Numbers",
      description: "Testing specific card numbers",
    });
    const classId = classResult.classId;
    createdClassIds.push(classId);

    const importResult = await caller.students.bulkImport({
      classId,
      students: [
        { name: "张三", cardNumber: 5 },
        { name: "李四", cardNumber: 10 },
        { name: "王五", cardNumber: 15 },
      ],
    });

    expect(importResult.success).toBe(true);
    expect(importResult.imported).toBe(3);
    expect(importResult.students[0].cardNumber).toBe(5);
    expect(importResult.students[1].cardNumber).toBe(10);
    expect(importResult.students[2].cardNumber).toBe(15);
  });

  it("should reject duplicate card numbers", async () => {
    // 此测试检查是否正确处理重複的學生卡輯
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const classResult = await caller.classes.create({
      name: "Test Class for Duplicate Check",
      description: "Testing duplicate card number detection",
    });
    const classId = classResult.classId;
    createdClassIds.push(classId);

    await expect(
      caller.students.bulkImport({
        classId,
        students: [
          { name: "\u5f20\u4e09", cardNumber: 5 },
          { name: "\u674e\u56db", cardNumber: 5 }, // Duplicate
        ],
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "该班级已使用此答题卡号",
    });
  });

  it("should reject invalid card numbers", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const classResult = await caller.classes.create({
      name: "Test Class for Invalid Card Numbers",
      description: "Testing invalid card number detection",
    });
    const classId = classResult.classId;
    createdClassIds.push(classId);

    try {
      await caller.students.bulkImport({
        classId,
        students: [
          { name: "张三", cardNumber: 50 }, // Invalid: > 40
        ],
      });
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect((error as Error).message).toContain("Too big") || expect((error as Error).message).toContain("between 1 and 40");
    }
  });

  it("should mix auto-assigned and specific card numbers", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const classResult = await caller.classes.create({
      name: "Test Class for Mixed Card Numbers",
      description: "Testing mixed auto and specific card numbers",
    });
    const classId = classResult.classId;
    createdClassIds.push(classId);

    const importResult = await caller.students.bulkImport({
      classId,
      students: [
        { name: "张三", cardNumber: 5 },
        { name: "李四" }, // Auto-assigned: 1
        { name: "王五", cardNumber: 10 },
        { name: "赵六" }, // Auto-assigned: 2
      ],
    });

    expect(importResult.imported).toBe(4);
    expect(importResult.students[0].cardNumber).toBe(5);
    expect(importResult.students[1].cardNumber).toBe(1);
    expect(importResult.students[2].cardNumber).toBe(10);
    expect(importResult.students[3].cardNumber).toBe(2);
  });
});
