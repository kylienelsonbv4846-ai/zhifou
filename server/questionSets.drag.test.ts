import { describe, it, expect } from "vitest";
import * as db from "./db";
import { eq } from "drizzle-orm";
import { users, questionSets, questionFolders } from "../drizzle/schema";
import { createTestUser } from "./testHelpers";

describe("Question Sets Drag and Drop Functionality", () => {
  it("should move a question set to a folder via drag and drop", async () => {
    const { database, userId } = await createTestUser();

    // 创建文件夹
    const folderId = await db.createQuestionFolder({
      teacherId: userId,
      name: "Test Folder",
      description: "Test",
      parentFolderId: null,
    });

    // 创建题集（初始在根目录）
    const setId = await db.createQuestionSet({
      teacherId: userId,
      title: "Test Set",
      description: "Test",
      folderId: null,
    });

    // 验证题集初始在根目录
    let sets = await db.getQuestionSetsByTeacher(userId);
    let testSet = sets.find(s => s.id === setId);
    expect(testSet?.folderId).toBeNull();

    // 模拟拖拽操作：移动题集到文件夹
    await database.update(questionSets).set({ folderId }).where(eq(questionSets.id, setId));

    // 验证题集已移动到文件夹
    sets = await db.getQuestionSetsByTeacher(userId);
    testSet = sets.find(s => s.id === setId);
    expect(testSet?.folderId).toBe(folderId);

    // 清理
    await database.delete(questionSets).where(eq(questionSets.id, setId));
    await database.delete(questionFolders).where(eq(questionFolders.id, folderId));
    await database.delete(users).where(eq(users.id, userId));
  });

  it("should move a question set from one folder to another", async () => {
    const { database, userId } = await createTestUser();

    // 创建两个文件夹
    const folder1Id = await db.createQuestionFolder({
      teacherId: userId,
      name: "Folder 1",
      description: "Test",
      parentFolderId: null,
    });

    const folder2Id = await db.createQuestionFolder({
      teacherId: userId,
      name: "Folder 2",
      description: "Test",
      parentFolderId: null,
    });

    // 创建题集在文件夹1中
    const setId = await db.createQuestionSet({
      teacherId: userId,
      title: "Test Set",
      description: "Test",
      folderId: folder1Id,
    });

    // 验证题集在文件夹1中
    let sets = await db.getQuestionSetsByFolder(userId, folder1Id);
    expect(sets.some(s => s.id === setId)).toBe(true);

    // 模拟拖拽操作：移动题集到文件夹2
    await database.update(questionSets).set({ folderId: folder2Id }).where(eq(questionSets.id, setId));

    // 验证题集已移动到文件夹2
    sets = await db.getQuestionSetsByFolder(userId, folder2Id);
    expect(sets.some(s => s.id === setId)).toBe(true);

    // 验证题集不在文件夹1中
    sets = await db.getQuestionSetsByFolder(userId, folder1Id);
    expect(sets.some(s => s.id === setId)).toBe(false);

    // 清理
    await database.delete(questionSets).where(eq(questionSets.id, setId));
    await database.delete(questionFolders).where(eq(questionFolders.id, folder1Id));
    await database.delete(questionFolders).where(eq(questionFolders.id, folder2Id));
    await database.delete(users).where(eq(users.id, userId));
  });

  it("should move a folder to another folder", async () => {
    const { database, userId } = await createTestUser();

    // 创建两个文件夹
    const folder1Id = await db.createQuestionFolder({
      teacherId: userId,
      name: "Folder 1",
      description: "Test",
      parentFolderId: null,
    });

    const folder2Id = await db.createQuestionFolder({
      teacherId: userId,
      name: "Folder 2",
      description: "Test",
      parentFolderId: null,
    });

    // 验证folder2初始在根目录
    let folder = await database.select().from(questionFolders).where(eq(questionFolders.id, folder2Id)).limit(1);
    expect(folder[0].parentFolderId).toBeNull();

    // 模拟拖拽操作：移动folder2到folder1中
    await database.update(questionFolders).set({ parentFolderId: folder1Id }).where(eq(questionFolders.id, folder2Id));

    // 验证folder2已移动到folder1中
    folder = await database.select().from(questionFolders).where(eq(questionFolders.id, folder2Id)).limit(1);
    expect(folder[0].parentFolderId).toBe(folder1Id);

    // 清理
    await database.delete(questionFolders).where(eq(questionFolders.id, folder2Id));
    await database.delete(questionFolders).where(eq(questionFolders.id, folder1Id));
    await database.delete(users).where(eq(users.id, userId));
  });
});
