import crypto from 'crypto';

const secretId = process.env.TENCENT_SECRET_ID;
const secretKey = process.env.TENCENT_SECRET_KEY;
const region = process.env.TENCENT_SES_REGION || 'ap-hongkong';
const senderEmail = process.env.SENDER_EMAIL;

console.log('Testing Tencent Cloud SES API with JSON TemplateData...');

if (!secretId || !secretKey || !senderEmail) {
  console.error('Missing required environment variables');
  process.exit(1);
}

function getTencentCloudSignature(secretKey, timestamp, date, service, stringToSign) {
  const kDate = crypto.createHmac('sha256', `TC3${secretKey}`).update(date).digest();
  const kService = crypto.createHmac('sha256', kDate).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('tc3_request').digest();
  return crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
}

async function sendTestEmail() {
  const service = 'ses';
  const host = 'ses.tencentcloudapi.com';
  const action = 'SendEmail';
  const version = '2020-10-02';
  const algorithm = 'TC3-HMAC-SHA256';

  // 使用JSON对象格式的TemplateData
  const payload = {
    FromEmailAddress: senderEmail,
    Destination: ['kylienelsonbv4846@gmail.com'],
    Subject: 'ClassClicker 邮箱验证',
    Template: {
      TemplateID: 168247,
      TemplateData: JSON.stringify({ code: 'ABC123' }),
    },
  };

  const payloadStr = JSON.stringify(payload);
  const hashedPayload = crypto.createHash('sha256').update(payloadStr).digest('hex');

  const now = new Date();
  const timestamp = Math.floor(now.getTime() / 1000).toString();
  const date = now.toISOString().split('T')[0];

  const canonicalRequest = [
    'POST',
    '/',
    '',
    `content-type:application/json\nhost:${host}\n`,
    'content-type;host',
    hashedPayload,
  ].join('\n');

  const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');

  const stringToSign = [
    algorithm,
    timestamp,
    `${date}/${service}/tc3_request`,
    hashedCanonicalRequest,
  ].join('\n');

  const signature = getTencentCloudSignature(secretKey, timestamp, date, service, stringToSign);

  const authorization = [
    `${algorithm} Credential=${secretId}/${date}/${service}/tc3_request`,
    `SignedHeaders=content-type;host`,
    `Signature=${signature}`,
  ].join(', ');

  console.log('\nSending template email...');
  console.log('TemplateData:', { code: 'ABC123' });

  try {
    const response = await fetch(`https://${host}/`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
        Host: host,
        'X-TC-Action': action,
        'X-TC-Timestamp': timestamp,
        'X-TC-Version': version,
        'X-TC-Region': region,
      },
      body: payloadStr,
    });

    const responseData = await response.json();

    console.log('\nResponse Status:', response.status);
    console.log('Response:', JSON.stringify(responseData, null, 2));

    if (responseData.Response?.Error) {
      console.error('\n❌ API Error:', responseData.Response.Error.Code);
      console.error('Message:', responseData.Response.Error.Message);
      return false;
    }

    if (responseData.Response?.MessageId) {
      console.log('\n✅ Email sent successfully!');
      console.log('MessageId:', responseData.Response.MessageId);
      return true;
    }

    return false;
  } catch (error) {
    console.error('\nError:', error.message);
    return false;
  }
}

sendTestEmail().then(success => {
  process.exit(success ? 0 : 1);
});
