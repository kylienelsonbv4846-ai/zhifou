import crypto from "crypto";

/**
 * 邮件发送选项 - 支持自定义内容或模板
 */
export interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

/**
 * 模板邮件发送选项
 */
export interface TemplateEmailOptions {
  to: string;
  templateId: number;
  templateData: Record<string, string>;
}

/**
 * 发送邮件 - 使用腾讯云SES服务
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    console.log(`[Email] Sending email to ${options.to}`);
    console.log(`[Email] Subject: ${options.subject}`);
    console.log(`[Email] Using Tencent Cloud SES`);

    // 使用腾讯云SES服务
    return await sendEmailViaTencentCloud(options);
  } catch (error) {
    console.error("[Email] Failed to send email:", error);
    return false;
  }
}

/**
 * 发送模板邮件 - 使用腾讯云SES模板
 */
export async function sendTemplateEmail(options: TemplateEmailOptions): Promise<boolean> {
  try {
    console.log(`[Email] Sending template email to ${options.to}`);
    console.log(`[Email] Template ID: ${options.templateId}`);
    console.log(`[Email] Using Tencent Cloud SES Template`);

    return await sendTemplateEmailViaTencentCloud(options);
  } catch (error) {
    console.error("[Email] Failed to send template email:", error);
    return false;
  }
}

/**
 * 腾讯云API v3签名
 */
function getTencentCloudSignature(
  secretKey: string,
  timestamp: string,
  date: string,
  service: string,
  stringToSign: string
): string {
  const kDate = crypto
    .createHmac("sha256", `TC3${secretKey}`)
    .update(date)
    .digest();
  const kService = crypto.createHmac("sha256", kDate).update(service).digest();
  const kSigning = crypto
    .createHmac("sha256", kService)
    .update("tc3_request")
    .digest();
  return crypto.createHmac("sha256", kSigning).update(stringToSign).digest("hex");
}

/**
 * 发送邮件 - 使用腾讯云SES（Simple Email Service）
 * 通过HTTP API直接调用，避免SDK连接问题
 */
export async function sendEmailViaTencentCloud(
  options: EmailOptions
): Promise<boolean> {
  try {
    const secretId = process.env.TENCENT_SECRET_ID;
    const secretKey = process.env.TENCENT_SECRET_KEY;
    const region = process.env.TENCENT_SES_REGION || "ap-hongkong";
    const senderEmail = process.env.SENDER_EMAIL;

    if (!secretId || !secretKey || !senderEmail) {
      console.error(
        "[Tencent Cloud] Missing required environment variables:",
        {
          hasSecretId: !!secretId,
          hasSecretKey: !!secretKey,
          hasSenderEmail: !!senderEmail,
        }
      );
      return false;
    }

    console.log(`[Tencent Cloud] Sending email via SES HTTP API`);
    console.log(`[Tencent Cloud] From: ${senderEmail}`);
    console.log(`[Tencent Cloud] To: ${options.to}`);
    console.log(`[Tencent Cloud] Region: ${region}`);

    // 准备请求参数
    const service = "ses";
    const host = "ses.tencentcloudapi.com";
    const action = "SendEmail";
    const version = "2020-10-02";
    const algorithm = "TC3-HMAC-SHA256";

    // 创建请求体
    // 根据腾讯云文档，HTML和TEXT内容需要放在Simple对象中
    // 且需要进行Base64编码
    const htmlContent = options.html || "";
    const textContent =
      options.text || options.html?.replace(/<[^>]*>/g, "") || "";

    const payload = {
      FromEmailAddress: senderEmail,
      Destination: [options.to],
      Subject: options.subject,
      Simple: {
        Html: Buffer.from(htmlContent).toString("base64"),
        Text: Buffer.from(textContent).toString("base64"),
      },
    };

    const payloadStr = JSON.stringify(payload);
    const hashedPayload = crypto
      .createHash("sha256")
      .update(payloadStr)
      .digest("hex");

    // 获取当前时间
    const now = new Date();
    const timestamp = Math.floor(now.getTime() / 1000).toString();
    const date = now.toISOString().split("T")[0];

    // 创建规范请求
    const canonicalRequest = [
      "POST",
      "/",
      "",
      `content-type:application/json\nhost:${host}\n`,
      "content-type;host",
      hashedPayload,
    ].join("\n");

    const hashedCanonicalRequest = crypto
      .createHash("sha256")
      .update(canonicalRequest)
      .digest("hex");

    // 创建待签名字符串
    const stringToSign = [
      algorithm,
      timestamp,
      `${date}/${service}/tc3_request`,
      hashedCanonicalRequest,
    ].join("\n");

    // 计算签名
    const signature = getTencentCloudSignature(
      secretKey,
      timestamp,
      date,
      service,
      stringToSign
    );

    // 创建授权头
    const authorization = [
      `${algorithm} Credential=${secretId}/${date}/${service}/tc3_request`,
      `SignedHeaders=content-type;host`,
      `Signature=${signature}`,
    ].join(", ");

    // 发送请求
    const response = await fetch(`https://${host}/`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
        Host: host,
        "X-TC-Action": action,
        "X-TC-Timestamp": timestamp,
        "X-TC-Version": version,
        "X-TC-Region": region,
      },
      body: payloadStr,
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(
        `[Tencent Cloud] Failed to send email: ${response.status}`,
        JSON.stringify(responseData)
      );
      return false;
    }

    // 检查响应中是否有错误
    if (responseData.Response?.Error) {
      console.error(
        `[Tencent Cloud] API Error: ${responseData.Response.Error.Code}`,
        responseData.Response.Error.Message
      );
      return false;
    }

    console.log(`[Tencent Cloud] Email sent successfully`);
    if (responseData.Response?.MessageId) {
      console.log(`[Tencent Cloud] MessageId: ${responseData.Response.MessageId}`);
    }

    return true;
  } catch (error) {
    console.error("[Tencent Cloud] Failed to send email:", error);
    if (error instanceof Error) {
      console.error("[Tencent Cloud] Error message:", error.message);
    }
    return false;
  }
}

