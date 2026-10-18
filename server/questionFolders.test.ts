import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";
import { InsertQuestionFolder } from "../drizzle/schema";

describe("Question Folders", () => {
  let testTeacherId = 999;
  let folderId: number;
  let folderIdForDelete: number;

  beforeAll(async () => {
    // 使用一个测试用的教师ID
    testTeacherId = Math.floor(Math.random() * 1000000);
  });

  afterAll(async () => {
    // 清理测试数据
    const db_instance = await db.getDb();
    if (db_instance) {
      // 清理测试创建的文件夹
      try {
        // 这里可以添加清理逻辑
      } catch (error) {
        console.error("Cleanup error:", error);
      }
    }
  });

  it("should create a question folder", async () => {
    const folderData: InsertQuestionFolder = {
      teacherId: testTeacherId,
      name: "Test Folder",
      description: "A test folder",
    };

    folderId = await db.createQuestionFolder(folderData);
    expect(folderId).toBeGreaterThan(0);
  });

  it("should get a question folder by id", async () => {
    const folder = await db.getQuestionFolderById(folderId);
    expect(folder).toBeDefined();
    expect(folder?.name).toBe("Test Folder");
    expect(folder?.description).toBe("A test folder");
  });

  it("should get all folders by teacher", async () => {
    const folders = await db.getQuestionFoldersByTeacher(testTeacherId);
    expect(Array.isArray(folders)).toBe(true);
    expect(folders.length).toBeGreaterThan(0);
    expect(folders.some((f) => f.id === folderId)).toBe(true);
  });

  it("should update a question folder", async () => {
    await db.updateQuestionFolder(folderId, {
      name: "Updated Folder Name",
      description: "Updated description",
    });

    const folder = await db.getQuestionFolderById(folderId);
    expect(folder?.name).toBe("Updated Folder Name");
    expect(folder?.description).toBe("Updated description");
  });

  it("should create another folder for deletion test", async () => {
    const folderData: InsertQuestionFolder = {
      teacherId: testTeacherId,
      name: "Folder to Delete",
      description: "This folder will be deleted",
    };

    folderIdForDelete = await db.createQuestionFolder(folderData);
    expect(folderIdForDelete).toBeGreaterThan(0);
  });

  it("should delete a question folder", async () => {
    await db.deleteQuestionFolder(folderIdForDelete);

    const folder = await db.getQuestionFolderById(folderIdForDelete);
    expect(folder).toBeUndefined();
  });

  it("should move question sets to root when folder is deleted", async () => {
    // 创建一个新文件夹
    const folderData: InsertQuestionFolder = {
      teacherId: testTeacherId,
      name: "Folder with Sets",
      description: "Folder containing question sets",
    };

    const newFolderId = await db.createQuestionFolder(folderData);

    // 创建一个题集并将其放在文件夹中
    const setData = {
      teacherId: testTeacherId,
      folderId: newFolderId,
      title: "Test Set in Folder",
      description: "A test question set in a folder",
    };

    const setId = await db.createQuestionSet(setData);

    // 验证题集在文件夹中
    let set = await db.getQuestionSetById(setId);
    expect(set?.folderId).toBe(newFolderId);

    // 删除文件夹
    await db.deleteQuestionFolder(newFolderId);

    // 验证题集已移到根目录
    set = await db.getQuestionSetById(setId);
    expect(set?.folderId).toBeNull();
  });

  it("should list folders in descending order by creation time", async () => {
    // 创建两个文件夹
    const folder1Data: InsertQuestionFolder = {
      teacherId: testTeacherId,
      name: "Folder 1",
      description: "First folder",
    };

    const folder2Data: InsertQuestionFolder = {
      teacherId: testTeacherId,
      name: "Folder 2",
      description: "Second folder",
    };

    const folderId1 = await db.createQuestionFolder(folder1Data);
    
    // 添加一个小延迟以确保不同的创建时间
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    const folderId2 = await db.createQuestionFolder(folder2Data);

    const folders = await db.getQuestionFoldersByTeacher(testTeacherId);
    
    // 验证两个文件夹都被返回
    const folder1 = folders.find((f) => f.id === folderId1);
    const folder2 = folders.find((f) => f.id === folderId2);
    
    expect(folder1).toBeDefined();
    expect(folder2).toBeDefined();
    
    // 验证数据库返回的是按创建时间降序排列的
    expect(folders.length).toBeGreaterThanOrEqual(2);
    expect(folders[0].createdAt >= folders[1].createdAt).toBe(true);
  });
});
