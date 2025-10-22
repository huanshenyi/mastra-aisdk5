'use server';

import { bedrock } from "../lib/bedrock-providers";
import { generateObject } from 'ai';
import { z } from 'zod';
import { convertPptxToImages } from '../lib/pptx-converter';

const pptxAnalysisSchema = z.object({
  summary: z.string().describe('PPTXファイル全体の要約（スライド内容、画像、テキストを含む）'),
  keyPoints: z.array(z.string()).describe('重要なポイント（画像の内容、スライドのメッセージなど）'),
  imageDescriptions: z.array(z.string()).describe('各スライドに含まれる画像（写真、図表、グラフ、イラストなど）の詳細な説明。何が写っているか、どのような図表か、視覚的な特徴などを具体的に記述'),
  slideCount: z.number().optional().describe('推定されるスライド数'),
  containsImages: z.boolean().optional().describe('画像が含まれているか'),
});

export type PPTXAnalysisResult = z.infer<typeof pptxAnalysisSchema>;

export async function analyzePPTX(
  fileData: string,
  mediaType: string = 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
): Promise<{ success: true; data: PPTXAnalysisResult } | { success: false; error: string }> {
  try {
    // Remove data URL prefix if present (e.g., "data:application/vnd...;base64,")
    const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Convert PPTX to images
    const slides = await convertPptxToImages(buffer);

    if (slides.length === 0) {
      return {
        success: false,
        error: 'PPTXファイルからスライドを抽出できませんでした',
      };
    }

    // Build content array with text prompt and all slide images
    const content: any[] = [
      {
        type: 'text',
        text: `このPowerPointプレゼンテーションを分析してください。${slides.length}枚のスライドが含まれています。

以下の情報を詳しく分析してください：
1. 各スライドに含まれる画像（写真、図表、グラフ、イラスト、アイコンなど）の種類と内容
2. 画像の色使い、レイアウト、デザインの特徴
3. スライドのテキスト内容
4. 全体的なメッセージとプレゼンテーションの目的

特に画像については、何が写っているか、どのような図表か、どんな情報を伝えようとしているか、視覚的な特徴などを具体的に説明してください。すべての情報を日本語で提供してください。`,
      },
    ];

    // Add all slide images to content
    for (const slide of slides) {
      content.push({
        type: 'image',
        image: slide.imageBase64,
      });
    }

    const result = await generateObject({
      model: bedrock('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
      schema: pptxAnalysisSchema,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    });

    return { success: true, data: result.object };
  } catch (error) {
    console.error('Error analyzing PPTX:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
