# ClassClicker 项目复盘报告

> **报告目的**：帮助长时间未查看项目后，快速恢复对产品目标、代码结构、数据库、已完成能力、当前缺口和下一步工作的整体认知。
>
> **检查基准**：2026-10-12 本地 `main` 工作树（包含独立认证与平台解耦改造）；基线 HEAD 为 `d1d3315`，本次改动尚未提交。
>
> **当前状态更正（2026-10-14）**：本报告是历史快照，不是当前部署手册；旧数据库同步步骤及迁移结论已过时。新空库使用 `pnpm db:migrate`；既有但没有迁移 journal 的数据库必须先审查。请以 [当前腾讯云运维指南](docs/TENCENT_CLOUD_SERVER_DEPLOYMENT.md) 和 [部署指南](DEPLOYMENT_GUIDE.md) 为准。

---

## 1. 项目一句话概括

**ClassClicker 是一个类似 Plickers 的课堂即时反馈系统**：教师在网页端管理班级、学生、题集和题目，创建课堂答题会话；学生使用实体答题卡作答，教师端或未来的 Android 扫描端识别卡片并提交答案，网页端实时展示答题统计、学生结果和会话报告。

当前仓库主要是**教师 Web 端**。Android 扫描应用已经完成需求文档，但尚未在这个仓库中开始实际开发。

---

## 2. 当前项目状态总览

| 项目 | 当前状态 | 说明 |
|---|---|---|
| Web 教师端 | **基本可用** | 本地登录、班级、题库、会话、报告等主体功能已实现 |
| 本地邮箱注册/登录 | **已实现** | 注册先验证邮箱，验证成功后才创建正式账户 |
| 外部 OAuth 登录 | **已移除** | 当前使用独立 JWT Cookie 会话和本地邮箱密码认证 |
| 微信/QQ/抖音绑定 | **部分实现** | 数据字段和部分绑定/解绑 API 已存在；社交登录未接入当前认证流程 |
| 实体答题卡 | **存在两套实现，需统一** | `answerCardGenerator.ts` 是 5×5 Plickers 风格；`globalAnswerCardGenerator.ts` 仍是 QR 风格 |
| 80 张答题卡预生成/本地文件 | **已实现过** | 路线图记录为 80/80 已生成并存储；部署后应核验元数据和本地文件目录 |
| Android 扫描端 | **未开始编码** | 需求文档已较完整，目标为 Kotlin + Jetpack Compose + OpenCV |
| 宝塔部署 | **有完整指南，尚未完成生产验证** | 需要在真实服务器执行部署并进行端到端测试 |
| 类型检查 | **通过** | `pnpm check` 退出码 0 |
| 生产构建 | **通过** | `pnpm build` 成功；存在前端 chunk 偏大的优化警告 |
| 定向回归测试 | **通过** | 认证/JWT、本地文件存储、答题卡和邮箱验证覆盖通过 |
| 全量测试 | **通过** | 27 个测试文件、227 项全部通过；使用隔离 MariaDB，SES 请求为离线 mock |

### 部署入口

运行域名由部署方配置；代码不再依赖平台专属预览域名。生产环境应使用自有域名和 HTTPS。

---

## 3. 产品核心流程

### 3.1 教师端主流程

```text
注册/登录
  ↓
创建班级 → 导入或维护学生 → 分配答题卡号
  ↓
创建题集 → 创建题目 → 配置正确答案和题目顺序
  ↓
从题集或班级发起课堂会话
  ↓
开始会话 → 切换当前题目 → 扫描/提交学生答案
  ↓
实时查看选项人数、正确率、学生答案
  ↓
结束会话 → 查看会话报告、学生报告、班级报告 → 导出 Excel
```

### 3.2 移动端目标流程

```text
Android 登录
  ↓
选择班级和题集，或从题集/班级发起会话
  ↓
与网站共享同一个 Session
  ↓
手机摄像头扫描多张答题卡
  ↓
OpenCV 识别卡号、方向和 A/B/C/D 答案
  ↓
提交后端 → Web 端同步显示结果
```

---

## 4. Web 端功能地图

### 4.1 页面与路由

主要页面集中在 `client/src/pages/`，入口在 `client/src/App.tsx`。

