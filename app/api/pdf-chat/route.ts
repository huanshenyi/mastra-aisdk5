import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { fromEnv } from '@aws-sdk/credential-providers';
import type { UIMessage } from 'ai';

const client = new BedrockRuntimeClient({
  region: 'us-east-1',
  credentials: fromEnv(),
});

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Convert UI messages to Bedrock format
  const bedrockMessages: Array<{
    role: 'user' | 'assistant';
    content: Array<
      | { type: 'text'; text: string }
      | { type: 'document'; source: { type: 'base64'; media_type: string; data: string } }
    >;
  }> = [];

  for (const message of messages) {
    if (message.role === 'user' && message.parts) {
      const content: Array<
        | { type: 'text'; text: string }
        | { type: 'document'; source: { type: 'base64'; media_type: string; data: string } }
      > = [];

      for (const part of message.parts) {
        if (part.type === 'text' && part.text.trim()) {
          // Only add non-empty text content
          content.push({
            type: 'text',
            text: part.text,
          });
        } else if (part.type === 'file' && part.url && part.url.startsWith('data:')) {
          // Extract base64 data from Data URL
          const base64Data = part.url.split(',')[1];

          content.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: part.mediaType || 'application/pdf',
              data: base64Data,
            },
          });
        }
      }

      // If no text content, add a default prompt for document analysis
      const hasText = content.some(c => c.type === 'text');
      if (!hasText && content.length > 0) {
        content.unshift({
          type: 'text',
          text: 'このドキュメントを分析してください。',
        });
      }

      bedrockMessages.push({
        role: 'user',
        content,
      });
    } else if (message.role === 'assistant' && message.parts) {
      const textParts = message.parts.filter(p => p.type === 'text');
      const text = textParts.map(p => (p.type === 'text' ? p.text : '')).join('');

      bedrockMessages.push({
        role: 'assistant',
        content: [{ type: 'text', text }],
      });
    }
  }

  // Bedrock API payload
  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    system: '日本語で答えてください',
    max_tokens: 4000,
    messages: bedrockMessages,
  };

  console.log('Bedrock payload:', JSON.stringify(payload, null, 2));

  // Invoke Bedrock with streaming
  const command = new InvokeModelWithResponseStreamCommand({
    modelId: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  });

  const response = await client.send(command);

  // Create a readable stream to return to the client
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (!response.body) {
          controller.close();
          return;
        }

        let fullText = '';

        for await (const event of response.body) {
          if (event.chunk) {
            const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));

            console.log('Bedrock chunk:', chunk);

            if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
              const textDelta = chunk.delta.text;
              fullText += textDelta;

              // Send text delta in AI SDK format
              controller.enqueue(
                encoder.encode(`0:${JSON.stringify({ type: 'text-delta', textDelta })}\n`)
              );
            }

            if (chunk.type === 'message_stop') {
              // Send finish message
              controller.enqueue(
                encoder.encode(`d:${JSON.stringify({ finishReason: 'stop' })}\n`)
              );
              controller.close();
            }
          }
        }
      } catch (error) {
        console.error('Stream error:', error);
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'x-vercel-ai-data-stream': 'v1',
    },
  });
}
