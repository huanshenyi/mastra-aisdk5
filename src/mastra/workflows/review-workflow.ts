import { z } from 'zod';
import { createWorkflow } from '@mastra/core/workflows';

// ✅ 正しいアーキテクチャ: stepsフォルダからStep定義を直接インポート
import { reviewGenerationStep } from './steps/review-generation-step';

/**
 * Mastraベストプラクティス準拠のレビューワークフロー
 *
 * 正しいアーキテクチャ原則:
 * 1. WorkflowはStepの組み合わせのみ（Step定義は別ファイル）
 * 2. stepsフォルダからStep定義を直接インポート
 * 3. 循環参照を完全に排除
 * 4. 依存性注入による疎結合
 *
 * 【処理概要】
 * 決裁書レビューの全工程を統合管理し、各ステップを順次実行する
 * ストリーミング対応でリアルタイムなUI更新を実現
 *
 * 【ワークフロー構成】
 * 1. ドキュメント抽出 - ファイルからテキストを抽出
 * 2. Web検索 - 関連情報の収集（オプション）
 * 3. レビュー生成 - AIによるストリーミングレビュー生成
 * 4. PPTX生成 - レビュー結果をPowerPoint形式で出力
 */

// ワークフロー入力データのスキーマ定義
const reviewWorkflowInputSchema = z.object({
  // 必須パラメータ
  input: z.string().min(1, 'Base64データが必要です'),
});

// ワークフロー出力データのスキーマ定義
const reviewWorkflowOutputSchema = z.object({
  // 基本結果
  output: z.string(),
});

// ✅ Mastra vNext APIベストプラクティス準拠のワークフロー定義
// 各Stepが自己完結的にデータを取得する設計
export const reviewWorkflow = createWorkflow({
  id: 'review-workflow',
  inputSchema: reviewWorkflowInputSchema,
  outputSchema: reviewWorkflowOutputSchema,
})
  .then(reviewGenerationStep)
  .commit();

// 型定義のエクスポート
export type WorkflowInput = z.infer<typeof reviewWorkflowInputSchema>;
export type WorkflowOutput = z.infer<typeof reviewWorkflowOutputSchema>;
