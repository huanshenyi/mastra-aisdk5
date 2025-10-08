import { Memory } from '@mastra/memory';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { bedrock } from '@/app/lib/bedrock-providers';

/**
 * Create memory instance for review agent
 * Specialized for document review with resource-scoped memory
 */
export const createReviewAgentMemory = () => {
    return new Memory({
        // Storage for conversation history
        storage: new LibSQLStore({
            url: "file:review-memory.db",
        }),

        // Vector store for semantic search
        vector: new LibSQLVector({
            connectionUrl: "file:review-memory.db",
        }),

        embedder: bedrock.embedding("amazon.titan-embed-text-v2:0"),

        options: {
            // Number of recent messages to include in context
            lastMessages: 20,

            // Semantic search configuration - resource-scoped
            semanticRecall: {
                topK: 10, // Retrieve more similar review cases
                messageRange: {
                    before: 4, // More context before each result
                    after: 3,  // More context after each result
                },
                scope: 'resource', // Search across all threads for the same user
            },

            // Working memory configuration for review agent
            workingMemory: {
                enabled: true,
                scope: 'resource',
                template: `# レビューエージェント - ユーザープロファイル

## ユーザー基本情報
- **名前**:
- **部署**:
- **役職**:
- **レビュー経験年数**:
- **専門分野**: [インフラ/アプリ/セキュリティ等]

## レビュー傾向・優先順位
- **最重視項目**: [コスト/スケジュール/ユーザー影響/技術品質]
- **指摘の厳しさレベル**: [1-5]
- **好みの文体**: [簡潔/詳細/具体例重視]
- **絵文字使用**: [有/無]

## 過去のレビュー履歴
- **総レビュー数**:
- **よく指摘する項目**: [箇条書き]
- **改善が見られた項目**: [箇条書き]
- **繰り返し指摘される項目**: [箇条書き]

## 進行中のプロジェクト
- **プロジェクト名**:
- **案件種別**: [新規導入/リプレース/保守/改善]
- **予算規模**:
- **レビュー段階**: [初回/2回目/最終]
- **前回の主な指摘事項**:

## 類似案件の記憶
- **過去の類似案件**:
  - 案件名:
  - 評価結果:
  - 成功/失敗要因:
  - 適用可能な知見:

## 評価基準のカスタマイズ
- **コスト妥当性の閾値**: [金額基準]
- **スケジュールの許容範囲**: [日数]
- **ユーザー影響の許容レベル**: [高/中/低]
- **特に重視する技術要素**: [セキュリティ/パフォーマンス/保守性等]

## フィードバックループ
- **前回指摘した改善アクション**:
  - アクション内容:
  - 実施状況: [完了/進行中/未着手]
  - 効果測定:
- **ユーザーの反応パターン**:
  - よく受け入れられる指摘:
  - 反論が多い指摘:

## グループ社内コンテキスト
- **他部門との連携案件**:
- **グループ内の類似事例**:
- **共通のベンダー・パートナー**:
- **標準化された評価基準**:`,
            },

            // Thread configuration
            threads: {
                generateTitle: true,
            },
        },
    });
};
