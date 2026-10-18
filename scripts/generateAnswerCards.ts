#!/usr/bin/env node

/**
 * 生成所有 80 张答题卡并保存到持久化存储。
 * 用法: pnpm exec tsx scripts/generateAnswerCards.ts
 * 维护脚本与在线初始化共用数据库持久租约锁。
 */

import { generateSingleCard } from "../server/answerCardGenerator";
import { withAnswerCardGenerationLock } from "../server/answerCardGenerationLock";
import { upsertAnswerCardMetadata } from "../server/db";
import { storagePut } from "../server/storage";

async function main() {
  try {
    await withAnswerCardGenerationLock("cards:individual-pdfs", async () => {
      console.log("[AnswerCards] Starting generation of 80 answer cards...");
      console.log("[AnswerCards] This may take several minutes...\n");

      const timestamp = new Date().toISOString().split("T")[0];
      const results: Array<{ cardNumber: number; storageKey: string; storageUrl: string }> = [];
      let successCount = 0;
      let errorCount = 0;

      for (let cardNumber = 1; cardNumber <= 80; cardNumber += 1) {
        try {
          process.stdout.write(
            `\r[AnswerCards] Generating card ${cardNumber}/80... (Success: ${successCount}, Errors: ${errorCount})`
          );
          const buffer = await generateSingleCard(cardNumber);
          const storageKey = `answer-cards/permanent/${timestamp}/card-${cardNumber}.pdf`;
          const { url } = await storagePut(storageKey, buffer, "application/pdf");
          await upsertAnswerCardMetadata(cardNumber, storageKey, url, new Date());
          results.push({ cardNumber, storageKey, storageUrl: url });
          successCount += 1;
        } catch (error) {
          errorCount += 1;
          console.error(`\n[AnswerCards] Failed to generate/upload card ${cardNumber}:`, error);
        }
      }

      console.log("\n\n[AnswerCards] Generation completed!");
      console.log(`[AnswerCards] Total cards generated: ${successCount}/80`);
      if (errorCount > 0) console.log(`[AnswerCards] Errors: ${errorCount}`);
      if (results.length > 0) console.log("[AnswerCards] Sample card:", results[0]);
      process.exitCode = errorCount > 0 ? 1 : 0;
    });
  } catch (error) {
    console.error("[AnswerCards] Fatal error:", error);
    process.exitCode = 1;
  }

  // Exit only after the lease wrapper's finally block has released the lock.
  process.exit(process.exitCode ?? 0);
}

void main();
