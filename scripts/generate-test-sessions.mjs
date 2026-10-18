import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// 用户ID
const teacherId = 1;

// 班级和题集配置
const testConfigs = [
  {
    classId: 191,
    setId: 1,
    sessionName: '测试会话1 - 班级191题集1',
  },
  {
    classId: 60027,
    setId: 1,
    sessionName: '测试会话2 - 班级60027题集1',
  },
];

// 获取班级的所有学生
async function getStudentsByClass(classId) {
  const [rows] = await connection.execute(
    'SELECT id, name FROM students WHERE classId = ?',
    [classId]
  );
  return rows;
}

// 获取题集的所有题目
async function getQuestionsBySet(setId) {
  const [rows] = await connection.execute(
    'SELECT id, correctAnswer FROM questions WHERE setId = ? ORDER BY id',
    [setId]
  );
  return rows;
}

// 根据正确答案生成答案，有70%概率答对
function getRandomAnswer(correctAnswer) {
  const answers = ['A', 'B', 'C', 'D'];
  // 70% 概率答对
  if (Math.random() < 0.7) {
    return correctAnswer;
  }
  // 30% 概率答错，随机选择其他选项
  const wrongAnswers = answers.filter(a => a !== correctAnswer);
  return wrongAnswers[Math.floor(Math.random() * wrongAnswers.length)];
}

// 生成一个会话
async function generateSession(config) {
  console.log(`\n生成会话: ${config.sessionName}`);
  
  try {
    // 1. 创建会话
    const [sessionResult] = await connection.execute(
      'INSERT INTO sessions (teacherId, classId, setId, status, startedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, NOW(), NOW(), NOW())',
      [teacherId, config.classId, config.setId, 'active']
    );
    const sessionId = sessionResult.insertId;
    console.log(`✓ 创建会话 ID: ${sessionId}`);

    // 2. 获取班级学生和题集题目
    const students = await getStudentsByClass(config.classId);
    const questions = await getQuestionsBySet(config.setId);

    console.log(`  班级学生数: ${students.length}`);
    console.log(`  题集题目数: ${questions.length}`);

    // 3. 为每个题目添加到会话队列
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      await connection.execute(
        'INSERT INTO sessionQueue (sessionId, questionId, orderIndex, isActive, createdAt) VALUES (?, ?, ?, ?, NOW())',
        [sessionId, question.id, i, i === 0 ? true : false]
      );
    }
    console.log(`✓ 添加 ${questions.length} 道题目到会话队列`);

    // 4. 为每个学生添加随机答案
    let totalAnswers = 0;
    for (const student of students) {
      for (const question of questions) {
        const answer = getRandomAnswer(question.correctAnswer);
        const isCorrect = answer === question.correctAnswer;
        
        await connection.execute(
          'INSERT INTO answers (sessionId, questionId, studentId, answer, isCorrect, answeredAt, createdAt) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
          [sessionId, question.id, student.id, answer, isCorrect ? 1 : 0]
        );
        totalAnswers++;
      }
    }
    console.log(`✓ 添加 ${totalAnswers} 条答题记录 (${students.length} 个学生 × ${questions.length} 道题目)`);

    // 5. 更新会话状态为已完成
    await connection.execute(
      'UPDATE sessions SET status = ?, completedAt = NOW() WHERE id = ?',
      ['completed', sessionId]
    );
    console.log(`✓ 会话状态更新为已完成`);

    return sessionId;
  } catch (error) {
    console.error(`✗ 生成会话失败:`, error.message);
    throw error;
  }
}

// 主函数
async function main() {
  try {
    console.log('开始生成测试会话数据...\n');
    
    const sessionIds = [];
    for (const config of testConfigs) {
      const sessionId = await generateSession(config);
      sessionIds.push(sessionId);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✓ 测试数据生成完成！');
    console.log('生成的会话 ID:', sessionIds.join(', '));
    console.log('='.repeat(50));

  } catch (error) {
    console.error('生成测试数据失败:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
