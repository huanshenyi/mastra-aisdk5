import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { platform } from 'os';

export interface ConvertedSlide {
  slideNumber: number;
  imageBase64: string;
  mediaType: string;
}

/**
 * プラットフォームに応じたLibreOfficeのコマンドを取得
 */
function getLibreOfficeCommand(): string {
  const osType = platform();

  if (osType === 'darwin') {
    // macOS
    return '/Applications/LibreOffice.app/Contents/MacOS/soffice';
  } else {
    // Linux (Docker環境)
    return 'libreoffice';
  }
}

/**
 * PPTXファイルを各スライドの画像に変換する
 * @param pptxBuffer PPTXファイルのBuffer
 * @returns 各スライドの画像データの配列
 */
export async function convertPptxToImages(
  pptxBuffer: Buffer
): Promise<ConvertedSlide[]> {
  const tempDir = tmpdir();

  // ベースの一時ディレクトリが存在しない場合は作成（Fargate環境対応）
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const sessionId = randomUUID();
  const inputDir = path.join(tempDir, `pptx-input-${sessionId}`);
  const outputDir = path.join(tempDir, `pptx-output-${sessionId}`);
  const inputFile = path.join(inputDir, 'presentation.pptx');
  const pdfFile = path.join(outputDir, 'presentation.pdf');

  try {
    // 入力・出力ディレクトリを作成
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });

    // PPTXファイルを一時ファイルとして保存
    fs.writeFileSync(inputFile, pptxBuffer);

    // Step 1: PPTX → PDF (LibreOfficeを使用)
    const libreOfficeCmd = getLibreOfficeCommand();
    const sofficeCommand = `"${libreOfficeCmd}" --headless --convert-to pdf --outdir "${outputDir}" "${inputFile}"`;
    console.log('Running soffice command:', sofficeCommand);
    execSync(sofficeCommand, { encoding: 'utf-8' });

    // PDFファイルが生成されたか確認
    if (!fs.existsSync(pdfFile)) {
      throw new Error('PDF conversion failed: PDF file not created');
    }

    // Step 2: PDF → PNG (ImageMagickを使用)
    const convertCommand = `convert -density 150 "${pdfFile}" "${path.join(outputDir, 'slide-%03d.png')}"`;
    console.log('Running convert command:', convertCommand);
    execSync(convertCommand, { encoding: 'utf-8' });

    // 出力ディレクトリから画像ファイルを読み込む
    const files = fs.readdirSync(outputDir);
    const imageFiles = files
      .filter(file => file.endsWith('.png'))
      .sort((a, b) => {
        // ファイル名でソート（スライド順を保持）
        const numA = parseInt(a.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.match(/\d+/)?.[0] || '0');
        return numA - numB;
      });

    // 各画像をBase64エンコード
    const slides: ConvertedSlide[] = imageFiles.map((file, index) => {
      const imagePath = path.join(outputDir, file);
      const imageBuffer = fs.readFileSync(imagePath);
      const imageBase64 = `data:image/png;base64,${imageBuffer.toString('base64')}`;

      return {
        slideNumber: index + 1,
        imageBase64,
        mediaType: 'image/png',
      };
    });

    return slides;
  } catch (error) {
    console.error('Error converting PPTX to images:', error);
    throw error;
  } finally {
    // クリーンアップ: 一時ディレクトリとファイルを削除
    try {
      if (fs.existsSync(inputDir)) {
        fs.rmSync(inputDir, { recursive: true, force: true });
      }
      if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.error('Error cleaning up temporary files:', cleanupError);
    }
  }
}
