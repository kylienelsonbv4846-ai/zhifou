# ClassClicker 宝塔部署完整指南

> 如部署到腾讯云，请优先使用[当前腾讯云服务器部署指南](docs/TENCENT_CLOUD_SERVER_DEPLOYMENT.md)及其配套脚本；下文是宝塔手动部署参考。

## 📋 项目概览

- **项目名称**: ClassClicker（课堂即时反馈系统）
- **技术栈**: React 19 + Express 4 + Node.js + 自建 MySQL/MariaDB
- **运行时**: Node.js 22+
- **包管理**: pnpm
- **数据库**: MySQL 5.7+

---

## 第一步：宝塔环境准备

### 1.1 安装宝塔面板
访问 [宝塔官网](https://www.bt.cn) 下载并安装宝塔面板（选择对应系统版本）

### 1.2 在宝塔中安装必要的软件

进入宝塔面板 → **软件商店** → 搜索并安装以下软件：

| 软件 | 版本要求 | 说明 |
|------|---------|------|
| **Nginx** | 1.20+ | Web 服务器，用于反向代理 Node.js |
| **MySQL** | 5.7+ 或 8.0 | 数据库 |
| **Node.js** | 18.0+ 或 20.0+ | JavaScript 运行时 |

**安装步骤**：
1. 点击"安装"
2. 选择版本（建议选择最新稳定版）
3. 等待安装完成（可能需要 5-10 分钟）

---

## 第二步：创建数据库

### 2.1 打开 MySQL 管理界面

宝塔面板 → **数据库** → **MySQL**

### 2.2 创建新数据库

1. 点击"**新建数据库**"按钮
2. 填写以下信息：
   - **数据库名**: `classroom_clicker`
   - **用户名**: `clicker_user`
   - **密码**: 设置一个强密码（建议 12 位以上，包含大小写字母、数字、特殊符号）
   - **字符集**: 选择 `utf8mb4`
   - **数据库权限**: 勾选所有权限

3. 点击"**提交**"

**记录下以下信息**（后面会用到）：
```
数据库名: classroom_clicker
用户名: clicker_user
密码: [你设置的密码]
主机: localhost
端口: 3306
```

### 2.3 验证数据库连接

在宝塔面板中，点击数据库右侧的"**管理**"按钮，能打开 phpMyAdmin 即表示连接成功。

---

## 第三步：上传项目代码

### 3.1 准备项目文件

在本地机器上，进入项目目录：
```bash
cd /home/ubuntu/classroom-clicker
```

### 3.2 上传到服务器

**方式一：使用宝塔文件管理器（推荐新手）**

1. 宝塔面板 → **文件** → 进入 `/www/wwwroot` 目录
2. 新建文件夹 `classroom-clicker`
3. 进入该文件夹，点击"**上传**"
4. 上传整个项目文件夹（包括 `node_modules` 除外）

**方式二：使用 Git（推荐有 Git 基础）**

1. 宝塔面板 → **终端**，执行：
```bash
cd /www/wwwroot
git clone [你的项目 Git 仓库地址] classroom-clicker
cd classroom-clicker
```

**方式三：使用 SCP 命令（推荐有 Linux 基础）**

```bash
scp -r /home/ubuntu/classroom-clicker/* root@[服务器IP]:/www/wwwroot/classroom-clicker/
```

---

## 第四步：安装项目依赖

### 4.1 进入项目目录

宝塔面板 → **终端**，执行：

```bash
cd /www/wwwroot/classroom-clicker
```

### 4.2 安装 pnpm（如果未安装）

```bash
npm install -g pnpm
```

### 4.3 安装项目依赖

```bash
pnpm install
```

这个过程可能需要 5-15 分钟，取决于网络速度。

---

## 第五步：配置环境变量

### 5.1 创建 .env 文件

在宝塔终端中，进入项目目录：

```bash
cd /www/wwwroot/classroom-clicker
```

创建 `.env` 文件：

```bash
cat > .env << 'EOF'
# 数据库配置
DATABASE_URL="mysql://clicker_user:[密码]@localhost:3306/classroom_clicker"

# 独立 JWT 会话密钥（必需；使用 openssl rand -hex 48 生成）
CLASSCLICKER_SESSION_SECRET="replace-with-output-of-openssl-rand-hex-48"

# 邮箱验证邮件（使用腾讯云 SES；注册邮件功能必需）
TENCENT_SECRET_ID="your_tencent_secret_id"
TENCENT_SECRET_KEY="your_tencent_secret_key"
TENCENT_SES_REGION="ap-hongkong"
SENDER_EMAIL="noreply@yourdomain.com"

# 本地持久化文件目录（需位于持久化磁盘，不要放在会被发布覆盖的代码目录内）
FILE_STORAGE_DIR="/var/lib/classroom-clicker/uploads"

# 密码重置链接的站点源
APP_BASE_URL="https://yourdomain.com"

# 其他配置
NODE_ENV="production"
PORT=3000
EOF
```

**重要**：将上面的占位符替换为实际值：
- `[密码]` → 你在第二步设置的数据库密码
- `replace-with-output-of-openssl-rand-hex-48` → 用 5.2 步生成的 48 字节随机密钥输出替换
- 配置腾讯云 SES 发件人和凭证，用于邮箱验证
- 创建文件目录并授权 Node.js 运行用户读写：`sudo install -d -m 750 /var/lib/classroom-clicker/uploads`，随后将目录 owner/group 改为实际运行 PM2 的账户（例如 `sudo chown <运行用户>:<运行组> /var/lib/classroom-clicker/uploads`）
- 将 `/var/lib/classroom-clicker/uploads` 纳入独立备份；MySQL 数据库和此目录需要一起备份

上传和生成文件保存在 `FILE_STORAGE_DIR` 下的相对路径，浏览器继续使用同源 `/api/storage/...` URL。请确保反向代理允许应用设定的上传体积，且该目录位于持久化磁盘，而不是临时容器层或每次发布都会替换的目录。

**从旧 S3 迁移时**：文件不会自动下载。先完整备份数据库及 Bucket，再将对象复制到 `FILE_STORAGE_DIR` 并保留原有对象键路径（例如 `questions/...`、`answer-cards/...`）。现有数据库物理列 `s3Key` / `s3Url` 仅为兼容既有 schema 而保留；应用代码用 `storageKey`（映射到旧 `s3Key`）读取本地文件。更新 `questions.questionMediaUrl` 和答题卡 URL 元数据，使其指向 `/api/storage/<对象键>`（URL 路径各段需 URL 编码），验证历史图片、视频和答题卡均可访问并完成数据库与文件目录的联合备份后，再停用旧 Bucket。

若数据库中仍有仅使用旧外部 OAuth 的账户，当前代码不会自动把它们转换成本地邮箱账户；上线前需通过验证邮箱的账户迁移流程处理登录身份及关联数据。此改造没有连接生产数据库，也未执行账户数据迁移。

### 5.2 生成 CLASSCLICKER_SESSION_SECRET

在宝塔终端中执行：

```bash
openssl rand -hex 48
```

复制输出结果，替换 `.env` 中的 `CLASSCLICKER_SESSION_SECRET` 值。

---

## 第六步：初始化数据库

### 6.1 同步数据库 schema

在宝塔终端中执行：

```bash
cd /www/wwwroot/classroom-clicker
set -a
. ./.env
set +a
pnpm db:migrate
```

`drizzle/migrations/` 包含当前 schema 的干净基线和后续迁移；`pnpm db:migrate` 在全新空库中按 journal 创建完整表结构。`drizzle/` 顶层旧 SQL 不会作为该迁移链执行。若数据库此前由 `db:push` 建表且没有 migration journal 记录，不要直接套用空库基线；先备份并单独协调历史。

### 6.2 验证数据库表

1. 宝塔面板 → **数据库** → 点击 `classroom_clicker` 右侧的"**管理**"
2. 在 phpMyAdmin 中应该能看到多个表（如 `users`, `answerCardsMetadata` 等）

---

## 第七步：构建项目

### 7.1 编译前端和后端

在宝塔终端中执行：

```bash
cd /www/wwwroot/classroom-clicker
pnpm build
```

这会生成：
- `client/dist/` - 前端静态文件
- `dist/index.js` - 后端服务器文件

---

## 第八步：配置 Nginx 反向代理

### 8.1 创建 Nginx 配置

宝塔面板 → **网站** → **添加站点**

1. 填写以下信息：
   - **域名**: 输入你的域名（如 `classroom.example.com`）
   - **根目录**: `/www/wwwroot/classroom-clicker`
   - **PHP 版本**: 选择"**纯静态**"
   - **端口**: 80（HTTP）或 443（HTTPS）

2. 点击"**提交**"

### 8.2 修改 Nginx 配置

1. 宝塔面板 → **网站** → 找到刚创建的站点
2. 点击"**配置**"按钮
3. 将以下内容替换到配置文件中：

```nginx
upstream classroom_clicker_backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name classroom.example.com;  # 替换为你的域名
    client_max_body_size 55m;
    
    # 重定向 HTTP 到 HTTPS（可选，如果启用了 HTTPS）
    # return 301 https://$server_name$request_uri;

    # 本地上传与生成文件必须交由 Express 从 FILE_STORAGE_DIR 提供
    location ^~ /api/storage/ {
        proxy_pass http://classroom_clicker_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 前端及其他 API 路由
    location / {
        proxy_pass http://classroom_clicker_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API 路由
    location /api {
        proxy_pass http://classroom_clicker_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

4. 点击"**保存**"

---

## 第九步：启动应用

### 9.1 使用 PM2 管理进程

#### 安装 PM2

```bash
npm install -g pm2
```

#### 创建 PM2 配置文件

在项目根目录创建 `ecosystem.config.js`：

```bash
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'classroom-clicker',
    script: './scripts/start-production.sh',
    interpreter: '/bin/bash',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M'
  }]
};
EOF
```

#### 启动应用

```bash
pm2 start ecosystem.config.js
```

#### 设置开机自启

```bash
pm2 startup
pm2 save
```

### 9.2 验证应用是否运行

```bash
pm2 status
```

应该看到 `classroom-clicker` 应用状态为 `online`。

---

## 第十步：配置 HTTPS（可选但推荐）

### 10.1 申请 SSL 证书

宝塔面板 → **网站** → 找到你的站点 → **SSL**

1. 点击"**申请**"
2. 选择"**Let's Encrypt**"（免费）
3. 输入邮箱，点击"**申请**"
4. 等待申请完成

### 10.2 启用 HTTPS

申请成功后，点击"**强制 HTTPS**"按钮。

---

## 第十一步：测试应用

### 11.1 访问应用

在浏览器中打开：
```
http://classroom.example.com
```
（如果启用了 HTTPS，使用 `https://classroom.example.com`）

