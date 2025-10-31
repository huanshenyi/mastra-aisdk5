import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const deleteTool = createTool({
    id: "delete-data",
    description: "Delete records from database",
    inputSchema: z.object({
        count: z.number(),
        table: z.string()
    }),
    requireApproval: true,
    execute: async ({ context, mastra }) => {
        const { count, table } = context;
        const logger = mastra?.logger;

        logger?.info(`${table}テーブルから${count}件のレコードを削除中...`);

        // requireApproval: true により、この関数は承認後にのみ実行される
        // モックの削除結果を返す
        return {
            success: true,
            deletedCount: count,
            table: table,
            message: `${table}テーブルから${count}件のレコードを正常に削除しました`,
            timestamp: new Date().toLocaleString('ja-JP'),
        };
    },
});