| 路由 | 页面 | 用途 |
|---|---|---|
| `/` | `Home.tsx` | 首页、产品入口 |
| `/register` | `Register.tsx` | 本地邮箱注册第一步 |
| `/login` | `Login.tsx` | 本地邮箱密码登录 |
| `/verify-email` | `VerifyEmail.tsx` | 输入验证码并完成注册 |
| `/verify-email-pending` | `VerifyEmailPending.tsx` | 等待邮箱验证提示 |
| `/forgot-password` | `ForgotPassword.tsx` | 发起密码重置 |
| `/reset-password` | `ResetPassword.tsx` | 设置新密码 |
| `/profile` | `UserProfile.tsx` | 用户资料和社交账号绑定 |
| `/dashboard` | `Dashboard.tsx` | 教师工作台 |
| `/classes` | `Classes.tsx` | 班级列表与管理 |
| `/classes/:id` | `ClassDetail.tsx` | 班级详情、学生管理 |
| `/question-sets` | `QuestionSets.tsx` | 题集、文件夹管理 |
| `/question-sets/:id` | `QuestionSetDetail.tsx` | 题目管理 |
| `/sessions` | `Sessions.tsx` | 会话列表 |
| `/sessions/start` | `SessionStart.tsx` | 创建会话 |
| `/sessions/:id/play` | `SessionPlay.tsx` | 课堂答题播放/控制页 |
| `/sessions/:id/now-playing` | `NowPlaying.tsx` | 当前题目展示 |
| `/:sessionId/answer/:studentId` | `StudentAnswer.tsx` | 学生答案入口/展示 |
| `/reports` | `Reports.tsx` | 会话/班级统计 |
| `/student-reports` | `StudentReports.tsx` | 学生维度报告和 Excel 导出 |
| `/download-cards` | `DownloadCards.tsx` | 下载答题卡 |

### 4.2 已实现的主要能力

- 班级创建、修改、删除和查询。
- 学生创建、修改、删除、批量导入。
- 学生卡号自动分配，当前范围为每个班级 1–40。
- 题集创建、修改、删除、排序。
- 题库文件夹：新建、嵌套、浏览、面包屑、移动、拖拽、计数器。
- 题目类型：单选、多选、判断题；支持题目和选项媒体 URL。
- 会话创建、开始、结束、当前题目切换。
- 学生答案提交、重复提交更新、正确性统计。
- 会话详情、题目导航、答题分布和学生答案详情。
- 学生报告和班级报告 Excel 导出。
- 中文文件名导出，使用 RFC 5987 `Content-Disposition` 编码。
- 前端界面中文化。
- 80 张预生成答题卡的列表、单张下载和批量 ZIP 下载设计。

---

## 5. 技术架构与运行方式

### 5.1 技术栈

- **前端**：React 19、Vite、Tailwind CSS 4、shadcn/Radix UI、wouter。
- **后端**：Node.js、Express 4、tRPC 11。
- **数据访问**：Drizzle ORM、MySQL/TiDB。
- **认证**：本地邮箱账户 + 独立 JWT Cookie 会话。
- **密码安全**：`bcryptjs`，salt rounds 为 12。
- **数据库**：自建 MySQL/MariaDB，由部署方管理数据库服务、凭据和备份。
- **文件存储**：服务器本地持久化目录 `FILE_STORAGE_DIR`，通过同源 `/api/storage/...` 提供文件；数据库和该目录应联合备份。
- **报表**：ExcelJS、xlsx。
- **图表**：Chart.js、Recharts。
- **邮件**：邮箱验证和密码重置通过腾讯云 SES HTTP API 直连发送；另保留未接入默认流程的 SendGrid helper。
- **构建**：Vite 构建前端，esbuild 打包后端。

### 5.2 常用命令

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 类型检查
pnpm check

# 全量测试
pnpm test

# 生产构建
pnpm build

# 应用已提交的迁移（新空库或已有迁移 journal 的数据库）
pnpm db:migrate

