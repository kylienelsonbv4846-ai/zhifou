import crypto from "crypto";

export const MAX_VERIFICATION_CODE_ATTEMPTS = 5;

/**
 * 生成6位数字或字母组合的验证码
 * @returns 6位验证码字符串
 */
export function generateVerificationCode(): string {
  // 使用数字和大写字母（避免混淆的字符如0/O, 1/I/l）
  const chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // 32个字符
  let code = "";
  
  // 生成6位验证码
  for (let i = 0; i < 6; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    code += chars[randomIndex];
  }
  
  return code;
}

/**
 * 计算验证码过期时间（10分钟后）
 * @returns 过期时间戳
 */
export function getCodeExpirationTime(): Date {
  const expirationTime = new Date();
  expirationTime.setMinutes(expirationTime.getMinutes() + 10);
  return expirationTime;
}

/**
 * 检查验证码是否过期
 * @param expiresAt 过期时间
 * @returns 是否过期
 */
export function isCodeExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * 生成验证码邮件HTML内容
 * @param userName 用户名
 * @param verificationCode 验证码
 * @returns HTML邮件内容
 */
export function generateVerificationCodeEmailHTML(
  userName: string,
  verificationCode: string
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
          .code-box {
            background-color: #f3f4f6;
            border: 2px solid #4f46e5;
            padding: 20px;
            text-align: center;
            border-radius: 8px;
            margin: 20px 0;
          }
          .code-text {
            font-size: 32px;
            font-weight: bold;
            color: #4f46e5;
            letter-spacing: 4px;
            font-family: 'Courier New', monospace;
          }
          .code-label {
            font-size: 12px;
            color: #666;
            margin-top: 10px;
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
            
            <p>感谢您注册 ClassClicker 账户！为了完成注册过程，请使用以下验证码验证您的邮箱地址。</p>
            
            <p>您的验证码是：</p>
            
            <div class="code-box">
              <div class="code-text">${escapeHtml(verificationCode)}</div>
              <div class="code-label">此验证码将在10分钟后过期</div>
            </div>
            
            <p>请在应用中输入此验证码以完成邮箱验证。</p>
            
            <div class="warning">
              <strong>⚠️ 安全提示：</strong>
              <ul>
                <li>此验证码仅对您有效，请勿与他人分享</li>
                <li>验证码将在10分钟后过期</li>
                <li>如果您没有注册此账户，请忽略此邮件</li>
              </ul>
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
 * 生成验证码邮件纯文本内容
 * @param userName 用户名
 * @param verificationCode 验证码
 * @returns 纯文本邮件内容
 */
export function generateVerificationCodeEmailText(
  userName: string,
  verificationCode: string
): string {
  return `
欢迎来到 ClassClicker

您好 ${userName},

感谢您注册 ClassClicker 账户！为了完成注册过程，请使用以下验证码验证您的邮箱地址。

您的验证码是：${verificationCode}

此验证码将在10分钟后过期。

安全提示：
- 此验证码仅对您有效，请勿与他人分享
- 验证码将在10分钟后过期
- 如果您没有注册此账户，请忽略此邮件

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
