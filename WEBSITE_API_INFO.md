# ClassClicker 网站 API 信息文档

## 一、网站基本信息

### 1.1 项目名称和版本
- **项目名称**：ClassClicker（课堂即时反馈系统）
- **项目版本**：1.0.0
- **项目类型**：Web + Mobile 应用
- **开源协议**：MIT

### 1.2 网站部署信息
- **域名**：由部署环境配置
- **API 基础 URL**：`https://<your-domain>/api/trpc`
- **协议**：HTTPS（生产环境）/ HTTP（开发环境）
- **端口**：3000（开发）/ 443（生产）

### 1.3 技术栈
- **前端框架**：React 19 + Tailwind CSS 4 + Vite
- **后端框架**：Express 4 + tRPC 11
- **数据库**：MySQL/TiDB
- **ORM**：Drizzle ORM
- **认证**：本地邮箱账户 + JWT Cookie
- **存储**：服务器本地持久化文件目录

---

## 二、后端 API 架构

### 2.1 tRPC 接口定义

**tRPC 是一个类型安全的 RPC 框架，所有 API 都在 `server/routers.ts` 中定义。**

**API 调用方式**（HTTP POST）：
```
POST /api/trpc/[router].[procedure]
Content-Type: application/json

{
  "json": { /* 输入参数 */ }
}
```

**响应格式**：
```json
{
  "result": {
    "data": { /* 返回数据 */ }
  }
}
```

### 2.2 核心 API 路由

#### 2.2.1 认证相关 (auth)

| 接口 | 方法 | 说明 | 认证 |
|------|------|------|------|
| auth.me | Query | 获取当前登录用户信息 | 否 |
| auth.logout | Mutation | 登出 | 否 |
| auth.register | Mutation | 用户注册（邮箱+密码） | 否 |
| auth.login | Mutation | 用户登录 | 否 |
| auth.verifyEmail | Mutation | 验证邮箱 | 否 |
| auth.resendVerificationEmail | Mutation | 重新发送验证邮件 | 否 |
| auth.requestPasswordReset | Mutation | 请求密码重置 | 否 |
| auth.resetPassword | Mutation | 重置密码 | 否 |

#### 2.2.2 题集管理 (questionSets)

| 接口 | 方法 | 说明 | 认证 | 输入参数 |
|------|------|------|------|---------|
| questionSets.list | Query | 获取题集列表 | 是 | 无 |
| questionSets.get | Query | 获取题集详情 | 是 | `{ id: string }` |
| questionSets.create | Mutation | 创建题集 | 是 | `{ name: string, description?: string }` |
| questionSets.update | Mutation | 更新题集 | 是 | `{ id: string, name?: string, description?: string }` |
| questionSets.delete | Mutation | 删除题集 | 是 | `{ id: string }` |

**返回数据结构**：
```typescript
{
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
  questionCount: number;
}
```

#### 2.2.3 班级管理 (classes)

| 接口 | 方法 | 说明 | 认证 | 输入参数 |
|------|------|------|------|---------|
| classes.list | Query | 获取班级列表 | 是 | 无 |
| classes.get | Query | 获取班级详情 | 是 | `{ id: string }` |
| classes.create | Mutation | 创建班级 | 是 | `{ name: string, description?: string }` |
| classes.update | Mutation | 更新班级 | 是 | `{ id: string, name?: string, description?: string }` |
| classes.delete | Mutation | 删除班级 | 是 | `{ id: string }` |
| classes.addStudent | Mutation | 添加学生到班级 | 是 | `{ classId: string, studentId: number }` |
| classes.removeStudent | Mutation | 从班级移除学生 | 是 | `{ classId: string, studentId: number }` |

**返回数据结构**：
```typescript
{
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
  studentCount: number;
}
```

#### 2.2.4 学生管理 (students)

| 接口 | 方法 | 说明 | 认证 | 输入参数 |
|------|------|------|------|---------|
| students.list | Query | 获取学生列表（按班级） | 是 | `{ classId: string }` |
| students.get | Query | 获取学生详情 | 是 | `{ id: number }` |
| students.create | Mutation | 创建学生 | 是 | `{ name: string, classId: string, cardNumber?: number }` |
| students.update | Mutation | 更新学生 | 是 | `{ id: number, name?: string, cardNumber?: number }` |
| students.delete | Mutation | 删除学生 | 是 | `{ id: number }` |
| students.batchImport | Mutation | 批量导入学生 | 是 | `{ classId: string, students: Array<{name, cardNumber}> }` |

**返回数据结构**：
```typescript
{
  id: number;
  name: string;
  classId: string;
  cardNumber: number;  // 答题卡编号（1-80）
  createdAt: Date;
  updatedAt: Date;
}
```

#### 2.2.5 会话管理 (sessions)

