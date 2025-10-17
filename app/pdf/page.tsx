'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useRef, useState } from 'react';

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

export default function Chat() {
  const [input, setInput] = useState('');

  const { messages, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/pdf-chat',
    }),
  });

  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      {messages.map(message => (
        <div key={message.id} className="whitespace-pre-wrap">
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
        className="fixed bottom-0 w-full max-w-md p-2 mb-8 border border-gray-300 rounded shadow-xl space-y-2"
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
  );
}
