import { mastra } from "@/src/mastra";
import { stepCountIs } from "ai";

const conditionalDeleteAgent = mastra.getAgent("conditionalDeleteAgent");

export async function POST(req: Request) {
  const {
    messages,
    resourceId,
    threadId: existingThreadId,
  }: {
    messages: any[];
    resourceId?: string;
    threadId?: string;
  } = await req.json();

  // Use resourceId as threadId for consistent 1-hour sessions
  const threadId = existingThreadId || resourceId || `conditional-delete-thread-${Date.now()}`;

  // Extract only the latest message since memory handles conversation history
  const latestMessage = messages[messages.length - 1];
  console.log("latest message:", latestMessage);

  const stream = await conditionalDeleteAgent.stream([latestMessage], {
    stopWhen: stepCountIs(5),
    memory: resourceId ? {
      thread: threadId,
      resource: resourceId,
    } : undefined,
    maxSteps: 5,
    toolChoice: "auto",
  });

  // Extract runId from stream for resume functionality
  const runId = (stream as any).runId;

  // Return Mastra's native format (not aisdk format)
  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      const fullStreamReader = (stream as any).fullStream.getReader();

      // Send initial metadata
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: 'metadata',
            threadId,
            resourceId,
            runId
          })}\n\n`
        )
      );

      try {
        while (true) {
          const { done, value } = await fullStreamReader.read();
          if (done) break;

          const mastraChunk = value as any;
          console.log("mastraChunk:", mastraChunk)

          // Forward Mastra chunks as-is
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(mastraChunk)}\n\n`)
          );
        }

        controller.close();
      } catch (error) {
        console.error('Stream error:', error);
        controller.error(error);
      } finally {
        fullStreamReader.releaseLock();
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
