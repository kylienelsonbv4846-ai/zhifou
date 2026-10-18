/**
 * 答题卡初始化脚本
 * 功能：一次性生成 80 张 Plickers 风格答题卡，保存到持久化存储。
 * 所有写入与在线初始化共用数据库持久租约锁。
 */

import { generateSingleCard } from "../answerCardGenerator";
import { withAnswerCardGenerationLock } from "../answerCardGenerationLock";
import { storagePut } from "../storage";

interface AnswerCardMetadata {
  cardNumber: number;
  storageKey: string;
  storageUrl: string;
  generatedAt: string;
}

/** 生成所有答题卡并保存到持久存储。 */
export async function initializeAnswerCards(): Promise<AnswerCardMetadata[]> {
  return withAnswerCardGenerationLock("cards:individual-pdfs", async () => {
    console.log("[AnswerCards] Starting initialization of 80 answer cards...");
    const metadata: AnswerCardMetadata[] = [];
    const timestamp = new Date().toISOString().split("T")[0];

    try {
      for (let cardNumber = 1; cardNumber <= 80; cardNumber += 1) {
        console.log(`[AnswerCards] Generating card ${cardNumber}/80...`);
        const buffer = await generateSingleCard(cardNumber);
        const storageKey = `answer-cards/permanent/${timestamp}/card-${cardNumber}.pdf`;
        const { url } = await storagePut(storageKey, buffer, "application/pdf");
        metadata.push({
          cardNumber,
          storageKey,
          storageUrl: url,
          generatedAt: new Date().toISOString(),
        });
        console.log(`[AnswerCards] Card ${cardNumber} uploaded: ${url}`);
      }

      console.log("[AnswerCards] All 80 answer cards initialized successfully!");
      return metadata;
    } catch (error) {
      console.error("[AnswerCards] Initialization failed:", error);
      throw error;
    }
  });
}

/**
 * 检查答题卡是否已初始化。
 * 该占位 helper 不用于公共下载或在线生成入口。
 */
export async function areAnswerCardsInitialized(): Promise<boolean> {
  try {
    // Actual metadata verification is implemented in server/db.ts.
    return false;
  } catch (error) {
    console.error("[AnswerCards] Error checking initialization status:", error);
    return false;
  }
}

/** 获取所有答题卡的文件 URL 列表。 */
export async function getAnswerCardUrls(): Promise<Map<number, string>> {
  // TODO: implement from the durable database metadata table.
  return new Map<number, string>();
}
