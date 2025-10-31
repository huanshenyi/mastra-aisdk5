import { mastra } from "@/src/mastra";

const conditionalDeleteAgent = mastra.getAgent("conditionalDeleteAgent");

export async function POST(req: Request) {
  const {
    runId,
    toolCallId,
    approved,
  }: {
    runId: string;
    toolCallId: string;
    approved: boolean;
  } = await req.json();

  try {
    // Pattern 2: resumeStream を使用
    const stream = await conditionalDeleteAgent.resumeStream(
      { approved },
      { runId, toolCallId }
    );

    // Return Mastra's native format
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        const fullStreamReader = (stream as any).fullStream.getReader();

        try {
          while (true) {
            const { done, value } = await fullStreamReader.read();
            if (done) break;

            const mastraChunk = value as any;

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
  } catch (error) {
    console.error("Error handling tool resumption:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to resume tool execution",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
