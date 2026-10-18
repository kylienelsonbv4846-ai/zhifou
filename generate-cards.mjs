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

// 生成 80 张答题卡
async function generateCards() {
  console.log('开始生成答题卡...');
  
  for (let i = 1; i <= 80; i++) {
    try {
      const buffer = await generateSingleAnswerCard({ cardNumber: i });
      const filePath = path.join(outputDir, `card-${i}.pdf`);
      fs.writeFileSync(filePath, buffer);
      if (i % 10 === 0) console.log(`✓ 已生成 ${i}/80 张卡片`);
    } catch (error) {
      console.error(`✗ 生成卡片 ${i} 失败:`, error);
    }
  }
  
  console.log('✓ 完成！');
  
  // 显示文件大小
  const files = fs.readdirSync(outputDir).filter(f => f.startsWith('card-'));
  let totalSize = 0;
  files.forEach(f => {
    const size = fs.statSync(path.join(outputDir, f)).size;
    totalSize += size;
  });
  
  console.log(`总文件数: ${files.length}, 总大小: ${(totalSize / 1024).toFixed(2)} KB`);
}

generateCards();
