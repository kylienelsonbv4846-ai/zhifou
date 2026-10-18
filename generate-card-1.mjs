import { generateSingleAnswerCard } from './server/answerCardGenerator.ts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, 'public/answer-cards');

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 只生成卡片 1
async function generateCard1() {
  console.log('生成卡片 1...');
  
  try {
    const buffer = await generateSingleAnswerCard({ cardNumber: 1 });
    const filePath = path.join(outputDir, `card-1.pdf`);
    fs.writeFileSync(filePath, buffer);
    
    const stats = fs.statSync(filePath);
    console.log(`✓ 卡片 1 生成成功`);
    console.log(`  文件大小: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`  文件路径: ${filePath}`);
  } catch (error) {
    console.error(`✗ 生成卡片 1 失败:`, error);
  }
}

generateCard1();
