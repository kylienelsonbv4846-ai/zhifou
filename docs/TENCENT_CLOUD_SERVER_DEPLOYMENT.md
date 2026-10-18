# ClassClicker 腾讯云服务器部署与运维指南

本文是当前仓库的**权威自托管部署流程**，与独立 JWT Cookie、MySQL/MariaDB 和服务器本地持久化文件存储相匹配。请在新的腾讯云 CVM/轻量应用服务器上操作；旧版 Tencent Cloud 文档里的 PM2、MySQL root 直连、自动启用 UFW 等步骤已由新脚本取代。

一键安装脚本：[deploy-tencent-cloud.sh](../scripts/deploy-tencent-cloud.sh)。

## 1. 部署结果与边界

安装脚本会在一台 Ubuntu 服务器上配置：

- Node.js 22、pnpm 10、MariaDB、Nginx 和 Certbot；
- ClassClicker 的生产构建及 systemd 服务；
- Nginx HTTPS 反向代理，应用只监听 `127.0.0.1:3000`；
- MySQL 数据库和应用专用账户；数据库端口不会开放到公网；
- `/var/lib/classroom-clicker/uploads` 持久化上传/生成文件；
- 每日数据库与上传目录本地备份，保留 14 天。

脚本**不会**购买或开通腾讯云资源、修改安全组、防火墙规则或 DNS；也不会迁移临时沙箱中的演示用户和数据。它只支持全新 Ubuntu 22.04/24.04 安装；检测到既有数据库而缺少本机配置时会停止，不会覆盖既有数据。已有生产数据库应按第 8 节先备份、审阅 schema 变更，再单独迁移。

## 2. 开始前准备

### 2.1 腾讯云服务器

建议新建 Ubuntu 22.04 LTS 或 24.04 LTS CVM/轻量应用服务器。推荐至少 **2 vCPU、4 GB 内存、50 GB 持久磁盘**，并根据并发用户与文件规模扩容。

在腾讯云控制台的安全组/防火墙中配置：

| 入站端口 | 来源                | 用途                         |
| -------- | ------------------- | ---------------------------- |
| TCP 22   | 仅你的管理公网 IP   | SSH 运维；不要对所有来源开放 |
| TCP 80   | `0.0.0.0/0`、`::/0` | HTTP 与证书签发/续期         |
| TCP 443  | `0.0.0.0/0`、`::/0` | HTTPS 网站访问               |

**不要开放 TCP 3000 或 3306**。数据库和 Node 服务均只需服务器内部访问。若服务器有独立的操作系统防火墙，请先确认 SSH 规则后再自行启用；安装脚本不会自动启用 UFW，以免断开远程 SSH。

### 2.2 域名和 DNS

准备一个你有权管理的域名，例如 `class.example.com`。在 DNS 控制台创建 A 记录，将其指向 CVM 的公网 IPv4 地址；等待解析生效后再运行安装脚本。脚本会检查域名解析并通过 Let's Encrypt 申请证书。脚本的 `--email` 只用于证书通知。

若不打算配置域名或 80/443 尚未开放，不要运行此安装脚本；它面向有 HTTPS 域名的正式站点，不提供仅 IP 的 HTTP 部署模式。

### 2.3 项目仓库访问

部署前必须由项目所有者选定一个腾讯云服务器可访问、且包含经验证发布代码的 Git 仓库；安装脚本不会默认拉取任何仓库，也不会自动选用历史 GitHub 源仓库或 WebDev 内部远端。若当前 WebDev canonical 仓库不能从 CVM 访问，应先由用户决定并准备一个可访问的发布仓库。私有 GitHub 仓库推荐使用只读 Deploy Key，不要把 Personal Access Token、SSH 私钥或密码写入脚本参数、日志或 Git 仓库。

## 3. 上传脚本并授权只读仓库访问

以下命令在你的本地电脑执行。将 SSH 私钥路径、公网 IP 替换成自己的值；通常 Ubuntu 镜像的 SSH 用户是 `ubuntu`，请以腾讯云控制台显示的系统用户名为准。

```bash
scp -i ~/Downloads/tencent-cvm.pem scripts/deploy-tencent-cloud.sh ubuntu@<CVM公网IP>:/tmp/deploy-tencent-cloud.sh
ssh -i ~/Downloads/tencent-cvm.pem ubuntu@<CVM公网IP>
```

在服务器上生成 Deploy Key：

