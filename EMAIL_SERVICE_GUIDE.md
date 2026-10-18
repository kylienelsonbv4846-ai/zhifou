# 邮件服务配置

邮箱验证和密码重置邮件由 `server/_core/email.ts` 直接调用腾讯云 SES HTTP API。项目不再依赖平台内置邮件代理。

## 当前服务：腾讯云 SES

需要在服务器环境配置：

```env
TENCENT_SECRET_ID=your_secret_id
TENCENT_SECRET_KEY=your_secret_key
TENCENT_SES_REGION=ap-hongkong
SENDER_EMAIL=noreply@yourdomain.com
APP_BASE_URL=https://yourdomain.com
```

`TENCENT_SES_REGION` 未设置时默认使用 `ap-hongkong`。发件人邮箱须先在腾讯云 SES 中验证；还应确认账号已开通发送权限及目标收件人满足当前 SES 账号的发送策略。

## 代码路径

- `server/_core/email.ts`：`sendEmail()` 通过腾讯云 `SendEmail` API 发送邮件。
- `server/routers.ts`：注册验证、重发验证和密码重置流程。
- `server/emailVerification.ts`：验证链接、邮件正文生成。

邮件中的站点链接从 `APP_BASE_URL` 读取。开发环境未配置时使用 `http://localhost:5173`。

## 可选替代服务

代码中保留 `sendEmailViaSendGrid()` 作为独立的发送函数，但默认注册/验证流程没有切换到它。启用前需在服务端补充供应商选择和相应密钥配置；不要把密钥暴露给 `VITE_` 前缀的前端变量。

## 排错

1. 检查 `TENCENT_SECRET_ID`、`TENCENT_SECRET_KEY`、`SENDER_EMAIL` 是否已配置。
2. 查看服务器日志中的 `[Tencent Cloud]` 和 `[Email]` 信息。
3. 核对 SES 区域、发件人验证状态、账号发送配额及收件人限制。
4. 确认 `APP_BASE_URL` 指向部署后的 HTTPS 站点，验证链接可从邮件客户端访问。
