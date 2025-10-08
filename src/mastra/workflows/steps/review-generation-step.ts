import { z } from 'zod';
import { createStep } from '@mastra/core/workflows';

// 入力データのスキーマ定義（前のStepの出力を受け取る）
export const reviewGenerationStepInputSchema = z.object({
  input: z.string(),
});

// 出力データのスキーマ定義
export const reviewGenerationStepOutputSchema = z.object({
  output: z.string(),
});

// 型定義のエクスポート
export type ReviewGenerationInput = z.infer<typeof reviewGenerationStepInputSchema>;
export type ReviewGenerationOutput = z.infer<typeof reviewGenerationStepOutputSchema>;

// ✅ Mastra Step定義をエクスポート（Nested Streaming対応）
export const reviewGenerationStep = createStep({
  id: 'review-generation',
  inputSchema: reviewGenerationStepInputSchema,
  outputSchema: reviewGenerationStepOutputSchema,
  execute: async ({ inputData, getStepResult, getInitData, writer, mastra }) => {
    const { input } = inputData
    const reviewAgent = await mastra.getAgent("reviewAgent")
    const { text } = await reviewAgent.generateVNext([
      { role: "user", content: input }
    ])
    return {
      output: text
    }
  },
});
