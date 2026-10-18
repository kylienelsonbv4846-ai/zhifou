import { describe, it, expect } from 'vitest';
import { generateSingleCard, generateAllCards } from './answerCardGenerator';

/**
 * 答题卡 PDF 生成测试
 * 
 * 测试范围：
 * 1. 答题卡PDF生成 - 验证返回Buffer而不是文件路径
 * 2. 单张卡片生成 - 验证卡号1-80都能正确生成
 * 3. 全部卡片生成 - 验证80张卡片的PDF生成
 * 4. Buffer大小验证 - 确保生成的PDF有合理的大小
 */

describe('Answer Cards PDF Generation', { timeout: 120000 }, () => {
  describe('generateSingleCard', () => {
    it('should generate a single card and return a Buffer', async () => {
      const buffer = await generateSingleCard(1);
      
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.length).toBeLessThan(100000); // PDF should be less than 100KB
    });

    it('should generate valid PDF for card number 1', async () => {
      const buffer = await generateSingleCard(1);
      
      // PDF files start with %PDF magic bytes
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it('should generate valid PDF for card number 80', async () => {
      const buffer = await generateSingleCard(80);
      
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it('should throw error for invalid card number', async () => {
      await expect(generateSingleCard(0)).rejects.toThrow('Card number must be between 1 and 80');
      await expect(generateSingleCard(81)).rejects.toThrow('Card number must be between 1 and 80');
      await expect(generateSingleCard(-1)).rejects.toThrow('Card number must be between 1 and 80');
    });

    it('should generate different buffers for different card numbers', async () => {
      const buffer1 = await generateSingleCard(1);
      const buffer2 = await generateSingleCard(2);
      
      // Buffers should be different (different card patterns)
      expect(buffer1).not.toEqual(buffer2);
    });

    it('should generate buffer with consistent structure for same card number', async () => {
      const buffer1 = await generateSingleCard(5);
      const buffer2 = await generateSingleCard(5);
      
      // Both should be valid PDFs
      expect(buffer1.toString('utf8', 0, 4)).toBe('%PDF');
      expect(buffer2.toString('utf8', 0, 4)).toBe('%PDF');
      
      // Both should have similar size (within 10% tolerance due to metadata)
      const sizeDiff = Math.abs(buffer1.length - buffer2.length);
      const tolerance = buffer1.length * 0.1; // 10% tolerance
      expect(sizeDiff).toBeLessThan(tolerance);
    });
  });

  describe('generateAllCards', () => {
    it('should generate all cards and return a Buffer', async () => {
      const buffer = await generateAllCards(80);
      
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      // 80 pages PDF should be larger than single card
      expect(buffer.length).toBeGreaterThan(50000);
    });

    it('should generate valid PDF with all 80 cards', async () => {
      const buffer = await generateAllCards(80);
      
      // PDF files start with %PDF magic bytes
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it('should generate smaller PDF for fewer cards', async () => {
      const buffer10 = await generateAllCards(10);
      const buffer80 = await generateAllCards(80);
      
      // 80 cards should be significantly larger than 10 cards
      expect(buffer80.length).toBeGreaterThan(buffer10.length * 5);
    });

    it('should generate valid PDF for 1 card', async () => {
      const buffer = await generateAllCards(1);
      
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it('should generate buffer with consistent structure for same card count', async () => {
      const buffer1 = await generateAllCards(80);
      const buffer2 = await generateAllCards(80);
      
      // Both should be valid PDFs
      expect(buffer1.toString('utf8', 0, 4)).toBe('%PDF');
      expect(buffer2.toString('utf8', 0, 4)).toBe('%PDF');
      
      // Both should have similar size (within 10% tolerance due to metadata)
      const sizeDiff = Math.abs(buffer1.length - buffer2.length);
      const tolerance = buffer1.length * 0.1; // 10% tolerance
      expect(sizeDiff).toBeLessThan(tolerance);
    });
  });

  describe('Buffer Integration', () => {
    it('should generate a buffer suitable for local file storage', async () => {
      const buffer = await generateSingleCard(1);
      
      // Verify buffer can be converted to string (for FormData)
      const str = buffer.toString('base64');
      expect(str).toBeTruthy();
      expect(str.length).toBeGreaterThan(0);
    });

    it('should generate all cards buffer suitable for local file storage', async () => {
      const buffer = await generateAllCards(80);
      
      // Verify buffer can be converted to string (for FormData)
      const str = buffer.toString('base64');
      expect(str).toBeTruthy();
      expect(str.length).toBeGreaterThan(0);
    });

    it('should handle concurrent card generation', async () => {
      // Test that multiple cards can be generated concurrently
      const promises = Array.from({ length: 5 }, (_, i) => 
        generateSingleCard(i + 1)
      );
      
      const buffers = await Promise.all(promises);
      
      expect(buffers).toHaveLength(5);
      buffers.forEach(buffer => {
        expect(buffer).toBeInstanceOf(Buffer);
        expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
      });
    });
  });

  describe('Buffer Performance', () => {
    it('should generate single card quickly', async () => {
      const start = Date.now();
      await generateSingleCard(1);
      const duration = Date.now() - start;
      
      // Should complete within 10 seconds
      expect(duration).toBeLessThan(10000);
    });

    it('should generate all 80 cards within reasonable time', async () => {
      const start = Date.now();
      await generateAllCards(80);
      const duration = Date.now() - start;
      
      // Should complete within 60 seconds
      expect(duration).toBeLessThan(60000);
    }, { timeout: 70000 });
  });
});
