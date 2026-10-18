import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";
import { InsertQuestionSet, InsertQuestionFolder } from "../drizzle/schema";

describe("Question Sets - Folder ID", () => {
  let testTeacherId: number;
  let folderId: number;

  beforeAll(async () => {
    testTeacherId = Math.floor(Math.random() * 1000000);
  });

  it("should create a question set with folderId as null (root directory)", async () => {
    const setData: InsertQuestionSet = {
      teacherId: testTeacherId,
      title: "Root Question Set",
      description: "A question set in root",
      folderId: null,
    };

    const setId = await db.createQuestionSet(setData);
    expect(setId).toBeGreaterThan(0);

    const set = await db.getQuestionSetById(setId);
    expect(set?.folderId).toBeNull();
  });

  it("should create a question set in a specific folder", async () => {
    // 先创建一个文件夹
    const folderData: InsertQuestionFolder = {
      teacherId: testTeacherId,
      name: "Test Folder",
      description: "A test folder for question sets",
      parentFolderId: null,
    };

    folderId = await db.createQuestionFolder(folderData);
    expect(folderId).toBeGreaterThan(0);

    // 在文件夹中创建题目集
    const setData: InsertQuestionSet = {
      teacherId: testTeacherId,
      title: "Question Set in Folder",
      description: "A question set inside a folder",
      folderId: folderId,
    };

    const setId = await db.createQuestionSet(setData);
    expect(setId).toBeGreaterThan(0);

    const set = await db.getQuestionSetById(setId);
    expect(set?.folderId).toBe(folderId);
    expect(set?.title).toBe("Question Set in Folder");
  });

  it("should create multiple question sets in the same folder", async () => {
    const setData1: InsertQuestionSet = {
      teacherId: testTeacherId,
      title: "Question Set 1 in Folder",
      description: "First question set",
      folderId: folderId,
    };

    const setData2: InsertQuestionSet = {
      teacherId: testTeacherId,
      title: "Question Set 2 in Folder",
      description: "Second question set",
      folderId: folderId,
    };

    const setId1 = await db.createQuestionSet(setData1);
    const setId2 = await db.createQuestionSet(setData2);

    expect(setId1).toBeGreaterThan(0);
    expect(setId2).toBeGreaterThan(0);

    const set1 = await db.getQuestionSetById(setId1);
    const set2 = await db.getQuestionSetById(setId2);

    expect(set1?.folderId).toBe(folderId);
    expect(set2?.folderId).toBe(folderId);
  });

  it("should create question sets in different folders", async () => {
    // 创建第二个文件夹
    const folderData2: InsertQuestionFolder = {
      teacherId: testTeacherId,
      name: "Test Folder 2",
      description: "Another test folder",
      parentFolderId: null,
    };

    const folderId2 = await db.createQuestionFolder(folderData2);
    expect(folderId2).toBeGreaterThan(0);

    // 在第一个文件夹中创建题目集
    const setData1: InsertQuestionSet = {
      teacherId: testTeacherId,
      title: "Question Set in Folder 1",
      description: "In folder 1",
      folderId: folderId,
    };

    // 在第二个文件夹中创建题目集
    const setData2: InsertQuestionSet = {
      teacherId: testTeacherId,
      title: "Question Set in Folder 2",
      description: "In folder 2",
      folderId: folderId2,
    };

    const setId1 = await db.createQuestionSet(setData1);
    const setId2 = await db.createQuestionSet(setData2);

    const set1 = await db.getQuestionSetById(setId1);
    const set2 = await db.getQuestionSetById(setId2);

    expect(set1?.folderId).toBe(folderId);
    expect(set2?.folderId).toBe(folderId2);
  });
});