### 11.2 检查日志

如果出现问题，查看 PM2 日志：

```bash
pm2 logs classroom-clicker
```

或查看 Nginx 错误日志：

宝塔面板 → **日志** → **Nginx 错误日志**

---

## 常见问题排查

### 问题 1：数据库连接失败

**症状**: 应用启动后无法连接数据库

**解决方案**：
1. 检查 `.env` 文件中的 `DATABASE_URL` 是否正确
2. 确认 MySQL 服务正在运行：`systemctl status mysql`
3. 验证数据库用户和密码：在 phpMyAdmin 中测试

### 问题 2：应用无法启动

**症状**: PM2 显示应用状态为 `stopped` 或 `errored`

**解决方案**：
1. 查看 PM2 日志：`pm2 logs classroom-clicker`
2. 检查 `.env` 文件是否存在且配置正确
3. 确认 `pnpm build` 是否成功完成

### 问题 3：无法访问应用

**症状**: 浏览器显示 502 Bad Gateway 或连接超时

**解决方案**：
1. 检查 Nginx 配置是否正确
2. 确认 PM2 应用正在运行：`pm2 status`
3. 检查防火墙是否开放了 80 和 443 端口
4. 查看 Nginx 错误日志

### 问题 4：数据库表未创建

**症状**: 应用运行但数据库表为空

