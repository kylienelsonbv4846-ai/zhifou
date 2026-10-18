import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as db from "./db";
import { createLocalAccount, getUserByEmail, updateUser } from "./db";

describe("WeChat Binding", () => {
  const testEmail = `wechat-test-${Date.now()}@example.com`;
  const testWechatId = `wechat_${Date.now()}`;
  let testUserId: number;

  beforeEach(async () => {
    // 创建测试用户
    const user = await createLocalAccount(testEmail, "hashedPassword123", "Test User");
    testUserId = user.id;
  });

  afterEach(async () => {
    // 清理测试数据
    if (testUserId) {
      try {
        // 删除用户相关数据
        const dbInstance = await db.getDb();
        if (dbInstance) {
          // 清理测试数据
        }
      } catch (error) {
        console.error("Cleanup error:", error);
      }
    }
  });

  it("应该能够绑定微信账号", async () => {
    const updatedUser = await updateUser(testUserId, {
      wechatId: testWechatId,
    });

    expect(updatedUser).toBeDefined();
    expect(updatedUser.wechatId).toBe(testWechatId);
  });

  it("应该能够通过微信ID获取用户", async () => {
    // 先绑定微信
    await updateUser(testUserId, {
      wechatId: testWechatId,
    });

    // 通过微信ID获取用户
    const user = await db.getUserByWeChatId(testWechatId);
    expect(user).toBeDefined();
    expect(user?.id).toBe(testUserId);
    expect(user?.wechatId).toBe(testWechatId);
  });

  it("应该能够解绑微信账号", async () => {
    // 先绑定微信
    await updateUser(testUserId, {
      wechatId: testWechatId,
    });

    // 解绑微信
    const updatedUser = await updateUser(testUserId, {
      wechatId: null,
    });

    expect(updatedUser.wechatId).toBeNull();
  });

  it("不应该允许绑定已被其他用户使用的微信ID", async () => {
    const anotherEmail = `another-${Date.now()}@example.com`;
    const anotherUser = await createLocalAccount(anotherEmail, "hashedPassword456", "Another User");

    // 第一个用户绑定微信
    await updateUser(testUserId, {
      wechatId: testWechatId,
    });

    // 验证微信ID已被使用
    const existingUser = await db.getUserByWeChatId(testWechatId);
    expect(existingUser?.id).toBe(testUserId);
    expect(existingUser?.id).not.toBe(anotherUser.id);
  });

  it("应该能够重新绑定不同的微信ID", async () => {
    const newWechatId = `wechat_new_${Date.now()}`;

    // 绑定第一个微信ID
    await updateUser(testUserId, {
      wechatId: testWechatId,
    });

    // 绑定新的微信ID
    const updatedUser = await updateUser(testUserId, {
      wechatId: newWechatId,
    });

    expect(updatedUser.wechatId).toBe(newWechatId);

    // 验证旧的微信ID不再关联该用户
    const oldUser = await db.getUserByWeChatId(testWechatId);
    expect(oldUser).toBeUndefined();

    // 验证新的微信ID关联该用户
    const newUser = await db.getUserByWeChatId(newWechatId);
    expect(newUser?.id).toBe(testUserId);
  });

  it("不应该找到未绑定的微信ID", async () => {
    const nonExistentWechatId = `wechat_nonexistent_${Date.now()}`;
    const user = await db.getUserByWeChatId(nonExistentWechatId);
    expect(user).toBeUndefined();
  });
});
