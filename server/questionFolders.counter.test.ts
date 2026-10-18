import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";
import { InsertQuestionSet, InsertQuestionFolder } from "../drizzle/schema";

describe("Question Folders - Counter", () => {
  let testTeacherId: number;
  let rootFolderId: number;
  let subFolderId: number;

  beforeAll(async () => {
    testTeacherId = Math.floor(Math.random() * 1000000);
  });

  it("should count question sets in root directory", async () => {
    // 创建根目录中的题目集
    const setData1: InsertQuestionSet = {
      teacherId: testTeacherId,
      title: "Root Question Set 1",
      description: "First question set in root",
      folderId: null,
    };

    const setData2: InsertQuestionSet = {
      teacherId: testTeacherId,
      title: "Root Question Set 2",
      description: "Second question set in root",
      folderId: null,
    };

    await db.createQuestionSet(setData1);
    await db.createQuestionSet(setData2);

    const count = await db.countQuestionSetsInFolder(null);
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("should count question sets in a specific folder", async () => {
    // 创建一个文件夹
    const folderData: InsertQuestionFolder = {
      teacherId: testTeacherId,
      name: "Test Folder for Counter",
      description: "A test folder",
      parentFolderId: null,
    };

    rootFolderId = await db.createQuestionFolder(folderData);

    // 在文件夹中创建题目集
    const setData1: InsertQuestionSet = {
      teacherId: testTeacherId,
      title: "Question Set in Folder 1",
      description: "First set",
      folderId: rootFolderId,
    };

    const setData2: InsertQuestionSet = {
      teacherId: testTeacherId,
      title: "Question Set in Folder 2",
      description: "Second set",
      folderId: rootFolderId,
    };

    const setData3: InsertQuestionSet = {
      teacherId: testTeacherId,
      title: "Question Set in Folder 3",
      description: "Third set",
      folderId: rootFolderId,
    };

    await db.createQuestionSet(setData1);
    await db.createQuestionSet(setData2);
    await db.createQuestionSet(setData3);

    const count = await db.countQuestionSetsInFolder(rootFolderId);
    expect(count).toBe(3);
  });

  it("should count subfolders in a folder", async () => {
    // 在rootFolderId中创建子文件夹
    const subFolder1Data: InsertQuestionFolder = {
      teacherId: testTeacherId,
      name: "Sub Folder 1",
      description: "First subfolder",
      parentFolderId: rootFolderId,
    };

    const subFolder2Data: InsertQuestionFolder = {
      teacherId: testTeacherId,
      name: "Sub Folder 2",
      description: "Second subfolder",
      parentFolderId: rootFolderId,
    };

    subFolderId = await db.createQuestionFolder(subFolder1Data);
    await db.createQuestionFolder(subFolder2Data);

    const count = await db.countSubFoldersInFolder(rootFolderId);
    expect(count).toBe(2);
  });

  it("should return 0 for empty folder", async () => {
    // 创建一个空文件夹
    const emptyFolderData: InsertQuestionFolder = {
      teacherId: testTeacherId,
      name: "Empty Folder",
      description: "An empty folder",
      parentFolderId: null,
    };

    const emptyFolderId = await db.createQuestionFolder(emptyFolderData);

    const setCount = await db.countQuestionSetsInFolder(emptyFolderId);
    const folderCount = await db.countSubFoldersInFolder(emptyFolderId);

    expect(setCount).toBe(0);
    expect(folderCount).toBe(0);
  });

  it("should count nested subfolders correctly", async () => {
    // 在subFolderId中创建更深层的子文件夹
    const nestedFolderData: InsertQuestionFolder = {
      teacherId: testTeacherId,
      name: "Nested Folder",
      description: "A nested folder",
      parentFolderId: subFolderId,
    };

    await db.createQuestionFolder(nestedFolderData);

    const count = await db.countSubFoldersInFolder(subFolderId);
    expect(count).toBe(1);
  });
});