| 接口 | 方法 | 说明 | 认证 | 输入参数 |
|------|------|------|------|---------|
| sessions.list | Query | 获取会话列表 | 是 | 无 |
| sessions.get | Query | 获取会话详情 | 是 | `{ id: string }` |
| sessions.create | Mutation | 创建会话 | 是 | `{ questionSetId: string, classId: string }` |
| sessions.start | Mutation | 开始会话 | 是 | `{ id: string }` |
| sessions.end | Mutation | 结束会话 | 是 | `{ id: string }` |
| sessions.nextQuestion | Mutation | 切换到下一题 | 是 | `{ id: string }` |
| sessions.previousQuestion | Mutation | 切换到上一题 | 是 | `{ id: string }` |
| sessions.submitAnswer | Mutation | 提交答题结果 | 是 | `{ sessionId: string, studentId: number, answer: 'A'\|'B'\|'C'\|'D' }` |

**返回数据结构**：
```typescript
{
  id: string;
  questionSetId: string;
  classId: string;
  currentQuestionIndex: number;
  status: 'created' | 'started' | 'ended';
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  answers: Array<{
    studentId: number;
    answer: 'A' | 'B' | 'C' | 'D';
    isCorrect: boolean;
    timestamp: Date;
  }>;
}
```

#### 2.2.6 题目管理 (questions)

| 接口 | 方法 | 说明 | 认证 | 输入参数 |
|------|------|------|------|---------|
| questions.list | Query | 获取题目列表 | 是 | `{ questionSetId: string }` |
| questions.get | Query | 获取题目详情 | 是 | `{ id: string }` |
| questions.create | Mutation | 创建题目 | 是 | `{ questionSetId: string, content: string, options: Array<{text, isCorrect}>, order: number }` |
| questions.update | Mutation | 更新题目 | 是 | `{ id: string, content?: string, options?: Array<{text, isCorrect}> }` |
| questions.delete | Mutation | 删除题目 | 是 | `{ id: string }` |

**返回数据结构**：
```typescript
{
  id: string;
  questionSetId: string;
  content: string;
  options: Array<{
    id: string;
    text: string;
    isCorrect: boolean;
  }>;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 2.2.7 答题卡管理 (answerCards)

| 接口 | 方法 | 说明 | 认证 | 输入参数 |
|------|------|------|------|---------|
| answerCards.list | Query | 获取答题卡列表 | 是 | 无 |
| answerCards.get | Query | 获取单张答题卡 | 是 | `{ cardNumber: number }` |
| answerCards.isInitialized | Query | 检查答题卡是否已初始化 | 是 | 无 |
| answerCards.downloadSingle | Query | 下载单张答题卡 | 是 | `{ cardNumber: number }` |
| answerCards.downloadAll | Query | 下载所有答题卡（ZIP） | 是 | 无 |

**返回数据结构**：
```typescript
// list 返回
Array<{
  id: string;
  cardNumber: number;
  url: string;  // 同源 /api/storage/... 文件 URL
  createdAt: Date;
}>

// downloadSingle/downloadAll 返回
{
  url: string;  // 预签名 URL，可直接下载
  expiresIn: number;  // 过期时间（秒）
}
```

#### 2.2.8 系统管理 (system)

| 接口 | 方法 | 说明 | 认证 | 输入参数 |
|------|------|------|------|---------|
| system.generateAnswerCards | Mutation | 生成所有答题卡 | 是 | 无 |

---

## 三、认证方式

### 3.1 本地邮箱认证

**注册流程**：
1. 用户输入邮箱和密码
2. 调用 `auth.register` API
3. 系统发送验证邮件
4. 用户点击验证链接或输入验证码
5. 调用 `auth.verifyEmail` API
6. 用户可以登录

**登录流程**：
1. 用户输入邮箱和密码
2. 调用 `auth.login` API
3. 系统验证凭证
4. 返回 JWT Token，存储在 Cookie 中
5. 用户登录成功

### 3.2 会话验证

- **存储位置**：HttpOnly Cookie（`session`），浏览器通过同源请求自动携带
- **有效期**：JWT 和 Cookie 均为 1 年
- **验证方式**：服务器使用 `CLASSCLICKER_SESSION_SECRET` 校验签名、有效期和本地用户 ID，再从数据库加载用户
- **授权方式**：`protectedProcedure` 只接受已恢复的本地用户上下文

---

## 四、数据库结构

### 4.1 主要表

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| users | 用户表 | id, email, name, role, loginMethod |
| classes | 班级表 | id, name, userId, description |
| students | 学生表 | id, name, classId, cardNumber |
| questionSets | 题集表 | id, name, userId, description |
| questions | 题目表 | id, questionSetId, content, order |
| sessions | 会话表 | id, questionSetId, classId, status |
| sessionAnswers | 会话答题表 | id, sessionId, studentId, answer, isCorrect |
| answerCardsMetadata | 答题卡元数据 | id, cardNumber, url, createdAt |

### 4.2 用户角色

- **admin**：管理员（可访问所有功能）
- **user**：普通用户（只能访问自己的数据）

---

## 五、文件存储

### 5.1 本地文件存储

文件保存至服务器本地持久化目录 `FILE_STORAGE_DIR`；默认位置为项目工作目录下的 `data/uploads`。

**文件路径规则**：
```
answer-cards/permanent/{date}/card-{cardNumber}.pdf
answer-cards/downloads/{date}/all-cards-{timestamp}.zip
questions/{userId}/{timestamp}-{random}.{extension}
```

**上传方式**：
- 后端调用 `storagePut(key, data, contentType)` 写入本地文件系统
- 返回稳定的同源 `/api/storage/...` URL；应用从本地目录读取并直接提供文件
- `FILE_STORAGE_DIR` 应指向代码发布目录之外的持久化磁盘，并由应用运行用户读写

### 5.2 答题卡存储

- **格式**：PDF
- **位置**：`answer-cards/permanent/{date}/card-{1-80}.pdf`
- **访问方式**：通过同源文件 URL，由应用从本地目录读取

---

## 六、环境变量

### 6.1 系统自动注入

```
DATABASE_URL=<自建 MySQL/MariaDB 连接字符串>
CLASSCLICKER_SESSION_SECRET=<JWT 签名密钥>
APP_BASE_URL=<部署后的站点源，例如 https://classclicker.example.com>
FILE_STORAGE_DIR=<本地持久化文件目录，例如 /var/lib/classroom-clicker/uploads>
TENCENT_SECRET_ID=<腾讯云 SES Secret ID>
TENCENT_SECRET_KEY=<腾讯云 SES Secret Key>
TENCENT_SES_REGION=<腾讯云 SES 区域>
SENDER_EMAIL=<已验证的发件人邮箱>
```

### 6.2 可选环境变量

```
NODE_ENV=<production 或 development>
PORT=<监听端口>
```

---

## 七、API 调用示例（Android）

### 7.1 使用 Retrofit + OkHttp

**依赖**：
```gradle
implementation 'com.squareup.retrofit2:retrofit:2.9.0'
implementation 'com.squareup.retrofit2:converter-gson:2.9.0'
implementation 'com.squareup.okhttp3:okhttp:4.11.0'
```

**API 接口定义**：
```kotlin
interface ClassClickerApi {
    @POST("questionSets.list")
    suspend fun listQuestionSets(): Response<ApiResponse<List<QuestionSet>>>
    
