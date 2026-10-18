import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

/**
 * Plickers 风格的答题卡生成器
 * 
 * 设计逻辑：
 * - 中间 5×5 网格（25 个方块）用于编码卡号和方向
 * - 中心位置始终缺失（白色）
 * - 其他 24 个位置的黑色方块缺失与否编码卡号
 * - 四个角 + 四个边中点用于方向识别
 * - 顶部标签根据卡号的二进制表示变化
 * - A/B/C/D 标签标注在中间网格的四个方向旁边
 */

interface CardPattern {
  cardNumber: number;
  topLabel: 'A' | 'B' | 'C' | 'D';
  pattern: boolean[]; // 25 个位置的黑色方块标志
}

/**
 * 根据卡号生成顶部标签
 * 基于 Plickers 的规律分析
 */
function generateTopLabel(cardNumber: number): 'A' | 'B' | 'C' | 'D' {
  const binaryValue = cardNumber - 1; // 0-79
  
  // 提取二进制位
  const bit0 = (binaryValue >> 0) & 1;
  const bit1 = (binaryValue >> 1) & 1;
  const bit2 = (binaryValue >> 2) & 1;
  const bit3 = (binaryValue >> 3) & 1;
  const bit4 = (binaryValue >> 4) & 1;
  
  // 根据 Plickers 的规律生成标签
  const lastTwoBits = bit0 | (bit1 << 1);
  
  let label: 'A' | 'B' | 'C' | 'D' = 'B';
  
  // 根据高位调整标签
  if (bit4 === 1) {
    if (bit3 === 1) {
      label = 'A';
    } else if (bit2 === 0) {
      label = 'A';
    } else {
      label = 'B';
    }
  } else {
    if (bit3 === 1 && bit2 === 1) {
      label = 'C';
    } else if (lastTwoBits === 0 || lastTwoBits === 1) {
      label = 'D';
    } else if (lastTwoBits === 2) {
      label = 'B';
    } else {
      label = 'B';
    }
  }
  
  return label;
}

/**
 * 根据卡号生成卡片的编码模式
 */
function generateCardPattern(cardNumber: number): CardPattern {
  // 卡号范围 1-80
  if (cardNumber < 1 || cardNumber > 80) {
    throw new Error(`Card number must be between 1 and 80, got ${cardNumber}`);
  }

  // 使用卡号的二进制表示来生成编码
  const binaryValue = cardNumber - 1; // 0-79
  
  // 生成 25 个位置的黑色方块标志
  const pattern: boolean[] = new Array(25).fill(false);
  
  // 中心位置（12）始终缺失
  pattern[12] = false;
  
  // 四个角 + 四个边中点用于方向识别（都设为缺失）
  const directionPositions = [0, 4, 20, 24, 2, 10, 14, 22];
  for (const pos of directionPositions) {
    pattern[pos] = false;
  }
  
  // 其他 16 个位置用于编码卡号
  const codePositions = Array.from({ length: 25 }, (_, i) => i).filter(
    (i) => !directionPositions.includes(i) && i !== 12
  );
  
  // 使用卡号的二进制表示填充这些位置
  for (let i = 0; i < codePositions.length && i < 16; i++) {
    const bit = (binaryValue >> i) & 1;
    pattern[codePositions[i]] = bit === 1;
  }

  const topLabel = generateTopLabel(cardNumber);
  return { cardNumber, topLabel, pattern };
}

/**
 * 绘制单张答题卡
 */
