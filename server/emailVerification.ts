import crypto from "crypto";

/**
 * 生成安全的验证令牌
 * @returns 随机令牌字符串
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * 计算验证令牌过期时间（24小时后）
 * @returns 过期时间戳
 */
export function getTokenExpirationTime(): Date {
  const expirationTime = new Date();
  expirationTime.setHours(expirationTime.getHours() + 24);
  return expirationTime;
}

/**
 * 检查验证令牌是否过期
 * @param expiresAt 过期时间
 * @returns 是否过期
 */
export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * 获取可被邮件收件人访问的应用公开 origin。
 * 生产环境必须显式配置 HTTPS 地址，不能使用容器 Host 或 localhost。
 */
export function getAppBaseUrl(): string {
  const configured = process.env.APP_BASE_URL?.trim();
  const candidate = configured || (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");
  if (!candidate) {
    throw new Error("生产邮件链接必须配置公开 HTTPS 的 APP_BASE_URL");
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("APP_BASE_URL 格式无效");
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("APP_BASE_URL 必须是仅包含 origin 的 HTTP(S) URL");
  }

  const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase());
  if (process.env.NODE_ENV === "production" && (url.protocol !== "https:" || isLoopback)) {
    throw new Error("生产邮件链接必须使用公开 HTTPS 域名");
  }

  return url.origin;
}

/**
 * 生成邮箱验证链接。
 */
export function generateVerificationLink(token: string): string {
  const url = new URL("/verify-email", `${getAppBaseUrl()}/`);
  url.searchParams.set("token", token);
  return url.toString();
}

/**
 * 生成邮箱验证邮件HTML内容
 * @param userName 用户名
 * @param verificationLink 验证链接
 * @returns HTML邮件内容
 */
export function generateVerificationEmailHTML(
  userName: string,
  verificationLink: string
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
          }
          .header {
            background-color: #4f46e5;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background-color: white;
            padding: 30px;
            border-radius: 0 0 8px 8px;
          }
          .button {
            display: inline-block;
            background-color: #4f46e5;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
            font-weight: bold;
          }
          .button:hover {
            background-color: #4338ca;
          }
          .footer {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #666;
          }
          .warning {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 10px 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>邮箱验证</h1>
            <p>欢迎来到 ClassClicker</p>
          </div>
          <div class="content">
            <h2>邮箱验证</h2>
            <p>您好 ${escapeHtml(userName)},</p>
            
            <p>感谢您注册 ClassClicker 账户！为了完成注册过程，请验证您的邮箱地址。</p>
            
            <p>请点击下方按钮验证您的邮箱：</p>
            
            <a href="${escapeHtml(verificationLink)}" class="button">验证邮箱</a>
            
            <p>或者复制以下链接到浏览器中：</p>
            <p style="word-break: break-all; background-color: #f3f4f6; padding: 10px; border-radius: 4px;">
              ${escapeHtml(verificationLink)}
            </p>
            
            <div class="warning">
              <strong>⚠️ 安全提示：</strong>此链接将在24小时后过期。如果您没有注册此账户，请忽略此邮件。
            </div>
            
            <div class="footer">
              <p>此邮件由 ClassClicker 自动发送，请勿直接回复。</p>
              <p>如有问题，请访问我们的支持页面。</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * 生成邮箱验证邮件纯文本内容
 * @param userName 用户名
 * @param verificationLink 验证链接
 * @returns 纯文本邮件内容
 */
export function generateVerificationEmailText(
  userName: string,
  verificationLink: string
): string {
  return `
欢迎来到 ClassClicker

您好 ${userName},

感谢您注册 ClassClicker 账户！为了完成注册过程，请验证您的邮箱地址。

请访问以下链接验证您的邮箱：
${verificationLink}

此链接将在24小时后过期。

安全提示：请勿与他人分享此链接。

如果您没有注册此账户，请忽略此邮件。

此邮件由 ClassClicker 自动发送，请勿直接回复。
  `.trim();
}

/**
 * 转义HTML特殊字符，防止XSS
 * @param text 要转义的文本
 * @returns 转义后的文本
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