```bash
sudo bash /tmp/deploy-tencent-cloud.sh --setup-github-key
```

命令会显示**公钥**（以 `ssh-ed25519` 开头）。复制该公钥，到 GitHub 仓库的 **Settings → Deploy keys → Add deploy key** 添加；例如标题 `classroom-clicker-tencent-cvm`，并确保**不勾选 Allow write access**。这不会展示或上传私钥。

完成授权后，在服务器上检查域名已解析并运行正式安装：

```bash
sudo bash /tmp/deploy-tencent-cloud.sh \
  --repo git@github.com:OWNER/REPOSITORY.git \
  --branch main \
  --domain class.example.com \
  --email admin@example.com
```

请将仓库 URL 替换为用户已选定的可信发布仓库；也可在运行环境显式设置 `APP_REPO_URL`。私有仓库须为该仓库单独授权一个只读 Deploy Key。完整参数：

```bash
sudo bash /tmp/deploy-tencent-cloud.sh --help
```

安装需要几分钟。脚本会从 `main` 克隆项目，生成随机的数据库密码和 JWT 密钥，创建权限受限的环境文件，使用 `drizzle/migrations/` 中的已提交基线初始化新数据库，构建并启动网站，配置 Nginx/HTTPS，最后访问 `/healthz` 做进程存活检查。成功后会打印站点地址。

## 4. 邮箱注册和生产密钥

新环境的 `APP_BASE_URL`、`CLASSCLICKER_SESSION_SECRET`、数据库连接和文件目录由脚本创建在：

```text
/etc/classroom-clicker/app.env
```

该文件由 root 拥有，只允许应用服务组读取。它不在 Git 项目目录中，**不要把它提交到仓库或公开贴出内容**。脚本将腾讯云 SES 变量留空，因此，在实际用户注册前必须先配置已验证发信身份对应的凭证：

- `TENCENT_SECRET_ID`
- `TENCENT_SECRET_KEY`
- `TENCENT_SES_REGION`
- `SENDER_EMAIL`

使用具有最小必要权限的腾讯云子账号密钥，并按腾讯云 SES 要求完成发件域名/邮箱验证。编辑后重启应用：

```bash
sudoedit /etc/classroom-clicker/app.env
sudo chown root:classclicker /etc/classroom-clicker/app.env
sudo chmod 0640 /etc/classroom-clicker/app.env
sudo systemctl restart classroom-clicker
sudo systemctl status classroom-clicker --no-pager
```

没有有效 SES 配置时，注册邮件验证和密码重置邮件不能完整工作。正式服务器不会自动创建临时手测用演示账号；上线后应通过真实邮箱注册并验证首个账号。

## 5. 验收检查

浏览器访问 `https://class.example.com`，并检查：

```bash
curl -fsS https://class.example.com/healthz
sudo systemctl status classroom-clicker --no-pager
sudo systemctl status nginx --no-pager
sudo systemctl list-timers classroom-clicker-backup.timer
```

`/healthz` 返回 `{"status":"ok"}` 代表 Web 进程可响应，不代表邮件凭证已配置。建议再使用真实邮箱完成注册/验证/登录，创建一个测试班级，上传一张图片或生成答题卡并确认刷新后仍可读取，然后删除测试数据。

## 6. 日常运维与更新

### 查看日志和服务

```bash
sudo journalctl -u classroom-clicker -f
sudo journalctl -u nginx --since today
sudo systemctl restart classroom-clicker
sudo systemctl reload nginx
```

### 更新应用代码

先确认服务器工作树没有人工改动，再拉取和构建。该流程不执行数据库 schema 变更：

```bash
sudo -u classclicker git -C /opt/classroom-clicker status --short
sudo -u classclicker git -C /opt/classroom-clicker pull --ff-only origin main
sudo -u classclicker env PATH=/usr/local/bin:/usr/bin:/bin pnpm --dir /opt/classroom-clicker install --frozen-lockfile
sudo -u classclicker env PATH=/usr/local/bin:/usr/bin:/bin NODE_ENV=production pnpm --dir /opt/classroom-clicker build
sudo systemctl restart classroom-clicker
curl -fsS https://class.example.com/healthz
```

若更新增加了新的 `drizzle/migrations/` 文件，先运行一次备份，再用应用用户加载受限环境文件执行 `pnpm db:migrate`。它只应用迁移 journal 中尚未执行的提交版本；不要使用 `--force`，也不要将 migration 执行与普通代码构建混淆。命令形式如下：