/**
 * 发送模板邮件 - 使用腾讯云SES模板
 */
async function sendTemplateEmailViaTencentCloud(
  options: TemplateEmailOptions
): Promise<boolean> {
  try {
    const secretId = process.env.TENCENT_SECRET_ID;
    const secretKey = process.env.TENCENT_SECRET_KEY;
    const region = process.env.TENCENT_SES_REGION || "ap-hongkong";
    const senderEmail = process.env.SENDER_EMAIL;

    if (!secretId || !secretKey || !senderEmail) {
      console.error(
        "[Tencent Cloud] Missing required environment variables for template email"
      );
      return false;
    }

    console.log(`[Tencent Cloud] Sending template email via SES HTTP API`);
    console.log(`[Tencent Cloud] From: ${senderEmail}`);
    console.log(`[Tencent Cloud] To: ${options.to}`);
    console.log(`[Tencent Cloud] Template ID: ${options.templateId}`);
    console.log(`[Tencent Cloud] Region: ${region}`);

    // 准备请求参数
    const service = "ses";
    const host = "ses.tencentcloudapi.com";
    const action = "SendEmail";
    const version = "2020-10-02";
    const algorithm = "TC3-HMAC-SHA256";

    // 构建模板参数（作为JSON对象）
    const payload = {
      FromEmailAddress: senderEmail,
      Destination: [options.to],
      Subject: "ClassClicker 邮箱验证",
      Template: {
        TemplateID: options.templateId,
        TemplateData: JSON.stringify(options.templateData),
      },
    };

    const payloadStr = JSON.stringify(payload);
    const hashedPayload = crypto
      .createHash("sha256")
      .update(payloadStr)
      .digest("hex");

    // 获取当前时间
    const now = new Date();
    const timestamp = Math.floor(now.getTime() / 1000).toString();
    const date = now.toISOString().split("T")[0];

    // 创建规范请求
    const canonicalRequest = [
      "POST",
      "/",
      "",
      `content-type:application/json\nhost:${host}\n`,
      "content-type;host",
      hashedPayload,
    ].join("\n");

    const hashedCanonicalRequest = crypto
      .createHash("sha256")
      .update(canonicalRequest)
      .digest("hex");

    // 创建待签名字符串
    const stringToSign = [
      algorithm,
      timestamp,
      `${date}/${service}/tc3_request`,
      hashedCanonicalRequest,
    ].join("\n");

    // 计算签名
    const signature = getTencentCloudSignature(
      secretKey,
      timestamp,
      date,
      service,
      stringToSign
    );

    // 创建授权头
    const authorization = [
      `${algorithm} Credential=${secretId}/${date}/${service}/tc3_request`,
      `SignedHeaders=content-type;host`,
      `Signature=${signature}`,
    ].join(", ");

    // 发送请求
    const response = await fetch(`https://${host}/`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
        Host: host,
        "X-TC-Action": action,
        "X-TC-Timestamp": timestamp,
        "X-TC-Version": version,
        "X-TC-Region": region,
      },
      body: payloadStr,
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(
        `[Tencent Cloud] Failed to send template email: ${response.status}`,
        JSON.stringify(responseData)
      );
      return false;
    }

    // 检查响应中是否有错误
    if (responseData.Response?.Error) {
      console.error(
        `[Tencent Cloud] API Error: ${responseData.Response.Error.Code}`,
        responseData.Response.Error.Message
      );
      return false;
    }

    console.log(`[Tencent Cloud] Template email sent successfully`);
    if (responseData.Response?.MessageId) {
      console.log(`[Tencent Cloud] MessageId: ${responseData.Response.MessageId}`);
    }

    return true;
  } catch (error) {
    console.error("[Tencent Cloud] Failed to send template email:", error);
    if (error instanceof Error) {
      console.error("[Tencent Cloud] Error message:", error.message);
    }
    return false;
  }
}

/**
 * 发送邮件 - 使用SendGrid（第三方服务备选方案）
 * 需要设置 SENDGRID_API_KEY 环境变量
 */
export async function sendEmailViaSendGrid(
  options: EmailOptions
): Promise<boolean> {
  try {
    const sendGridApiKey = process.env.SENDGRID_API_KEY;
    if (!sendGridApiKey) {
      console.error(
        "[SendGrid] SENDGRID_API_KEY environment variable not set"
      );
      return false;
    }

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendGridApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: options.to }],
          },
        ],
        from: { email: process.env.SENDER_EMAIL || "noreply@example.com" },
        subject: options.subject,
        content: [
          {
            type: "text/html",
            value: options.html || "",
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error(
        `[SendGrid] Failed to send email: ${response.status}`,
        await response.text()
      );
      return false;
    }

    console.log("[SendGrid] Email sent successfully");
    return true;
  } catch (error) {
    console.error("[SendGrid] Failed to send email:", error);
    return false;
  }
}
