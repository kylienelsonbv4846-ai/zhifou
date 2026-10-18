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

// 生成卡片 1 和 2
async function generateCards() {
  console.log('生成卡片 1 和 2...');
  
  for (let i = 1; i <= 2; i++) {
    try {
      const buffer = await generateSingleAnswerCard({ cardNumber: i });
      const filePath = path.join(outputDir, `card-${i}.pdf`);
      fs.writeFileSync(filePath, buffer);
      
      const stats = fs.statSync(filePath);
      console.log(`✓ 卡片 ${i} 生成成功 (${(stats.size / 1024).toFixed(2)} KB)`);
    } catch (error) {
      console.error(`✗ 生成卡片 ${i} 失败:`, error);
    }
  }
  
  console.log('完成！');
}

generateCards();