    @POST("classes.list")
    suspend fun listClasses(): Response<ApiResponse<List<Class>>>
    
    @POST("sessions.create")
    suspend fun createSession(@Body request: CreateSessionRequest): Response<ApiResponse<Session>>
    
    @POST("sessions.submitAnswer")
    suspend fun submitAnswer(@Body request: SubmitAnswerRequest): Response<ApiResponse<Boolean>>
}
```

### 7.2 认证处理

**添加 Cookie 拦截器**：
```kotlin
val cookieJar = CookieJar.NO_COOKIES  // 或使用 PersistentCookieJar

val client = OkHttpClient.Builder()
    .cookieJar(cookieJar)
    .addInterceptor { chain ->
        val request = chain.request().newBuilder()
            .addHeader("Authorization", "Bearer $token")
            .build()
        chain.proceed(request)
    }
    .build()

val retrofit = Retrofit.Builder()
    .baseUrl("https://<your-domain>/api/trpc/")
    .client(client)
    .addConverterFactory(GsonConverterFactory.create())
    .build()
```

### 7.3 调用示例

```kotlin
val api = retrofit.create(ClassClickerApi::class.java)

// 获取题集列表
val questionSets = api.listQuestionSets()

// 创建会话
val session = api.createSession(CreateSessionRequest(
    questionSetId = "set-123",
    classId = "class-456"
))

// 提交答题结果
api.submitAnswer(SubmitAnswerRequest(
    sessionId = session.id,
    studentId = 1,
    answer = "A"
))
```

---

## 八、错误处理

### 8.1 常见错误码

| 错误码 | 说明 | 处理方式 |
|--------|------|---------|
| 401 | 未认证 | 重定向到登录页面 |
| 403 | 无权限 | 显示权限错误提示 |
| 404 | 资源不存在 | 显示资源不存在提示 |
| 500 | 服务器错误 | 显示错误提示，建议重试 |
| 429 | 请求过于频繁 | 显示限流提示，等待后重试 |

### 8.2 错误响应格式

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "未登录或 Token 已过期"
  }
}
```

---

## 九、性能优化建议

### 9.1 缓存策略

- **本地缓存**：使用 Room 缓存题集、班级、学生列表
- **HTTP 缓存**：设置合适的 Cache-Control 头
- **API 缓存**：避免重复请求相同数据

### 9.2 网络优化

- **连接复用**：使用 HTTP/2
- **请求合并**：批量获取数据
- **超时设置**：设置合理的连接和读取超时

### 9.3 图像处理

- **图像压缩**：上传前压缩答题卡图像
- **缩略图**：缓存缩略图而不是原始图像

---

## 十、安全建议

### 10.1 数据安全

- **HTTPS**：所有通信使用 HTTPS
- **数据加密**：敏感数据本地加密存储
- **Token 管理**：定期刷新 Token，及时清除过期 Token

### 10.2 API 安全

- **速率限制**：实现请求速率限制
- **输入验证**：验证所有用户输入
- **输出编码**：防止 XSS 攻击

---

**文档版本**：1.0  
**最后更新**：2026-10-12
**作者**：项目维护者
