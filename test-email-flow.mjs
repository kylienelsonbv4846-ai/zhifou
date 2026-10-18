const API_URL = 'http://localhost:3000/api/trpc';

async function testEmailFlow() {
  console.log('🧪 开始测试邮件发送流程...\n');
  
  const testEmail = 'kylienelsonbv4846@gmail.com';
  const testName = 'Test User';
  const testPassword = 'TestPassword123!';
  
  try {
    // 1. 注册新账户
    console.log('📝 步骤1: 创建测试账户');
    console.log(`   邮箱: ${testEmail}`);
    console.log(`   名称: ${testName}\n`);
    
    const registerResponse = await fetch(`${API_URL}/auth.register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: {
          email: testEmail,
          name: testName,
          password: testPassword,
        },
      }),
    });
    
    const registerData = await registerResponse.json();
    console.log('📨 注册响应:');
    console.log(JSON.stringify(registerData, null, 2));
    
    if (registerData.result?.data?.success) {
      console.log('\n✅ 账户创建成功！');
      console.log(`   用户ID: ${registerData.result.data.user.id}`);
      console.log(`   邮箱: ${registerData.result.data.user.email}`);
      console.log(`   名称: ${registerData.result.data.user.name}`);
      console.log('\n📧 验证邮件已发送到: ' + testEmail);
      console.log('⏳ 请检查你的邮箱（包括垃圾邮件文件夹）');
    } else if (registerData.result?.error) {
      console.log('\n❌ 注册失败:');
      console.log(JSON.stringify(registerData.result.error, null, 2));
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testEmailFlow();
