import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const conditionalDeleteTool = createTool({
    id: "conditional-delete-data",
    description: "Delete records from database with conditional approval (requires approval for 11+ records)",
    inputSchema: z.object({
        count: z.number(),
        table: z.string()
    }),
    suspendSchema: z.object({
        count: z.number(),
        table: z.string(),
        message: z.string()
    }),
    resumeSchema: z.object({
        approved: z.boolean()
    }),
    execute: async ({ context, mastra, suspend, resumeData }) => {
        const { count, table } = context;
        const logger = mastra?.logger;
        console.log("resumeData", resumeData)

        // 条件付き承認: 10件以下は承認不要、11件以上は承認が必要
        if (count > 10 && !resumeData) {
            logger?.info(`${table}テーブルから${count}件のレコード削除の承認を要求中...`);

            if (suspend) {
                return await suspend({
                    count,
                    table,
                    message: `⚠️ ${table}テーブルから${count}件のレコードを削除しようとしています。この操作は取り消すことができません。`
                });
            }
        }

        // 承認されなかった場合
        if (resumeData && !resumeData.approved) {
            logger?.info(`${table}テーブルからの削除操作が拒否されました`);
            return {
                success: false,
                deletedCount: 0,
                table: table,
                message: `削除操作がキャンセルされました`,
                timestamp: new Date().toLocaleString('ja-JP'),
            };
        }

        // 承認された場合、または10件以下の場合は削除を実行
        logger?.info(`${table}テーブルから${count}件のレコードを削除中...`);

        // モックの削除結果を返す
        return {
            success: true,
            deletedCount: count,
            table: table,
            message: `${table}テーブルから${count}件のレコードを正常に削除しました${count > 10 ? '（承認済み）' : ''}`,
            timestamp: new Date().toLocaleString('ja-JP'),
        };
    },
});
