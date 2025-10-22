'use client';

import { useRef, useState, useTransition } from 'react';
import { analyzePPTX, type PPTXAnalysisResult } from './actions';

async function convertFileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PPTXAnalysis() {
  // PPTX Analysis state
  const [pptxFile, setPptxFile] = useState<File | undefined>(undefined);
  const [analysisResult, setAnalysisResult] = useState<PPTXAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const pptxInputRef = useRef<HTMLInputElement>(null);

  const handlePptxAnalysis = async () => {
    if (!pptxFile) {
      setAnalysisError('PPTXファイルを選択してください');
      return;
    }

    setAnalysisError(null);
    setAnalysisResult(null);

    startTransition(async () => {
      try {
        const dataUrl = await convertFileToDataURL(pptxFile);
        const result = await analyzePPTX(dataUrl, pptxFile.type);

        if (result.success) {
          setAnalysisResult(result.data);
        } else {
          setAnalysisError(result.error);
        }
      } catch (error) {
        setAnalysisError(error instanceof Error ? error.message : 'PPTXの解析に失敗しました');
      }
    });
  };

  return (
    <div className="flex flex-col w-full max-w-4xl py-24 mx-auto px-4 space-y-8">
      {/* PPTX Analysis Section */}
      <div className="border border-gray-300 rounded-lg p-6 shadow-md">
        <h2 className="text-xl font-bold mb-4">PowerPoint (PPTX) 解析</h2>
        <p className="text-sm text-gray-600 mb-4">
          PowerPointファイルをアップロードして、内容を解析します
        </p>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <input
              type="file"
              accept="application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx"
              onChange={event => {
                if (event.target.files?.[0]) {
                  setPptxFile(event.target.files[0]);
                  setAnalysisResult(null);
                  setAnalysisError(null);
                }
              }}
              ref={pptxInputRef}
              className="flex-1"
            />
            <button
              onClick={handlePptxAnalysis}
              disabled={!pptxFile || isPending}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isPending ? '解析中...' : 'PPTX解析'}
            </button>
          </div>

          {pptxFile && (
            <div className="text-sm text-gray-600">
              選択ファイル: {pptxFile.name}
            </div>
          )}

          {analysisError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
              エラー: {analysisError}
            </div>
          )}

          {analysisResult && (
            <div className="p-4 bg-green-50 border border-green-200 rounded space-y-3">
              <div>
                <h3 className="font-semibold text-lg mb-2">要約</h3>
                <p className="text-gray-800">{analysisResult.summary}</p>
              </div>

              {analysisResult.slideCount && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">スライド数</h3>
                  <p className="text-gray-800">{analysisResult.slideCount} 枚</p>
                </div>
              )}

              {analysisResult.containsImages !== undefined && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">画像有無</h3>
                  <p className="text-gray-800">
                    {analysisResult.containsImages ? '画像が含まれています' : '画像は含まれていません'}
                  </p>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-lg mb-2">主要ポイント</h3>
                <ul className="list-disc list-inside space-y-1">
                  {analysisResult.keyPoints.map((point, index) => (
                    <li key={index} className="text-gray-800">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              {analysisResult.imageDescriptions && analysisResult.imageDescriptions.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">画像の詳細</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {analysisResult.imageDescriptions.map((description, index) => (
                      <li key={index} className="text-gray-800">
                        {description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
