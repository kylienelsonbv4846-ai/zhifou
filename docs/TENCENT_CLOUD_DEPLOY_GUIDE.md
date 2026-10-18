# 腾讯云部署完整指南（历史归档）

> **本文件仅供历史追溯，不可按其中的步骤部署。** 它包含旧 Node 版本、占位仓库地址、已废弃的路径/别名脚本和过时数据库初始化命令；不要复制其中的脚本、`db:push` 或 `drizzle-kit push` 命令。

当前唯一权威的自托管操作流程是[《腾讯云服务器部署与运维指南》](TENCENT_CLOUD_SERVER_DEPLOYMENT.md)，唯一维护中的安装脚本是[`scripts/deploy-tencent-cloud.sh`](../scripts/deploy-tencent-cloud.sh)。当前脚本需要显式指定用户选定且服务器可访问的可信代码仓库（`--repo` 或 `APP_REPO_URL`），并仅对新建的空数据库自动应用已提交的 Drizzle migration chain。已有数据库若没有匹配的迁移记录，必须先备份并人工核对，不能直接应用空库基线。

此次只负责 ClassClicker 测试站；腾讯云服务器部署/迁移需等待用户另行通知。
