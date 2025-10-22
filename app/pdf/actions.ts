'use server';

import { bedrock } from "../lib/bedrock-providers";
import { generateObject } from 'ai';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const pdfAnalysisSchema = z.object({
  summary: z.string().describe('見た目の情報'),
  keyPoints: z.array(z.string()).describe('人物の見た目の情報'),
});

export type PDFAnalysisResult = z.infer<typeof pdfAnalysisSchema>;

export async function analyzePDF(
  fileData: string,
  mediaType: string = 'application/pdf',
): Promise<{ success: true; data: PDFAnalysisResult } | { success: false; error: string }> {
  let tmpFilePath: string | null = null;

  try {
    // Remove data URL prefix if present (e.g., "data:application/pdf;base64,")
    const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Create temporary file
    const tmpDir = tmpdir();
    const fileName = `pdf-${randomUUID()}.pdf`;
    tmpFilePath = path.join(tmpDir, fileName);
    console.log('Temporary PDF file path:', tmpFilePath);

    // Write buffer to temporary file
    fs.writeFileSync(tmpFilePath, buffer);

    const result = await generateObject({
      model: bedrock('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
      schema: pdfAnalysisSchema,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '人物の写真あれば、見た目情報を言ってください、必ず日本語で答えてください!',
            },
            {
              type: 'file',
              data: fs.readFileSync(tmpFilePath),
              mediaType,
              providerOptions: {
                bedrock: {
                  citations: { enabled: true },
                },
              },
            },
          ],
        },
      ],
    });

    return { success: true, data: result.object };
  } catch (error) {
    console.error('Error analyzing PDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  } finally {
    // Clean up temporary file
    if (tmpFilePath && fs.existsSync(tmpFilePath)) {
      try {
        fs.unlinkSync(tmpFilePath);
      } catch (unlinkError) {
        console.error('Error deleting temporary file:', unlinkError);
      }
    }
  }
}
