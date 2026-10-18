import { generateBatchAnswerCards } from './server/answerCardGenerator.ts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, 'public/answer-cards');

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 生成全部 80 张卡片
async function generateAllCards() {
  console.log('生成全部 80 张答题卡...');
  
  try {
    await generateBatchAnswerCards(outputDir, 80);
    
    const filePath = path.join(outputDir, 'all-cards.pdf');
    const stats = fs.statSync(filePath);
    console.log(`✓ 全部 80 张卡片生成成功`);
    console.log(`  文件大小: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`  平均每张: ${(stats.size / 80 / 1024).toFixed(2)} KB`);
    console.log(`  文件路径: ${filePath}`);
  } catch (error) {
    console.error(`✗ 生成卡片失败:`, error);
  }
}

generateAllCards();
