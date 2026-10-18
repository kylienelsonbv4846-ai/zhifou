# 测试运行说明

## 前置条件

- Node.js 与 pnpm（版本要求见 `package.json`）
- 自建 MySQL 或 MariaDB
- 一个**专用、可丢弃的测试数据库**

集成测试会创建和删除用户、班级、题集、会话等数据。**不要将生产数据库的 `DATABASE_URL` 用于测试**。

## 初始化测试数据库

在 MySQL/MariaDB 中创建专用数据库和只授予该库权限的测试用户：

```sql
CREATE DATABASE classroom_clicker_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'classroom_test'@'127.0.0.1' IDENTIFIED BY 'replace-with-test-only-password';
GRANT ALL PRIVILEGES ON classroom_clicker_test.* TO 'classroom_test'@'127.0.0.1';
```

将提交的 migration baseline 应用到**空的测试库**：

```bash
export DATABASE_URL='mysql://classroom_test:replace-with-test-only-password@127.0.0.1:3306/classroom_clicker_test'
pnpm db:migrate
```

## 运行检查

```bash
pnpm check
pnpm test
pnpm build
```

默认测试套件不需要腾讯云 SES 凭证，也不会发送真实邮件；SES 请求由 mock `fetch` 覆盖。需要验证真实邮件投递时，应在隔离的测试/预发布账号中单独执行手动 smoke test。

生产部署仍使用 `DATABASE_URL` 连接自建 MySQL/MariaDB，文件通过 `FILE_STORAGE_DIR` 写入本地持久化卷；部署时需保证运行用户有读写权限，并将 MySQL 数据库和该目录纳入同一备份/恢复流程。
