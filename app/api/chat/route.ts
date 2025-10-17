import { mastra } from "@/src/mastra";
import { CoreMessage } from "@mastra/core";
import { stepCountIs, type UIMessage } from "ai";
import officeParser from "officeparser";

// Helper function to process files
async function processFile(file: {
  filename: string;
  mediaType: string;
  url: string;
}): Promise<{
  type: string;
  text?: string;
  image?: string;
  url?: string;
  data?: Buffer;
  mediaType?: string;
  filename?: string;
  providerOptions?: any;
}> {
  const { filename, mediaType, url } = file;

  // Handle images - pass through as-is (no base64 parsing needed)
  if (mediaType.startsWith('image/')) {
    return {
      type: 'image',
      image: url,
    };
  }

  // For PDF and PowerPoint, extract base64 data from data URL
  const base64Match = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!base64Match) {
    throw new Error(`Invalid data URL for file: ${filename}. Expected data URL format.`);
  }

  const [, , base64Data] = base64Match;
  const buffer = Buffer.from(base64Data, 'base64');

  // Handle PDFs - return Buffer with citations enabled for visual understanding
  if (mediaType === 'application/pdf') {
    return {
      type: 'file',
      data: buffer,
      mediaType,
      filename,
      providerOptions: {
        bedrock: {
          citations: { enabled: true },
        },
      },
    };
  }

  // Handle PowerPoint files
  if (
    mediaType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    mediaType === 'application/vnd.ms-powerpoint'
  ) {
    try {
      const text = await officeParser.parseOfficeAsync(buffer);
      return {
        type: 'text',
        text: `[PowerPoint: ${filename}]\n\n${text}`,
      };
    } catch (error) {
      console.error('Error parsing PowerPoint:', error);
      return {
        type: 'text',
        text: `[Error: Could not parse PowerPoint file ${filename}]`,
      };
    }
  }

  // Unsupported file type
  return {
    type: 'text',
    text: `[Unsupported file type: ${filename} (${mediaType})]`,
  };
}

const myAgent = mastra.getAgent("reviewAgent");
export async function POST(req: Request) {
  const {
    messages,
    model,
    webSearch,
    resourceId,
    threadId: existingThreadId,
  }: {
    messages: UIMessage[];
    model: string;
    webSearch: boolean;
    resourceId?: string;
    threadId?: string;
  } = await req.json();

  // Use resourceId as threadId for consistent 1-hour sessions
  const threadId = existingThreadId || resourceId || `thread-${Date.now()}`;

  // Process messages to handle files
  const processedUIMessages: UIMessage[] = [];

  for (const message of messages) {
    const processedParts: any[] = [];

    for (const part of message.parts) {
      if (part.type === 'text') {
        processedParts.push({
          type: 'text',
          text: part.text,
        });
      } else if (part.type === 'file') {
        // Process the file
        const processed = await processFile({
          filename: part.filename || 'unknown',
          mediaType: part.mediaType || 'application/octet-stream',
          url: part.url,
        });

        // Add processed file content as text, image, or file part
        if (processed.type === 'text') {
          processedParts.push({
            type: 'text',
            text: processed.text,
          });
        } else if (processed.type === 'image') {
          processedParts.push({
            type: 'file',
            mediaType: 'image/png',
            url: processed.image,
          });
        } else if (processed.type === 'file') {
          // Keep as file with Buffer data (following official AI SDK docs)
          const filePart = {
            type: 'file' as any,
            data: processed.data,  // Keep Buffer as-is
            mediaType: processed.mediaType || 'application/pdf',
            providerOptions: {
              bedrock: {
                citations: { enabled: true },
              },
            },
          };

          console.log('Adding file part:', {
            type: filePart.type,
            mediaType: filePart.mediaType,
            hasData: !!filePart.data,
            dataType: filePart.data?.constructor?.name,
            dataLength: Buffer.isBuffer(filePart.data) ? filePart.data.length : 'not a buffer',
          });

          processedParts.push(filePart);
        }
      } else {
        // Pass through other parts
        processedParts.push(part);
      }
    }

    processedUIMessages.push({
      ...message,
      parts: processedParts,
    });
  }

  // Debug: Check if data is in processedUIMessages
  console.log('Processed UI Messages (last message):', JSON.stringify(processedUIMessages[processedUIMessages.length - 1], (key, value) => {
    if (key === 'data' && value?.constructor?.name === 'Buffer') {
      return `<Buffer: ${value.length} bytes>`;
    }
    return value;
  }, 2));

  // Build model messages with proper typing for AI SDK
  const modelMessages = processedUIMessages.map(message => ({
    role: message.role,
    content: message.parts as any,
    providerOptions: {
      bedrock: {
        citations: { enabled: true },
      },
    },
  })) as any;

  console.log('Model messages:', JSON.stringify(modelMessages.map((m: any) => ({
    role: m.role,
    content: m.content.map((c: any) => ({
      type: c.type,
      ...(c.type === 'file' ? {
        mediaType: c.mediaType,
        data: c.data
          ? (Buffer.isBuffer(c.data)
            ? `<Buffer: ${c.data.length} bytes>`
            : (typeof c.data === 'string' ? `<String: ${c.data.length} chars>` : typeof c.data))
          : 'MISSING',
        providerOptions: c.providerOptions,
      } : {}),
      ...(c.type === 'document' ? {
        source: {
          type: c.source?.type,
          media_type: c.source?.media_type,
          data: c.source?.data ? `<base64: ${c.source.data.substring(0, 50)}... (${c.source.data.length} chars)>` : undefined,
        }
      } : {}),
      ...(c.type === 'text' ? { text: c.text?.substring(0, 50), textLength: c.text?.length } : {}),
    })),
  })), null, 2));

  const stream = await myAgent.stream(modelMessages, {
    stopWhen: stepCountIs(5),
    format: "aisdk",
    memory: resourceId ? {
      thread: threadId,
      resource: resourceId,
    } : undefined,
    maxSteps: 3,
    toolChoice: "auto",
    providerOptions: {
      bedrock: {
        citations: {
          enabled: true
        }
      }
    }
  });

  return stream.toUIMessageStreamResponse({
    sendReasoning: true,
    messageMetadata(options) {
      if (options.part.type === "start") {
        return { threadId, resourceId };
      }
    },
  });
}