**解决方案**：
```bash
cd /www/wwwroot/classroom-clicker
set -a
. ./.env
set +a
pnpm db:migrate
```

---

## 维护和监控

### 查看应用状态

```bash
pm2 status
```

### 重启应用

```bash
pm2 restart classroom-clicker
```

### 停止应用

```bash
pm2 stop classroom-clicker
```

### 查看实时日志

```bash
pm2 logs classroom-clicker --lines 100
```

### 监控应用资源使用

```bash
pm2 monit
```

---

## 备份数据库

### 手动备份

宝塔面板 → **数据库** → 点击 `classroom_clicker` 右侧的"**备份**"

### 自动备份（推荐）

宝塔面板 → **计划任务** → **新增任务**

1. **任务类型**: 数据库备份
2. **选择数据库**: `classroom_clicker`
3. **执行周期**: 每天 02:00
4. **保留数量**: 7 个

---

## 更新应用

### 更新代码

```bash
cd /www/wwwroot/classroom-clicker
git pull origin main  # 如果使用 Git
# 或手动上传新文件
```

### 重新安装依赖（如果 package.json 有变化）

```bash
pnpm install
```

### 重新构建

```bash
pnpm build
```

### 重启应用

```bash
pm2 restart classroom-clicker
```

---

## 性能优化建议

1. **启用 Gzip 压缩**: 宝塔面板 → **网站** → **配置** → 启用 Gzip
2. **启用缓存**: 在 Nginx 配置中添加缓存头
3. **使用 CDN**: 将静态资源上传到 CDN
4. **监控内存使用**: 定期检查 PM2 的内存占用

---

## 获取帮助

如遇到问题，请检查：
1. PM2 日志：`pm2 logs classroom-clicker`
2. Nginx 错误日志：宝塔面板 → **日志** → **Nginx 错误日志**
3. MySQL 错误日志：宝塔面板 → **日志** → **MySQL 错误日志**

---

**部署完成！** 🎉

如有任何问题，请参考上述排查指南或联系技术支持。
