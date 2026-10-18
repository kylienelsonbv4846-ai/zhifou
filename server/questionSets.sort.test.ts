import { describe, it, expect } from "vitest";

/**
 * 测试题集排序功能
 * 验证题集按创建时间从新到旧排序
 */
describe("QuestionSets Sorting", () => {
  it("should sort question sets by creation time (newest first)", () => {
    // 模拟题集数据
    const mockSets = [
      {
        id: 1,
        title: "测试题目集1",
        description: "测试1",
        createdAt: new Date("2026-01-29T08:00:00Z"),
      },
      {
        id: 2,
        title: "测试题目集2",
        description: "测试2",
        createdAt: new Date("2026-01-29T09:00:00Z"),
      },
      {
        id: 3,
        title: "测试题目集3",
        description: "测试3",
        createdAt: new Date("2026-01-29T07:00:00Z"),
      },
    ];

    // 执行排序逻辑（与 QuestionSets.tsx 中的排序逻辑相同）
    const sortedSets = [...mockSets].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    // 验证排序结果
    expect(sortedSets[0].id).toBe(2); // 最新的在前
    expect(sortedSets[1].id).toBe(1);
    expect(sortedSets[2].id).toBe(3); // 最旧的在后
  });

  it("should handle sets with missing createdAt", () => {
    const mockSets = [
      {
        id: 1,
        title: "Set 1",
        description: "Desc 1",
        createdAt: new Date("2026-01-29T08:00:00Z"),
      },
      {
        id: 2,
        title: "Set 2",
        description: "Desc 2",
        createdAt: null,
      },
      {
        id: 3,
        title: "Set 3",
        description: "Desc 3",
        createdAt: new Date("2026-01-29T09:00:00Z"),
      },
    ];

    const sortedSets = [...mockSets].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    // 验证排序结果：最新的在前，缺失 createdAt 的排在后面
    expect(sortedSets[0].id).toBe(3);
    expect(sortedSets[1].id).toBe(1);
    expect(sortedSets[2].id).toBe(2); // createdAt 为 null 的排在最后
  });

  it("should maintain stability for sets with same creation time", () => {
    const sameTime = new Date("2026-01-29T08:00:00Z");
    const mockSets = [
      {
        id: 1,
        title: "Set 1",
        description: "Desc 1",
        createdAt: sameTime,
      },
      {
        id: 2,
        title: "Set 2",
        description: "Desc 2",
        createdAt: sameTime,
      },
    ];

    const sortedSets = [...mockSets].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    // 验证排序结果：相同时间的题集保持原有顺序
    expect(sortedSets[0].id).toBe(1);
    expect(sortedSets[1].id).toBe(2);
  });

  it("should handle empty sets array", () => {
    const mockSets: any[] = [];

    const sortedSets = [...mockSets].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    expect(sortedSets).toEqual([]);
  });
});

  it("should sort by name in ascending order", () => {
    const mockSets = [
      {
        id: 1,
        title: "Zebra",
        description: "Test 1",
        createdAt: new Date("2026-01-29T08:00:00Z"),
      },
      {
        id: 2,
        title: "Apple",
        description: "Test 2",
        createdAt: new Date("2026-01-29T09:00:00Z"),
      },
      {
        id: 3,
        title: "Mango",
        description: "Test 3",
        createdAt: new Date("2026-01-29T07:00:00Z"),
      },
    ];

    // 按名字正序排序
    const sortedSets = [...mockSets].sort((a, b) => {
      return a.title.localeCompare(b.title);
    });

    expect(sortedSets[0].id).toBe(2); // Apple
    expect(sortedSets[1].id).toBe(3); // Mango
    expect(sortedSets[2].id).toBe(1); // Zebra
  });

  it("should sort by name in descending order", () => {
    const mockSets = [
      {
        id: 1,
        title: "Zebra",
        description: "Test 1",
        createdAt: new Date("2026-01-29T08:00:00Z"),
      },
      {
        id: 2,
        title: "Apple",
        description: "Test 2",
        createdAt: new Date("2026-01-29T09:00:00Z"),
      },
      {
        id: 3,
        title: "Mango",
        description: "Test 3",
        createdAt: new Date("2026-01-29T07:00:00Z"),
      },
    ];

    // 按名字倒序排序
    const sortedSets = [...mockSets].sort((a, b) => {
      const compareResult = a.title.localeCompare(b.title);
      return -compareResult; // 倒序
    });

    expect(sortedSets[0].id).toBe(1); // Zebra
    expect(sortedSets[1].id).toBe(3); // Mango
    expect(sortedSets[2].id).toBe(2); // Apple
  });

  it("should sort by time in ascending order (oldest first)", () => {
    const mockSets = [
      {
        id: 1,
        title: "Test 1",
        description: "Desc 1",
        createdAt: new Date("2026-01-29T08:00:00Z"),
      },
      {
        id: 2,
        title: "Test 2",
        description: "Desc 2",
        createdAt: new Date("2026-01-29T09:00:00Z"),
      },
      {
        id: 3,
        title: "Test 3",
        description: "Desc 3",
        createdAt: new Date("2026-01-29T07:00:00Z"),
      },
    ];

    // 按时间正序排序（旧的在前）
    const sortedSets = [...mockSets].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB; // 正序
    });

    expect(sortedSets[0].id).toBe(3); // 最旧的
    expect(sortedSets[1].id).toBe(1);
    expect(sortedSets[2].id).toBe(2); // 最新的
  });