# 生产启动
pnpm start
```

### 5.3 关键目录

```text
client/src/pages/       页面
client/src/components/  可复用 UI 组件
client/src/contexts/    React Context（包括注册流程状态）
server/db.ts            数据库查询和写入封装
server/routers.ts       tRPC API 合约和业务入口
server/auth.ts          输入校验、密码哈希、密码验证、速率限制
server/_core/           Express、OAuth、邮件、环境、tRPC 基础设施
drizzle/schema.ts       数据库表结构
drizzle/*.sql           数据库迁移文件
server/answerCardGenerator.ts       5×5 Plickers 风格卡片生成器
server/globalAnswerCardGenerator.ts  QR 风格全局卡片生成器
server/*.test.ts        Vitest 测试
scripts/                答题卡生成和部署脚本
docs/                   OAuth、腾讯云等补充文档
```

> 当前仓库没有根目录 `README.md`，项目说明主要分散在 `APP_REQUIREMENTS.md`、`DEPLOYMENT_GUIDE.md`、`EMAIL_SERVICE_GUIDE.md`、`todo.md` 和 `docs/` 中。

---

## 6. 数据库模型重点

数据库定义在 `drizzle/schema.ts`，目前至少包含以下核心表：

### 6.1 认证相关

- `users`：统一用户表。
  - `openId`：OAuth 用户标识；本地账户使用虚拟值。
  - `email`、`passwordHash`、`loginMethod`。
  - `wechatId`、`qqId`、`douyinId`：社交账号标识。
  - `isEmailVerified`、`role`、登录时间字段。
- `localAccounts`：本地账户邮箱唯一性和本地账户追踪。
- `emailVerificationTokens`：链接式验证令牌。
- `emailVerificationCodes`：验证码式注册验证，带过期时间、使用状态和失败次数。
- `emailSendingRateLimits`：验证邮件发送频率限制。
- `passwordResetTokens`、`passwordResetCodes`：密码重置。

### 6.2 教学业务相关

- `classes`：教师的班级。
- `students`：班级学生以及 `cardNumber`。
- `questionFolders`：题库文件夹，支持 `parentFolderId` 嵌套。
- `questionSets`：题集，支持 `folderId`。
- `questions`：题目、题型、选项、正确答案、媒体 URL、顺序。
- `sessions`：课堂会话，关联教师、班级、题集和状态。
- `sessionQueue`：会话中的题目队列和当前题目标记。
- `answers`：学生在某一会话、某一题的答案和正确性。
- `answerCardsMetadata`：80 张预生成答题卡的卡号、本地相对路径、同源 URL 和生成时间；底层旧列名为 `s3Key`/`s3Url`，为兼容既有数据库而保留。

### 6.3 关键关系

```text
用户 1 ── N 班级
班级 1 ── N 学生
用户 1 ── N 题库文件夹
题库文件夹 1 ── N 题集
题集 1 ── N 题目
班级 + 题集 ── N 会话
会话 1 ── N 会话题目队列
会话 + 题目 + 学生 ── N 答案
```

> Schema 中部分字段以注释方式表达外键关系，但当前文件没有完整声明 Drizzle relations/数据库级外键约束。生产环境需要特别注意删除班级、题集或用户时的关联数据清理策略。

---

## 7. 认证系统重点

### 7.1 本地注册流程

当前设计是两步注册：

1. 用户提交邮箱、用户名、密码。
2. 后端校验输入，只生成并保存验证码，不创建正式用户。
3. 发送邮箱验证码。
4. 前端通过 `RegistrationContext` 暂存注册信息。
5. 用户输入验证码。
6. 验证成功后调用 `createLocalAccount()` 创建用户。
7. 创建本地账户时生成虚拟 `openId`：

```text
local_{email 的 SHA-256 哈希前 32 位}
```

这个虚拟 `openId` 解决了此前本地账户没有 `openId`、无法创建平台会话的问题。

### 7.2 密码规则

注册和重置密码要求：

- 最少 8 位，最多 128 位。
- 至少一个大写字母。
- 至少一个小写字母。
- 至少一个数字。
- 至少一个特殊字符：`!@#$%^&*`。
- 使用 bcrypt 哈希保存，代码中不保存明文密码。

前端同时使用 HTML5 原生验证，后端使用 Zod 再次校验，不能只依赖浏览器验证。

### 7.3 验证码安全控制

- 验证码有过期时间。
- 验证成功后标记为已使用。
- 无效、已使用、已过期、邮箱不匹配等失败路径都会累计尝试次数。
- 达到 5 次后锁定当前验证码。
- 邮件重发有频率限制。
- 未验证账户可以被同一邮箱的新注册流程覆盖；已验证账户不能被覆盖。

### 7.4 需要重新核实的认证问题

当前代码中 `auth.register` 在验证前不创建用户，因此 `resendVerificationEmail` 逻辑仍然按“已有未验证用户”处理某些场景。建议下一轮统一验证码式和令牌式验证流程，明确：

- 注册未完成时，重发验证码应该依据邮箱直接创建/更新临时验证码记录。
- 已存在未验证用户时，是否保留临时用户模型，还是完全不创建用户。
- 验证码、验证链接两套机制是否都需要保留。

---

## 8. tRPC API 功能分组

后端入口是 `server/routers.ts`，主要分组如下：

### 认证

- `auth.me`
- `auth.login`
- `auth.logout`
- `auth.register`
- `auth.verifyEmail`
- `auth.resendVerificationEmail`
- `auth.requestPasswordReset`
- `auth.resetPassword`
- 密码重置验证码相关接口
- 个人资料更新
- 微信、QQ、抖音绑定/解绑接口

### 教学业务

- `classes.*`
- `students.*`
- `questionFolders.*`
- `questionSets.*`
- `questions.*`
- `sessions.*`
- `answers.*`

### 答题卡

- `answerCards.list`
- `answerCards.get`
- `answerCards.isInitialized`
- `answerCards.downloadSingle`
- `answerCards.downloadAll`
- `globalAnswerCards.download`
- `system.generateAnswerCards`

### 权限现状

大多数管理接口使用 `protectedProcedure`；部分会话和统计读取接口目前是 `publicProcedure`，例如 `sessions.get`、`sessions.getQueue`、部分答案统计接口。若这些接口最终暴露在正式公网环境，建议逐个确认是否需要登录校验和教师/班级所有权校验。

---

## 9. 答题卡实现的关键差异与风险

这是当前最需要优先厘清的技术问题之一。

### 9.1 5×5 Plickers 风格实现

`server/answerCardGenerator.ts` 包含：

- 5×5 网格。
- 中心位置缺失。
- 四角和四个边中点作为方向识别位置。
- 其他位置使用卡号二进制编码。
- A/B/C/D 标签位于网格四周。
- 支持生成 1–80 号卡片。

这与 `APP_REQUIREMENTS.md` 中的需求一致。

### 9.2 QR 风格实现

`server/globalAnswerCardGenerator.ts` 仍然：

- 生成 QR Code：`card:{cardNumber}`。
- 生成角落方向标记。
- 绘制四个选项圆圈。
- 生成全局 PDF。

这不是 5×5 Plickers 网格格式。

### 9.3 结论

路线图记录“80 张 Plickers 风格卡片已生成并存储”，但当前代码存在两套生成器，且全局生成器仍是 QR 风格。部署或开始 Android OpenCV 识别前，必须先决定唯一标准：

1. 推荐统一为 `answerCardGenerator.ts` 的 5×5 格式；或
2. 如果实际线上已经打印/发放 QR 卡片，则 Android 端应按 QR 方案开发，并同步修改需求文档。

不要在卡片格式未统一前开始写识别算法，否则会导致打印卡、后端卡号解码和移动端识别三方不一致。

---

## 10. Android 扫描端计划

需求文档为 `APP_REQUIREMENTS.md`，技术目标：

- Android 8.0+。
- Kotlin + Jetpack Compose。
- OpenCV 图像处理。
- Retrofit + OkHttp 网络通信。
- Room 本地缓存。
- Coroutines 异步处理。
- 与网站共享 tRPC 后端。

### 10.1 三种核心 UI 状态

1. **题目显示**：显示题目、A/B/C/D 选项、人数和学生名单，可切换题目。
2. **扫描中**：全屏摄像头预览，在卡片位置显示绿色/红色结果点和学生姓名。
3. **扫描结束**：回到题目显示状态，保留当前统计。

### 10.2 目标性能

- 摄像头帧率 ≥ 30 FPS。
- 识别延迟 < 500ms。
- UI 响应 < 100ms。
- API 调用 < 2s。
- 内存占用目标 < 200MB。

### 10.3 Android 尚未完成的工作

- 创建 Android 工程。
- 登录和会话 Token 管理。
- 题集、班级列表。
- 两种会话创建方式。
- 摄像头权限和预览。
- OpenCV 预处理、方向识别、卡号解码、答案识别。
- tRPC 客户端或兼容 API 客户端。
- 答案提交和 Web/手机同步。
- 真机测试、性能测试和错误恢复。

---

## 11. 部署与生产化信息

部署指南为 `DEPLOYMENT_GUIDE.md`，目标是宝塔面板。

### 11.1 推荐生产结构

```text
用户浏览器
   ↓ HTTPS
Nginx（宝塔）
   ↓ 反向代理
Node.js / Express :3000（PM2）
   ↓
自建 MySQL/MariaDB
   ↓
服务器持久化卷（答题卡、上传文件）
```

### 11.2 宝塔部署步骤摘要

1. 安装 Nginx、MySQL、Node.js 18+。
2. 创建 `classroom_clicker` 数据库和专用用户。
3. 上传代码，不上传 `node_modules`。
4. `pnpm install`。
5. 创建生产 `.env`。
6. 新空库执行 `pnpm db:migrate`；既有无 journal 的数据库先按当前运维指南审查。
7. 执行 `pnpm build`。
8. 用 Nginx 反向代理到 3000 端口。
9. 使用 PM2 启动 `dist/index.js`。
10. 配置 HTTPS、数据库备份、日志和监控。

### 11.3 生产环境必须配置的变量

至少核对：

```env
DATABASE_URL=
CLASSCLICKER_SESSION_SECRET=
APP_BASE_URL=
NODE_ENV=production
PORT=3000
FILE_STORAGE_DIR=/var/lib/classroom-clicker/uploads
TENCENT_SECRET_ID=
TENCENT_SECRET_KEY=
TENCENT_SES_REGION=
SENDER_EMAIL=
```

如果使用腾讯云 SES 或 SendGrid，还需要对应的邮件环境变量，例如：

```env
TENCENT_SECRET_ID=
TENCENT_SECRET_KEY=
TENCENT_SES_REGION=
SENDER_EMAIL=
```

### 11.4 当前部署缺口

路线图明确标记以下事项尚未完成：

- 在宝塔真实环境完成部署。
- 验证生产环境全部功能。
- 配置数据库自动备份。
- 设置应用监控和告警。
- 验证实时会话在真实网络和多设备下的表现。
- 核对生产环境答题卡元数据与本地持久化目录文件是否完整。

---

## 12. 当前自动化验证结果

本次在恢复后的仓库中实际执行：

### 12.1 类型检查

```text
pnpm check
结果：通过，退出码 0
```

### 12.2 生产构建

```text
pnpm build
结果：通过
```

构建提示：前端生成的 JavaScript chunk 约 2.35 MB，超过 Vite 默认的 500 KB 警告阈值。当前不影响构建成功，但后续可以通过动态导入和代码分割优化首屏加载。

### 12.3 全量测试

2026-10-12 的完整套件在隔离 MariaDB 测试库上运行：27 个测试文件，230 项全部通过。腾讯云 SES API 由离线 `fetch` mock 覆盖，不需要真实密钥且不会实际投递。复现步骤见 `TESTING.md`。

之前记录的答题卡接口漂移、缺失数据库环境和时间戳同秒排序问题已修复；旧失败清单已不再适用。

---

## 13. 当前已知风险清单

### 高优先级

1. **答题卡格式不统一**：5×5 Plickers 生成器和 QR 全局生成器并存。
2. **生产部署尚未完成**：没有真实宝塔环境的端到端验证记录。
3. **本地存储部署风险**：生产环境必须配置持久化 `FILE_STORAGE_DIR`，设置 Node 运行用户权限，并定期联合备份数据库和文件目录。
4. **社交 OAuth 尚未完成**：数据库字段/绑定接口不等于 QQ、微信、抖音官方扫码登录已经可用。
5. **实时同步机制需确认**：当前更多是通过后端查询和页面刷新/失效实现；如果要做到 Android 与 Web 的真正实时推送，需要进一步确认轮询、WebSocket 或 SSE 方案。

### 中优先级

6. `server/routers.ts` 较大，后续应按功能拆分路由文件，降低维护成本。
7. 部分读取接口是 `publicProcedure`，需要逐个核对权限和数据越权风险。
8. 生产环境邮件服务仍需实测腾讯云 SES 配置、发件人验证状态和投递限制。
9. 前端 bundle 较大，可做代码分割和页面级懒加载。
10. 本报告编写时的多组历史 migration 分支已由当前 `drizzle/migrations/` 干净基线取代；新空库使用 `pnpm db:migrate`。旧库若没有迁移 journal，不能盲跑空库基线，须先备份并协调迁移历史。

### 低优先级

11. 根目录缺少一份面向开发者的 README，可把本报告或精简版作为项目入口文档。
12. `todo.md` 中有些历史事项仍保留“保存检查点并交付结果”等管理性条目，建议整理成真正的产品 backlog。

---

## 14. 建议的重新上手顺序

### 第 1 步：先统一答题卡标准

阅读并比较：

- `server/answerCardGenerator.ts`
- `server/globalAnswerCardGenerator.ts`
- `server/routers.ts` 中 `answerCards.*` 和 `globalAnswerCards.*`
- `DownloadCards.tsx`
- `APP_REQUIREMENTS.md` 的 Plickers 说明

最终确定线上唯一卡片格式，并删除或改造另一套生成逻辑。

### 第 2 步：修复测试与当前 API 的漂移

- 删除或重写 `server/answerCards.test.ts` 中对旧 API 的调用。
- 为 `answerCards.list/get/isInitialized/downloadSingle/downloadAll` 增加与当前行为一致的测试。
- 单独定位未验证账户重注册测试超时问题。
- 目标：再次达到全量测试通过。

### 第 3 步：验证本地 Web 主链路

建议按以下顺序手动验证：

1. 注册新邮箱。
2. 收取并输入验证码。
3. 使用邮箱密码登录。
4. 创建班级并添加学生。
5. 创建题集和题目。
6. 下载/打印确定格式的答题卡。
7. 创建会话、切题、提交答案。
8. 查看会话报告和 Excel 导出。

### 第 4 步：完成生产部署

- 按 `DEPLOYMENT_GUIDE.md` 部署到宝塔。
- 先完成自建 MySQL/MariaDB、HTTPS、PM2、Nginx、本地持久化文件目录与邮件配置。
- 生产环境跑数据库迁移和健康检查。
- 用两个浏览器或设备验证同一会话的数据一致性。
- 配置数据库自动备份和应用日志。

### 第 5 步：再启动 Android 开发

Android 开发前必须冻结：

- 卡片格式。
- 卡号与学生的绑定规则。
- 会话鉴权方式。
- 会话当前题目同步协议。
- 答案提交接口和重复提交规则。
- Web 与 Android 的实时刷新策略。

### 第 6 步：最后做官方社交登录

按 QQ、微信、抖音官方开放平台分别完成：

- 应用注册和回调域名。
- OAuth 授权流程。
- 账号绑定/解绑。
- 登录时的用户匹配与冲突处理。
- 生产环境密钥和安全审计。

---

## 15. 关键文件速查表

| 文件 | 作用 |
|---|---|
| `client/src/App.tsx` | Web 路由总入口 |
| `client/src/pages/Register.tsx` | 注册表单 |
| `client/src/pages/Login.tsx` | 登录表单 |
| `client/src/pages/VerifyEmail.tsx` | 邮箱验证码验证 |
| `client/src/pages/DownloadCards.tsx` | 答题卡下载 |
| `client/src/pages/SessionPlay.tsx` | 会话答题界面 |
| `client/src/pages/Reports.tsx` | 报告与统计 |
| `client/src/pages/StudentReports.tsx` | 学生报告和 Excel 导出 |
| `server/auth.ts` | 密码规则、bcrypt、输入校验 |
| `server/db.ts` | 数据库函数和本地账户创建 |
| `server/routers.ts` | tRPC API 和业务流程 |
| `drizzle/schema.ts` | 数据库表定义 |
| `server/answerCardGenerator.ts` | 5×5 Plickers 风格卡片 |
| `server/globalAnswerCardGenerator.ts` | QR 风格全局卡片，需确认是否废弃 |
| `server/_core/email.ts` | 邮件发送实现 |
| `APP_REQUIREMENTS.md` | Android 扫描端需求 |
| `DEPLOYMENT_GUIDE.md` | 宝塔部署指南 |
| `EMAIL_SERVICE_GUIDE.md` | 邮件服务配置说明 |
| `todo.md` | 历史路线图和遗留事项 |

---

## 16. 结论

ClassClicker 的 Web 教师端已经形成了比较完整的产品骨架：认证、班级、学生、题库、会话、答题统计、报表导出和答题卡下载均有代码基础；本地账户登录问题也已经通过虚拟 `openId` 修复，注册流程已调整为邮箱验证成功后才创建账户。

现在项目真正的关键不再是继续堆叠零散页面，而是完成以下三件事：

1. **统一答题卡格式和生成链路**，确保打印卡、后端、Android 识别三方一致。
2. **把当前测试/API 漂移和生产部署问题收口**，让 Web 端进入可交付状态。
3. **以冻结后的后端协议为基础开发 Android 扫描端**，实现课堂现场的 Web + 手机实时协同。

如果重新开始开发，最合理的第一项工作不是直接写 Android，而是先完成答题卡标准确认、API 测试修复和生产部署验收。
