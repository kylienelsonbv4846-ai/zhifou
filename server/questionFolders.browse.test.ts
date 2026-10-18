import { describe, it, expect } from "vitest";
import * as db from "./db";
import { eq } from "drizzle-orm";
import { users, questionSets, questionFolders } from "../drizzle/schema";
import { createTestUser } from "./testHelpers";

describe("Question Folders Browse Functionality", () => {
  it("should navigate into a folder and retrieve its contents", async () => {
    const { database, userId } = await createTestUser();

    // 创建根目录下的文件夹
    const rootFolderId = await db.createQuestionFolder({
      teacherId: userId,
      name: "Root Folder",
      description: "Root level folder",
      parentFolderId: null,
    });

    // 创建根目录下的题集
    const rootSetId = await db.createQuestionSet({
      teacherId: userId,
      title: "Root Set",
      description: "Set in root",
      folderId: null,
    });

    // 创建文件夹内的题集
    const folderSetId = await db.createQuestionSet({
      teacherId: userId,
      title: "Folder Set",
      description: "Set in folder",
      folderId: rootFolderId,
    });

    // 获取根目录下的题集
    const rootSets = await db.getQuestionSetsByFolder(userId, null);
    expect(rootSets.some(s => s.id === rootSetId)).toBe(true);
    // 文件夹内的题集不应该出现在根目录列表中
    const folderSetInRoot = rootSets.find(s => s.id === folderSetId);
    if (folderSetInRoot) {
      console.log("Warning: folderSetId found in rootSets", folderSetInRoot);
    }
    expect(rootSets.some(s => s.id === folderSetId)).toBe(false);

    // 获取文件夹内的题集
    const folderSets = await db.getQuestionSetsByFolder(userId, rootFolderId);
    expect(folderSets.some(s => s.id === folderSetId)).toBe(true);
    // 根目录的题集不应该出现在文件夹列表中
    const rootSetInFolder = folderSets.find(s => s.id === rootSetId);
    if (rootSetInFolder) {
      console.log("Warning: rootSetId found in folderSets", rootSetInFolder);
    }
    expect(folderSets.some(s => s.id === rootSetId)).toBe(false);

    // 清理
    try {
      await database.delete(questionSets).where(eq(questionSets.id, rootSetId));
      await database.delete(questionSets).where(eq(questionSets.id, folderSetId));
      await database.delete(questionFolders).where(eq(questionFolders.id, rootFolderId));
      await database.delete(users).where(eq(users.id, userId));
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  });

  it("should support nested folders", async () => {
    const { database, userId } = await createTestUser();

    // 创建一级文件夹
    const level1FolderId = await db.createQuestionFolder({
      teacherId: userId,
      name: "Level 1",
      description: "Level 1 folder",
      parentFolderId: null,
    });

    // 创建二级文件夹
    const level2FolderId = await db.createQuestionFolder({
      teacherId: userId,
      name: "Level 2",
      description: "Level 2 folder",
      parentFolderId: level1FolderId,
    });

    // 验证一级文件夹中只有二级文件夹，没有其他文件夹
    const database_instance = await db.getDb();
    if (!database_instance) throw new Error("Database not available");

    const level1Folders = await database_instance
      .select()
      .from(questionFolders)
      .where(eq(questionFolders.parentFolderId, level1FolderId));

    expect(level1Folders.length).toBeGreaterThanOrEqual(1);
    expect(level1Folders.some(f => f.id === level2FolderId)).toBe(true);

    // 清理
    await database_instance.delete(questionFolders).where(eq(questionFolders.id, level2FolderId));
    await database_instance.delete(questionFolders).where(eq(questionFolders.id, level1FolderId));
    await database_instance.delete(users).where(eq(users.id, userId));
  });

  it("should retrieve only direct child folders", async () => {
    const { database, userId } = await createTestUser();

    // 创建一级文件夹
    const level1FolderId = await db.createQuestionFolder({
      teacherId: userId,
      name: "Level 1",
      description: "Level 1 folder",
      parentFolderId: null,
    });

    // 创建二级文件夹
    const level2FolderId = await db.createQuestionFolder({
      teacherId: userId,
      name: "Level 2",
      description: "Level 2 folder",
      parentFolderId: level1FolderId,
    });

    // 创建三级文件夹
    const level3FolderId = await db.createQuestionFolder({
      teacherId: userId,
      name: "Level 3",
      description: "Level 3 folder",
      parentFolderId: level2FolderId,
    });

    // 获取一级文件夹的直接子文件夹
    const level1Children = await database
      .select()
      .from(questionFolders)
      .where(eq(questionFolders.parentFolderId, level1FolderId));

    expect(level1Children.length).toBeGreaterThanOrEqual(1);
    expect(level1Children.some(f => f.id === level2FolderId)).toBe(true);
    expect(level1Children.some(f => f.id === level3FolderId)).toBe(false);

    // 清理
    await database.delete(questionFolders).where(eq(questionFolders.id, level3FolderId));
    await database.delete(questionFolders).where(eq(questionFolders.id, level2FolderId));
    await database.delete(questionFolders).where(eq(questionFolders.id, level1FolderId));
    await database.delete(users).where(eq(users.id, userId));
  });
});
