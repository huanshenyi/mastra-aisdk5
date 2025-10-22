'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useRef, useState, useTransition } from 'react';
import { analyzePDF, type PDFAnalysisResult } from './actions';

async function convertFilesToDataURLs(
  files: FileList,
): Promise<
  { type: 'file'; filename: string; mediaType: string; url: string }[]
> {
  return Promise.all(
    Array.from(files).map(
      file =>
        new Promise<{
          type: 'file';
          filename: string;
          mediaType: string;
          url: string;
        }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              type: 'file',
              filename: file.name,
              mediaType: file.type,
              url: reader.result as string, // Data URL
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }),
    ),
  );
}

async function convertFileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Chat() {
  const [input, setInput] = useState('');

  const { messages, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/pdf-chat',
    }),
  });

  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PDF Analysis state
  const [pdfFile, setPdfFile] = useState<File | undefined>(undefined);
  const [analysisResult, setAnalysisResult] = useState<PDFAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handlePdfAnalysis = async () => {
    if (!pdfFile) {
      setAnalysisError('Please select a PDF file first');
      return;
    }

    setAnalysisError(null);
    setAnalysisResult(null);

    startTransition(async () => {
      try {
        const dataUrl = await convertFileToDataURL(pdfFile);
        const result = await analyzePDF(dataUrl, pdfFile.type);

        if (result.success) {
          setAnalysisResult(result.data);
        } else {
          setAnalysisError(result.error);
        }
      } catch (error) {
        setAnalysisError(error instanceof Error ? error.message : 'Failed to analyze PDF');
      }
    });
  };

  return (
    <div className="flex flex-col w-full max-w-4xl py-24 mx-auto px-4 space-y-8">
      {/* PDF Analysis Section */}
      <div className="border border-gray-300 rounded-lg p-6 shadow-md">
        <h2 className="text-xl font-bold mb-4">PDF Analysis</h2>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <input
              type="file"
              accept="application/pdf"
              onChange={event => {
                if (event.target.files?.[0]) {
                  setPdfFile(event.target.files[0]);
                  setAnalysisResult(null);
                  setAnalysisError(null);
                }
              }}
              ref={pdfInputRef}
              className="flex-1"
            />
            <button
              onClick={handlePdfAnalysis}
              disabled={!pdfFile || isPending}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isPending ? 'Analyzing...' : 'Analyze PDF'}
            </button>
          </div>

          {pdfFile && (
            <div className="text-sm text-gray-600">
              Selected file: {pdfFile.name}
            </div>
          )}

          {analysisError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
              Error: {analysisError}
            </div>
          )}

          {analysisResult && (
            <div className="p-4 bg-green-50 border border-green-200 rounded space-y-3">
              <div>
                <h3 className="font-semibold text-lg mb-2">Summary</h3>
                <p className="text-gray-800">{analysisResult.summary}</p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Key Points</h3>
                <ul className="list-disc list-inside space-y-1">
                  {analysisResult.keyPoints.map((point, index) => (
                    <li key={index} className="text-gray-800">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Section */}
      <div className="flex flex-col">
        <h2 className="text-xl font-bold mb-4">PDF Chat</h2>
        {messages.map(message => (
          <div key={message.id} className="whitespace-pre-wrap mb-4">
            {message.role === 'user' ? 'User: ' : 'AI: '}

            {message.parts.map(part => {
              if (part.type === 'text') {
                return <div key={`${message.id}-text`}>{part.text}</div>;
              }
            })}

            <div></div>
          </div>
        ))}

        <form
          className="fixed bottom-0 w-full max-w-4xl p-2 mb-8 border border-gray-300 rounded shadow-xl space-y-2 bg-white"
          onSubmit={async event => {
            event.preventDefault();

            const fileParts =
              files && files.length > 0
                ? await convertFilesToDataURLs(files)
                : [];

            sendMessage({
              role: 'user',
              parts: [{ type: 'text', text: input }, ...fileParts],
            });

            setFiles(undefined);
            setInput('');

            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          }}
        >
          <input
            type="file"
            onChange={event => {
              if (event.target.files) {
                setFiles(event.target.files);
              }
            }}
            multiple
            ref={fileInputRef}
          />

          <input
            className="w-full p-2"
            value={input}
            placeholder="Say something..."
            onChange={event => {
              setInput(event.target.value);
            }}
          />
        </form>
      </div>
    </div>
  );
}
