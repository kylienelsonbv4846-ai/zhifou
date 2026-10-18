import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";
import { InsertQuestionFolder } from "../drizzle/schema";

describe("Question Folders - Parent Folder ID", () => {
  let testTeacherId: number;
  let parentFolderId: number;

  beforeAll(async () => {
    testTeacherId = Math.floor(Math.random() * 1000000);
  });

  it("should create a folder with parentFolderId as null (root directory)", async () => {
    const folderData: InsertQuestionFolder = {
      teacherId: testTeacherId,
      name: "Root Folder",
      description: "A folder in root",
      parentFolderId: null,
    };

    parentFolderId = await db.createQuestionFolder(folderData);
    expect(parentFolderId).toBeGreaterThan(0);

    const folder = await db.getQuestionFolderById(parentFolderId);
    expect(folder?.parentFolderId).toBeNull();
  });

  it("should create a subfolder with correct parentFolderId", async () => {
    const subfolderData: InsertQuestionFolder = {
      teacherId: testTeacherId,
      name: "Sub Folder",
      description: "A folder inside parent folder",
      parentFolderId: parentFolderId,
    };

    const subfolderId = await db.createQuestionFolder(subfolderData);
    expect(subfolderId).toBeGreaterThan(0);

    const subfolder = await db.getQuestionFolderById(subfolderId);
    expect(subfolder?.parentFolderId).toBe(parentFolderId);
    expect(subfolder?.name).toBe("Sub Folder");
  });

  it("should create multiple subfolders with same parentFolderId", async () => {
    const subfolder1Data: InsertQuestionFolder = {
      teacherId: testTeacherId,
      name: "Sub Folder 1",
      description: "First subfolder",
      parentFolderId: parentFolderId,
    };

    const subfolder2Data: InsertQuestionFolder = {
      teacherId: testTeacherId,
      name: "Sub Folder 2",
      description: "Second subfolder",
      parentFolderId: parentFolderId,
    };

    const subfolderId1 = await db.createQuestionFolder(subfolder1Data);
    const subfolderId2 = await db.createQuestionFolder(subfolder2Data);

    expect(subfolderId1).toBeGreaterThan(0);
    expect(subfolderId2).toBeGreaterThan(0);

    const folder1 = await db.getQuestionFolderById(subfolderId1);
    const folder2 = await db.getQuestionFolderById(subfolderId2);

    expect(folder1?.parentFolderId).toBe(parentFolderId);
    expect(folder2?.parentFolderId).toBe(parentFolderId);
  });

  it("should create nested folders (grandchild)", async () => {
    const subfolderData: InsertQuestionFolder = {
      teacherId: testTeacherId,
      name: "Sub Folder for Nesting",
      description: "A subfolder for testing nesting",
      parentFolderId: parentFolderId,
    };

    const subfolderId = await db.createQuestionFolder(subfolderData);

    const grandchildData: InsertQuestionFolder = {
      teacherId: testTeacherId,
      name: "Grandchild Folder",
      description: "A folder inside subfolder",
      parentFolderId: subfolderId,
    };

    const grandchildId = await db.createQuestionFolder(grandchildData);
    expect(grandchildId).toBeGreaterThan(0);

    const grandchild = await db.getQuestionFolderById(grandchildId);
    expect(grandchild?.parentFolderId).toBe(subfolderId);
  });
});
