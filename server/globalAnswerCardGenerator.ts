import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { storageGet, storageObjectExists, storagePut } from "./storage";

/**
 * 生成唯一的识别图案（基于卡号的哈希）
 */
function generateUniquePattern(cardNumber: number): string {
  const hash = ((cardNumber * 31) * 17) % 256;
  return hash.toString(16).padStart(2, "0");
}

/**
 * 生成单张答题卡的 QR 码
 */
async function generateQRCode(cardNumber: number): Promise<Buffer> {
  const qrData = `card:${cardNumber}`;
  const qrImage = await QRCode.toBuffer(qrData, {
    errorCorrectionLevel: "H",
    type: "png",
    width: 200,
    margin: 1,
  });
  return qrImage;
}

/**
 * 生成单张答题卡 PDF
 */
export async function generateSingleGlobalCard(
  cardNumber: number
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: "Letter",
        margin: 40,
      });

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // 标题
      doc.fontSize(24).text("ClassClicker Answer Card", { align: "left" });
      doc.moveDown(0.5);

      // 卡号信息
      doc.fontSize(20).text(`Card Number: ${cardNumber}`, { align: "center" });
      doc.moveDown(1);

      // 生成 QR 码
      const qrBuffer = await generateQRCode(cardNumber);
      doc.image(qrBuffer, doc.page.width - 40 - 120, doc.page.height - 40 - 120 - 120, {
        width: 120,
        height: 120,
      });

      // 绘制方向标记（四个角）
      const markerSize = 20;
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;

      // 左上角 - A
      doc.rect(40, 40, markerSize, markerSize).stroke("#0064C8");
      doc.fontSize(12).fillColor("#0064C8").text("A", 40 + 6, 40 + 4);

      // 右上角 - B
      doc.rect(pageWidth - 40 - markerSize, 40, markerSize, markerSize).stroke("#0064C8");
      doc.fontSize(12).fillColor("#0064C8").text("B", pageWidth - 40 - markerSize + 6, 40 + 4);

      // 左下角 - D
      doc.rect(40, pageHeight - 40 - markerSize, markerSize, markerSize).stroke("#0064C8");
      doc.fontSize(12).fillColor("#0064C8").text("D", 40 + 6, pageHeight - 40 - markerSize + 4);

      // 右下角 - C
      doc.rect(pageWidth - 40 - markerSize, pageHeight - 40 - markerSize, markerSize, markerSize).stroke("#0064C8");
      doc.fontSize(12).fillColor("#0064C8").text("C", pageWidth - 40 - markerSize + 6, pageHeight - 40 - markerSize + 4);

      // 绘制答题区域（4个选项）
      doc.moveDown(2);
      const optionSpacing = 60;
      const optionsLabels = ["A", "B", "C", "D"];
      let yPosition = doc.y;

      for (let i = 0; i < optionsLabels.length; i++) {
        const label = optionsLabels[i];
        const circleX = 80;
        const circleY = yPosition + i * optionSpacing;

        // 绘制圆形选项框
        doc.circle(circleX, circleY, 15).stroke("#000000");

        // 标签
        doc.fontSize(14).text(label, circleX + 30, circleY - 5);
      }

      // 唯一识别码（隐藏在底部）
      const uniquePattern = generateUniquePattern(cardNumber);
      doc.fontSize(8).fillColor("#999999").text(`ID: ${uniquePattern}`, 40, pageHeight - 40 - 10);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 生成全部答题卡 PDF（1-80号）
 */
export async function generateAllGlobalCards(): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: "Letter",
        margin: 40,
      });

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("error", reject);

      let isFirstPage = true;

      for (let cardNumber = 1; cardNumber <= 80; cardNumber++) {
        if (!isFirstPage) {
          doc.addPage();
        }
        isFirstPage = false;

        // 标题
        doc.fontSize(24).text("ClassClicker Answer Card", { align: "left" });
        doc.moveDown(0.5);

        // 卡号信息
        doc.fontSize(20).text(`Card Number: ${cardNumber}`, { align: "center" });
        doc.moveDown(1);

        // 生成 QR 码
        const qrBuffer = await generateQRCode(cardNumber);
        doc.image(qrBuffer, doc.page.width - 40 - 120, doc.page.height - 40 - 120 - 120, {
          width: 120,
          height: 120,
        });

        // 绘制方向标记（四个角）
        const markerSize = 20;
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;

        // 左上角 - A
        doc.rect(40, 40, markerSize, markerSize).stroke("#0064C8");
        doc.fontSize(12).fillColor("#0064C8").text("A", 40 + 6, 40 + 4);

        // 右上角 - B
        doc.rect(pageWidth - 40 - markerSize, 40, markerSize, markerSize).stroke("#0064C8");
        doc.fontSize(12).fillColor("#0064C8").text("B", pageWidth - 40 - markerSize + 6, 40 + 4);

        // 左下角 - D
        doc.rect(40, pageHeight - 40 - markerSize, markerSize, markerSize).stroke("#0064C8");
        doc.fontSize(12).fillColor("#0064C8").text("D", 40 + 6, pageHeight - 40 - markerSize + 4);

        // 右下角 - C
        doc.rect(pageWidth - 40 - markerSize, pageHeight - 40 - markerSize, markerSize, markerSize).stroke("#0064C8");
        doc.fontSize(12).fillColor("#0064C8").text("C", pageWidth - 40 - markerSize + 6, pageHeight - 40 - markerSize + 4);

        // 绘制答题区域（4个选项）
        doc.moveDown(2);
        const optionSpacing = 60;
        const optionsLabels = ["A", "B", "C", "D"];
        let yPosition = doc.y;

        for (let i = 0; i < optionsLabels.length; i++) {
          const label = optionsLabels[i];
          const circleX = 80;
          const circleY = yPosition + i * optionSpacing;

          // 绘制圆形选项框
          doc.circle(circleX, circleY, 15).stroke("#000000");

          // 标签
          doc.fontSize(14).text(label, circleX + 30, circleY - 5);
        }

        // 唯一识别码（隐藏在底部）
        const uniquePattern = generateUniquePattern(cardNumber);
        doc.fontSize(8).fillColor("#999999").text(`ID: ${uniquePattern}`, 40, pageHeight - 40 - 10);
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 获取或生成全局答题卡（缓存机制）
 */
const GLOBAL_CARDS_CACHE_KEY = "answer-cards/global/all-cards.pdf";

/** Public callers may retrieve this link only after an authenticated generation. */
export async function getCachedGlobalCards(): Promise<string | null> {
  if (!(await storageObjectExists(GLOBAL_CARDS_CACHE_KEY))) return null;
  const result = await storageGet(GLOBAL_CARDS_CACHE_KEY);
  return result.url;
}

/** Call only from an authenticated, persistently locked generation procedure. */
export async function generateGlobalCards(): Promise<string> {
  const buffer = await generateAllGlobalCards();
  const result = await storagePut(GLOBAL_CARDS_CACHE_KEY, buffer, "application/pdf");
  return result.url;
}