function drawCard(doc: any, cardPattern: CardPattern, pageWidth: number, pageHeight: number): void {
  const margin = 40;
  
  // 绘制背景（白色）
  doc.fillColor('white').rect(0, 0, pageWidth, pageHeight).fill();

  // 绘制顶部标签
  doc.fontSize(10).fillColor('gray');
  doc.text('version 1', margin + 20, margin + 15);
  
  doc.fontSize(16).fillColor('black').font('Helvetica-Bold');
  
  
  doc.text(cardPattern.cardNumber.toString(), pageWidth - margin - 50, margin + 12);

  // 绘制左边标签（竖向）
  doc.fontSize(8).fillColor('gray');
  doc.save();
  doc.rotate(-90, margin + 10, pageHeight / 2);
  doc.text('www.plickers.com', -pageHeight / 2 + 50, margin + 5);
  doc.restore();

  // 中间的 5×5 黑色方块网格
  const blockSize = 30;
  const gridSpacing = 32;
  const gridWidth = blockSize * 5;
  const gridHeight = blockSize * 5;
  const gridX = (pageWidth - gridWidth) / 2;
  const gridY = (pageHeight - gridHeight) / 2;

  // 绘制 A/B/C/D 标签在网格的四个方向
  const labelDistance = 50;
  doc.fontSize(14).fillColor('black').font('Helvetica-Bold');
  
  // 上方标签 (A)
  doc.text('A', gridX + gridWidth / 2 - 8, gridY - labelDistance);
  
  // 下方标签 (D)
  doc.text('D', gridX + gridWidth / 2 - 8, gridY + gridHeight + labelDistance - 20);
  
  // 左方标签 (B)
  doc.text('B', gridX - labelDistance - 15, gridY + gridHeight / 2 - 10);
  
  // 右方标签 (C)
  doc.text('C', gridX + gridWidth + labelDistance - 5, gridY + gridHeight / 2 - 10);

  // 绘制网格
  for (let i = 0; i < 25; i++) {
    const row = Math.floor(i / 5);
    const col = i % 5;
    const x = gridX + col * gridSpacing;
    const y = gridY + row * gridSpacing;

    if (cardPattern.pattern[i]) {
      // 黑色方块（完全填充）
      doc.fillColor('black').rect(x, y, blockSize, blockSize).fill();
    } else {
      // 白色方块（缺失）- 只绘制边框
      doc.strokeColor('black').lineWidth(1);
      doc.rect(x, y, blockSize, blockSize).stroke();
    }
  }
}

/**
 * 生成单张答题卡 PDF 并返回 Buffer
 */
export async function generateSingleCard(cardNumber: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'Letter',
        margin: 0,
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const cardPattern = generateCardPattern(cardNumber);
      drawCard(doc, cardPattern, 612, 792);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 生成单张答题卡 PDF 并写入文件系统（保留用于向后兼容）
 */
export async function generateSingleCardToFile(cardNumber: number, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'Letter',
        margin: 0,
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      const cardPattern = generateCardPattern(cardNumber);
      drawCard(doc, cardPattern, 612, 792);

      doc.end();

      stream.on('finish', () => {
        resolve();
      });

      stream.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 生成全部答题卡 PDF 并返回 Buffer
 */
export async function generateAllCards(cardCount: number = 80): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'Letter',
        margin: 0,
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      for (let i = 1; i <= cardCount; i++) {
        if (i > 1) {
          doc.addPage();
        }

        const cardPattern = generateCardPattern(i);
        drawCard(doc, cardPattern, 612, 792);
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 生成全部答题卡 PDF 并写入文件系统（保留用于向后兼容）
 */
export async function generateAllCardsToFile(outputPath: string, cardCount: number = 80): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'Letter',
        margin: 0,
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      for (let i = 1; i <= cardCount; i++) {
        if (i > 1) {
          doc.addPage();
        }

        const cardPattern = generateCardPattern(i);
        drawCard(doc, cardPattern, 612, 792);
      }

      doc.end();

      stream.on('finish', () => {
        resolve();
      });

      stream.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 批量生成答题卡文件（保留用于向后兼容）
 */
export async function generateBatchAnswerCards(outputDir: string, cardCount: number = 80): Promise<void> {
  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 生成全部卡片的 PDF
  const allCardsPath = path.join(outputDir, 'all-cards.pdf');
  await generateAllCardsToFile(allCardsPath, cardCount);

  // 生成单张卡片的 PDF
  for (let i = 1; i <= cardCount; i++) {
    const cardPath = path.join(outputDir, `card-${i}.pdf`);
    await generateSingleCardToFile(i, cardPath);
  }

  console.log(`✓ 全部 ${cardCount} 张卡片生成成功`);
  console.log(`  文件大小: ${(fs.statSync(allCardsPath).size / 1024).toFixed(2)} KB`);
  console.log(`  平均每张: ${(fs.statSync(allCardsPath).size / cardCount / 1024).toFixed(2)} KB`);
  console.log(`  文件路径: ${allCardsPath}`);
}
