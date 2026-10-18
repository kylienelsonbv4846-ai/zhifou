import { protectedProcedure, publicProcedure, router } from "./trpc";
import { z } from "zod";
import { generateSingleCard } from "../answerCardGenerator";
import { storagePut } from "../storage";
import { isAnswerCardsInitialized, upsertAnswerCardMetadata } from "../db";
import { withAnswerCardGenerationLock } from "../answerCardGenerationLock";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  // 生成所有答题卡是一次性初始化操作，必须登录且具备幂等保护。
  generateAnswerCards: protectedProcedure.mutation(async () => {
    if (await isAnswerCardsInitialized()) {
      return {
        success: true as const,
        totalGenerated: 0,
        totalErrors: 0,
        cards: [],
        alreadyInitialized: true,
      };
    }

    return withAnswerCardGenerationLock("cards:individual-pdfs", async () => {
      if (await isAnswerCardsInitialized()) {
        return {
          success: true as const,
          totalGenerated: 0,
          totalErrors: 0,
          cards: [],
          alreadyInitialized: true,
        };
      }

      console.log("[System] Starting generation of 80 answer cards...");
      const timestamp = new Date().toISOString().split("T")[0];
      const results: Array<{ cardNumber: number; storageKey: string; storageUrl: string }> = [];
      let successCount = 0;
      let errorCount = 0;

      for (let cardNumber = 1; cardNumber <= 80; cardNumber++) {
        try {
          const buffer = await generateSingleCard(cardNumber);
          const storageKey = `answer-cards/permanent/${timestamp}/card-${cardNumber}.pdf`;
          const { url } = await storagePut(storageKey, buffer, "application/pdf");
          await upsertAnswerCardMetadata(cardNumber, storageKey, url, new Date());
          results.push({ cardNumber, storageKey, storageUrl: url });
          successCount++;
          if (cardNumber % 10 === 0) {
            console.log(`[System] Generated ${cardNumber}/80 cards...`);
          }
        } catch (error) {
          errorCount++;
          console.error(`[System] Failed to generate card ${cardNumber}:`, error);
        }
      }

      console.log(`[System] Generation completed! Success: ${successCount}, Errors: ${errorCount}`);
      return {
        success: true as const,
        totalGenerated: successCount,
        totalErrors: errorCount,
        cards: results,
      };
    });
  }),
});
