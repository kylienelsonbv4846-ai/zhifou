# 腾讯云部署指南（历史归档）

> **本文件仅为历史快照，不可作为操作手册执行。** 其中 Node 版本、环境变量路径、数据库初始化方式和脚本命令均已过时；尤其不要按旧版文档运行 schema push 或覆盖已有数据库。

当前唯一权威的自托管流程请使用[《腾讯云服务器部署与运维指南》](TENCENT_CLOUD_SERVER_DEPLOYMENT.md)，并从项目中的[`scripts/deploy-tencent-cloud.sh`](../scripts/deploy-tencent-cloud.sh)查看安装脚本。新空库通过已提交的 Drizzle migration chain 初始化；已有数据库如果没有对应 migration journal，必须先备份并人工核对，不能直接套用空库基线。

部署脚本要求显式提供用户选定、服务器可访问的可信仓库（`--repo` 或 `APP_REPO_URL`），不会回退到历史 GitHub 源仓库。此次 ClassClicker 测试站不执行腾讯云迁移；只有用户另行通知后才开始实际迁移。
