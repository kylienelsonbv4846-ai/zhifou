import { sendTemplateEmail } from './server/_core/email.ts';

// 测试模板邮件发送
const result = await sendTemplateEmail({
  to: 'kylienelsonbv4846@gmail.com',
  templateId: 168247,
  templateData: {
    code: 'ABC123',
  },
});

console.log('Template email send result:', result);
