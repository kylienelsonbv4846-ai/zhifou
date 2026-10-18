import crypto from "crypto";

/**
 * 生成密码重置验证码 - 6位数字/字母组合
 */
export function generatePasswordResetCode(): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return code;
}

/**
 * 获取验证码过期时间 - 10分钟后
 */
export function getCodeExpirationTime(): Date {
  const now = new Date();
  return new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes
}

/**
 * 检查验证码是否已过期
 */
export function isCodeExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * 生成密码重置邮件HTML内容
 */
export function generatePasswordResetEmailHTML(
  email: string,
  code: string
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .content {
            padding: 40px 20px;
          }
          .content p {
            margin: 0 0 20px 0;
            line-height: 1.6;
            color: #333;
          }
          .code-box {
            background-color: #f8f9fa;
            border: 2px solid #667eea;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 30px 0;
          }
          .code {
            font-size: 36px;
            font-weight: 700;
            letter-spacing: 4px;
            color: #667eea;
            font-family: 'Courier New', monospace;
          }
          .expiration {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            color: #856404;
            font-size: 14px;
          }
          .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 12px;
            border-top: 1px solid #e0e0e0;
          }
          .footer p {
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 密码重置</h1>
          </div>
          <div class="content">
            <p>您好，</p>
            <p>我们收到了您的密码重置请求。请使用以下验证码重置您的密码：</p>
            
            <div class="code-box">
              <div class="code">${code}</div>
            </div>
            
            <p>验证码有效期为 <strong>10 分钟</strong>。</p>
            
            <div class="expiration">
              ⚠️ 如果您没有请求重置密码，请忽略此邮件。您的账户是安全的。
            </div>
            
            <p>如有问题，请联系我们的支持团队。</p>
            <p>祝好！<br>ClassClicker 团队</p>
          </div>
          <div class="footer">
            <p>© 2026 ClassClicker. All rights reserved.</p>
            <p>此邮件由系统自动发送，请勿直接回复。</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * 生成密码重置邮件纯文本内容
 */
export function generatePasswordResetEmailText(
  email: string,
  code: string
): string {
  return `
ClassClicker 密码重置

您好，

我们收到了您的密码重置请求。请使用以下验证码重置您的密码：

${code}

验证码有效期为 10 分钟。

如果您没有请求重置密码，请忽略此邮件。您的账户是安全的。

如有问题，请联系我们的支持团队。

祝好！
ClassClicker 团队

© 2026 ClassClicker. All rights reserved.
此邮件由系统自动发送，请勿直接回复。
  `.trim();
}
