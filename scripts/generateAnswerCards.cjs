#!/usr/bin/env node

/**
 * 生成所有80张答题卡并保存到本地持久化目录
 * 使用方法: node scripts/generateAnswerCards.cjs
 */

const path = require('path');
const projectRoot = path.join(__dirname, '..');

// 注册TypeScript支持
require('ts-node').register({
  project: path.join(projectRoot, 'tsconfig.json'),
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
  },
});

const { generateSingleCard } = require(path.join(projectRoot, 'server/answerCardGenerator.ts'));
const { storagePut } = require(path.join(projectRoot, 'server/storage.ts'));
const { upsertAnswerCardMetadata } = require(path.join(projectRoot, 'server/db.ts'));
const { withAnswerCardGenerationLock } = require(path.join(projectRoot, 'server/answerCardGenerationLock.ts'));

async function main() {
  try {
    await withAnswerCardGenerationLock('cards:individual-pdfs', async () => {
    console.log('[AnswerCards] Starting generation of 80 answer cards...');
    console.log('[AnswerCards] This may take several minutes...\n');
    
    const timestamp = new Date().toISOString().split('T')[0];
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (let cardNumber = 1; cardNumber <= 80; cardNumber++) {
      try {
        process.stdout.write(`\r[AnswerCards] Generating card ${cardNumber}/80... (Success: ${successCount}, Errors: ${errorCount})`);
        
        // 生成单张答题卡PDF
        const buffer = await generateSingleCard(cardNumber);
        
        // 保存到本地持久化目录
        const storageKey = `answer-cards/permanent/${timestamp}/card-${cardNumber}.pdf`;
        const { url } = await storagePut(storageKey, buffer, 'application/pdf');
        
        // 保存元数据到数据库
        await upsertAnswerCardMetadata(
          cardNumber,
          storageKey,
          url,
          new Date()
        );
        
        results.push({
          cardNumber,
          storageKey,
          storageUrl: url,
        });
        
        successCount++;
        
      } catch (error) {
        errorCount++;
        console.error(`\n[AnswerCards] Failed to generate/upload card ${cardNumber}:`, error.message);
        // 继续生成其他卡片，不中断
      }
    }
    
    console.log('\n\n[AnswerCards] Generation completed!');
    console.log(`[AnswerCards] Total cards generated: ${successCount}/80`);
    if (errorCount > 0) {
      console.log(`[AnswerCards] Errors: ${errorCount}`);
    }
    
    if (results.length > 0) {
      console.log('[AnswerCards] Sample card:', results[0]);
    }
    
    process.exitCode = errorCount > 0 ? 1 : 0;
    });
    
  } catch (error) {
    console.error('[AnswerCards] Fatal error:', error);
    process.exitCode = 1;
  }
  process.exit(process.exitCode ?? 0);
}

main();