```bash
sudo systemctl start classroom-clicker-backup.service
sudo -u classclicker env PATH=/usr/local/bin:/usr/bin:/bin bash -c \
  'set -a; . /etc/classroom-clicker/app.env; set +a; pnpm --dir /opt/classroom-clicker db:migrate'
```

首次安装脚本只对刚创建的空库自动执行已提交的完整基线。`drizzle/` 顶层未登记的旧 SQL 不参与新库迁移。若现有数据库曾由旧版 `db:push` 创建、但没有 `drizzle/migrations` 对应 journal 记录，不要直接对其运行基线迁移；先备份并单独核实/协调迁移历史。

## 7. 备份与恢复

安装脚本启用了每日本地备份计时器。备份包括 MariaDB 数据库和 `uploads` 文件目录，保留 14 天；备份目录为 `/var/backups/classroom-clicker`。这只是同一台服务器上的短期备份，**不能抵御整台 CVM、系统盘或账户故障**。应定期将备份复制到腾讯云 COS 或另一独立位置，并限制备份桶权限。

手动触发和查看：

```bash
sudo systemctl start classroom-clicker-backup.service
sudo journalctl -u classroom-clicker-backup.service --no-pager -n 50
sudo ls -lh /var/backups/classroom-clicker
```

每个备份目录包含 `database.sql.gz` 和 `uploads.tar.gz`。恢复前停止应用，先保留当前故障现场/数据的副本；在确认目标数据库后恢复：

```bash
sudo systemctl stop classroom-clicker
BACKUP_DIR=/var/backups/classroom-clicker/<UTC时间戳>
sudo gzip -dc "$BACKUP_DIR/database.sql.gz" | sudo mariadb classroom_clicker
sudo tar -C /var/lib/classroom-clicker -xzf "$BACKUP_DIR/uploads.tar.gz"
sudo chown -R classclicker:classclicker /var/lib/classroom-clicker
sudo systemctl start classroom-clicker
```

恢复会覆盖或合并目标数据库中的表数据，实际操作前应在隔离库演练，并确认备份日期与文件目录属于同一时间点。

## 8. 从旧站点/旧存储迁移时

如果是全新上线，无需迁移临时手测站的虚构演示数据。若迁移既有生产数据：

1. 先备份旧数据库、对象存储文件及邮件配置；不要覆盖现有 CVM 或数据库。
2. 将历史文件复制到新的 `FILE_STORAGE_DIR`，保留原对象键相对路径。
3. 更新数据库里旧 `questionMediaUrl` 和答题卡 URL 元数据，使其指向新站 `/api/storage/<对象键>`。
4. 旧数据库可能保留物理列 `s3Key` / `s3Url`；目前代码属性映射为 `storageKey` / `storageUrl`，并未要求删除旧列。
5. 历史 Manus OAuth 账号不会自动转换为本地邮箱账号，需要另行验证邮箱并处理用户关联。
6. 抽样确认历史图片、视频和答题卡可访问，验证数据库与文件备份恢复后，再停用旧存储或旧登录入口。

这份脚本不会连接、读取或迁移任何生产/沙箱数据库；也不会自动复制临时预览环境中的数据。

## 9. 常见故障

- **Deploy Key 无法读取仓库**：在正确仓库的 Deploy keys 中确认添加了脚本显示的公钥，且未添加错仓库；重新运行安装命令。不要将私钥上传到 GitHub。
- **Certbot 校验失败**：确认 A 记录指向这台 CVM 公网 IPv4，TCP 80/443 已在腾讯云安全组开放，DNS 已传播后重新运行脚本。
- **`/healthz` 失败**：执行 `sudo journalctl -u classroom-clicker -n 150 --no-pager`；同时确认 MariaDB 正常、环境文件路径正确、`FILE_STORAGE_DIR` 可写。
- **上传失败或 413**：Nginx 已设置 55 MB 上限；检查 `sudo nginx -t`、重载 Nginx，并确认应用实际上传限制没有高于代理限制。
- **数据库 schema 报错**：不要使用 `--force`。先备份，核对 `drizzle/migrations/meta/_journal.json` 与 `__drizzle_migrations`；老版本未登记 SQL 不会被新基线读取，旧 `db:push` 数据库需先协调 migration history。
- **邮件不发送**：核对 SES 凭证、区域、发件人验证和邮件发送权限；修改环境文件后重启应用。
