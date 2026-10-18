import { describe, expect, it, afterEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// 存储所有创建的班级ID，用于清理
const createdClassIds: number[] = [];

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-teacher",
    email: "teacher@example.com",
    name: "Test Teacher",
    loginMethod: "local",
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
    res: {} as TrpcContext["res"],
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

describe("Classes Management", () => {
  it("should create a class", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.classes.create({
      name: "Test Class 1",
      description: "This is a test class",
    });

    createdClassIds.push(result.classId);

    expect(result).toHaveProperty("classId");
    expect(typeof result.classId).toBe("number");
  });

  it("should list classes for teacher", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a class first
    const { classId } = await caller.classes.create({
      name: "Test Class 2",
      description: "Another test class",
    });
    createdClassIds.push(classId);

    const classes = await caller.classes.list();

    expect(Array.isArray(classes)).toBe(true);
    expect(classes.length).toBeGreaterThan(0);
  });

  it("should get class by id", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a class
    const { classId } = await caller.classes.create({
      name: "Test Class 3",
      description: "Class for get test",
    });
    createdClassIds.push(classId);

    const classInfo = await caller.classes.get({ classId });

    expect(classInfo).toBeDefined();
    expect(classInfo?.name).toBe("Test Class 3");
    expect(classInfo?.description).toBe("Class for get test");
  });

  it("should update class", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a class
    const { classId } = await caller.classes.create({
      name: "Test Class 4",
      description: "Original description",
    });
    createdClassIds.push(classId);

    // Update the class
    await caller.classes.update({
      classId,
      name: "Updated Class 4",
      description: "Updated description",
    });

    const updatedClass = await caller.classes.get({ classId });

    expect(updatedClass?.name).toBe("Updated Class 4");
    expect(updatedClass?.description).toBe("Updated description");
  });

  it("should delete class", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a class
    const { classId } = await caller.classes.create({
      name: "Test Class to Delete",
      description: "This class will be deleted",
    });

    // Delete the class
    const result = await caller.classes.delete({ classId });

    expect(result.success).toBe(true);

    // Verify deletion
    await expect(caller.classes.get({ classId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("Students Management", () => {
  it("should create a student with auto-assigned card number", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a class first
    const { classId } = await caller.classes.create({
      name: "Test Class for Students",
      description: "Class for student tests",
    });
    createdClassIds.push(classId);

    // Create a student
    const result = await caller.students.create({
      classId,
      name: "Test Student 1",
    });

    expect(result).toHaveProperty("studentId");
    expect(result).toHaveProperty("cardNumber");
    expect(result.cardNumber).toBeGreaterThanOrEqual(1);
    expect(result.cardNumber).toBeLessThanOrEqual(40);
  });

  it("should create a student with specific card number", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a class
    const { classId } = await caller.classes.create({
      name: "Test Class for Card Numbers",
      description: "Testing specific card numbers",
    });
    createdClassIds.push(classId);

    // Create a student with card number 5
    const result = await caller.students.create({
      classId,
      name: "Test Student with Card 5",
      cardNumber: 5,
    });

    expect(result.cardNumber).toBe(5);
  });

  it("should list students in a class", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a class
    const { classId } = await caller.classes.create({
      name: "Test Class for Student List",
      description: "Testing student listing",
    });
    createdClassIds.push(classId);

    // Create multiple students
    await caller.students.create({
      classId,
      name: "Student 1",
      cardNumber: 1,
    });

    await caller.students.create({
      classId,
      name: "Student 2",
      cardNumber: 2,
    });

    const students = await caller.students.list({ classId });

    expect(Array.isArray(students)).toBe(true);
    expect(students.length).toBe(2);
    expect(students[0]?.cardNumber).toBe(1);
    expect(students[1]?.cardNumber).toBe(2);
  });

  it("should update student information", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a class
    const { classId } = await caller.classes.create({
      name: "Test Class for Update",
      description: "Testing student update",
    });
    createdClassIds.push(classId);

    // Create a student
    const { studentId } = await caller.students.create({
      classId,
      name: "Original Name",
      cardNumber: 10,
    });

    // Update the student
    await caller.students.update({
      studentId,
      name: "Updated Name",
      cardNumber: 15,
    });

    const students = await caller.students.list({ classId });
    const updatedStudent = students.find((s) => s.id === studentId);

    expect(updatedStudent?.name).toBe("Updated Name");
    expect(updatedStudent?.cardNumber).toBe(15);
  });

  it("should delete student", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a class
    const { classId } = await caller.classes.create({
      name: "Test Class for Delete",
      description: "Testing student deletion",
    });
    createdClassIds.push(classId);

    // Create a student
    const { studentId } = await caller.students.create({
      classId,
      name: "Student to Delete",
      cardNumber: 20,
    });

    // Delete the student
    const result = await caller.students.delete({ studentId });

    expect(result.success).toBe(true);

    // Verify deletion
    const students = await caller.students.list({ classId });
    const deletedStudent = students.find((s) => s.id === studentId);
    expect(deletedStudent).toBeUndefined();
  });

  it("should get next available card number", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a class
    const { classId } = await caller.classes.create({
      name: "Test Class for Card Number",
      description: "Testing next card number",
    });
    createdClassIds.push(classId);

    // Create students with card numbers 1, 2, 3
    await caller.students.create({ classId, name: "Student 1", cardNumber: 1 });
    await caller.students.create({ classId, name: "Student 2", cardNumber: 2 });
    await caller.students.create({ classId, name: "Student 3", cardNumber: 3 });

    // Get next available card number
    const nextNumber = await caller.students.getNextCardNumber({ classId });

    expect(nextNumber).toBe(4);
  });
});
