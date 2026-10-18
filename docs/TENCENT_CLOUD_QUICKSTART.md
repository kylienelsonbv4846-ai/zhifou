# 腾讯云快速开始（历史归档）

> **本页只保留导航，不可按历史步骤执行。** 旧命令没有明确代码来源和当前必需参数，已被替代。

请先阅读[《腾讯云服务器部署与运维指南》](TENCENT_CLOUD_SERVER_DEPLOYMENT.md)，并仅使用维护中的[`scripts/deploy-tencent-cloud.sh`](../scripts/deploy-tencent-cloud.sh)。安装时必须显式传入由项目所有者选定且腾讯云服务器可访问的代码仓库（`--repo` 或 `APP_REPO_URL`）；脚本不会猜测仓库，也不会回退到历史 GitHub 源仓库。

新空库只能按已提交的 Drizzle migration chain 初始化。对于已存在但没有匹配 migration journal 的数据库，先备份并按权威指南人工审查；不要运行旧版 `db:push` / `drizzle-kit push`。

> 当前任务只创建 ClassClicker 测试站，不执行腾讯云迁移。用户另行通知后，再开始实际服务器迁移。
