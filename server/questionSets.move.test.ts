import { describe, it, expect } from "vitest";
import * as db from "./db";
import { eq } from "drizzle-orm";
import { users, questionSets, questionFolders } from "../drizzle/schema";
import { createTestUser } from "./testHelpers";

describe("Question Sets Move Functionality", () => {
  it("should move a question set to a folder", async () => {
    const { database, userId } = await createTestUser();

    // 创建文件夹
    const folderId = await db.createQuestionFolder({
      teacherId: userId,
      name: "Test Folder",
      description: "Test folder for moving sets",
      parentFolderId: null,
    });

    // 创建题集
    const setId = await db.createQuestionSet({
      teacherId: userId,
      title: "Test Set",
      description: "Test set for moving",
      folderId: null,
    });

    // 验证题集初始状态（folderId为null）
    let set = await db.getQuestionSetById(setId);
    expect(set?.folderId).toBeNull();

    // 移动题集到文件夹
    await db.updateQuestionSet(setId, { folderId: folderId });

    // 验证题集已移动
    set = await db.getQuestionSetById(setId);
    expect(set?.folderId).toBe(folderId);

    // 清理
    await database.delete(questionSets).where(eq(questionSets.id, setId));
    await database.delete(questionFolders).where(eq(questionFolders.id, folderId));
    await database.delete(users).where(eq(users.id, userId));
  });

  it("should move a question set back to root", async () => {
    const { database, userId } = await createTestUser();

    // 创建文件夹
    const folderId = await db.createQuestionFolder({
      teacherId: userId,
      name: "Test Folder 2",
      description: "Test folder",
      parentFolderId: null,
    });

    // 创建题集并放在文件夹中
    const setId = await db.createQuestionSet({
      teacherId: userId,
      title: "Test Set 2",
      description: "Test set",
      folderId: folderId,
    });

    // 验证题集在文件夹中
    let setData = await db.getQuestionSetById(setId);
    expect(setData?.folderId).toBe(folderId);

    // 移动题集回根目录
    await db.updateQuestionSet(setId, { folderId: null });

    // 验证题集已回到根目录
    setData = await db.getQuestionSetById(setId);
    expect(setData?.folderId).toBeNull();

    // 清理
    await database.delete(questionSets).where(eq(questionSets.id, setId));
    await database.delete(questionFolders).where(eq(questionFolders.id, folderId));
    await database.delete(users).where(eq(users.id, userId));
  });

  it("should retrieve question sets by folder", async () => {
    const { database, userId } = await createTestUser();

    // 创建文件夹
    const folderId = await db.createQuestionFolder({
      teacherId: userId,
      name: "Test Folder 3",
      description: "Test folder",
      parentFolderId: null,
    });

    // 创建多个题集
    const set1Id = await db.createQuestionSet({
      teacherId: userId,
      title: "Set in Folder 1",
      description: "Set 1",
      folderId: folderId,
    });

    const set2Id = await db.createQuestionSet({
      teacherId: userId,
      title: "Set in Folder 2",
      description: "Set 2",
      folderId: folderId,
    });

    // 获取文件夹中的题集
    const setsInFolder = await db.getQuestionSetsByFolder(userId, folderId);

    // 验证返回的题集数量和内容
    expect(setsInFolder.length).toBeGreaterThanOrEqual(2);
    const titles = setsInFolder.map(s => s.title);
    expect(titles).toContain("Set in Folder 1");
    expect(titles).toContain("Set in Folder 2");

    // 清理
    await database.delete(questionSets).where(eq(questionSets.id, set1Id));
    await database.delete(questionSets).where(eq(questionSets.id, set2Id));
    await database.delete(questionFolders).where(eq(questionFolders.id, folderId));
    await database.delete(users).where(eq(users.id, userId));
  });

  it("should retrieve root level question sets", async () => {
    const { database, userId } = await createTestUser();

    // 创建根目录下的题集
    const set1Id = await db.createQuestionSet({
      teacherId: userId,
      title: "Root Set 1",
      description: "Root set 1",
      folderId: null,
    });

    const set2Id = await db.createQuestionSet({
      teacherId: userId,
      title: "Root Set 2",
      description: "Root set 2",
      folderId: null,
    });

    // 获取根目录下的题集
    const rootSets = await db.getQuestionSetsByFolder(userId, null);

    // 验证返回的题集
    expect(rootSets.length).toBeGreaterThanOrEqual(2);
    const titles = rootSets.map(s => s.title);
    expect(titles).toContain("Root Set 1");
    expect(titles).toContain("Root Set 2");

    // 清理
    await database.delete(questionSets).where(eq(questionSets.id, set1Id));
    await database.delete(questionSets).where(eq(questionSets.id, set2Id));
    await database.delete(users).where(eq(users.id, userId));
  });
});
