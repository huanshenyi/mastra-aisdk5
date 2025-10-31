import { mastra } from "@/src/mastra";
import { toAISdkFormat } from "@mastra/ai-sdk";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

const deleteAgent = mastra.getAgent("deleteAgent");

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
    let stream;

    if (approved) {
      // Approve the tool call and resume the stream
      stream = await deleteAgent.approveToolCall({
        runId,
        toolCallId,
      });
    } else {
      // Decline the tool call
      stream = await deleteAgent.declineToolCall({
        runId,
        toolCallId,
      });
    }

    const uiMessageStream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.merge(toAISdkFormat(stream, { from: 'agent' })!);
      },
    });

    return createUIMessageStreamResponse({ stream: uiMessageStream });
  } catch (error) {
    console.error("Error handling tool approval:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process tool approval",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
