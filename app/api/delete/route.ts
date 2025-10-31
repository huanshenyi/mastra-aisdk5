import { mastra } from "@/src/mastra";
import { stepCountIs, type UIMessage, convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { toAISdkFormat } from "@mastra/ai-sdk";

const deleteAgent = mastra.getAgent("deleteAgent");

export async function POST(req: Request) {
  const {
    messages,
    resourceId,
    threadId: existingThreadId,
  }: {
    messages: UIMessage[];
    model: string;
    resourceId?: string;
    threadId?: string;
  } = await req.json();

  // Use resourceId as threadId for consistent 1-hour sessions
  const threadId = existingThreadId || resourceId || `delete-thread-${Date.now()}`;

  // Convert UI messages to model messages
  const modelMessages = convertToModelMessages(messages);

  const stream = await deleteAgent.stream(modelMessages, {
    stopWhen: stepCountIs(5),
    memory: resourceId ? {
      thread: threadId,
      resource: resourceId,
    } : undefined,
    maxSteps: 3,
    toolChoice: "auto",
    requireToolApproval: true,
  });

  // Extract runId from stream
  const runId = (stream as any).runId;

  const uiMessageStream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Merge the Mastra stream converted to AI SDK format
      const aiSdkStream = toAISdkFormat(stream, { from: 'agent' })!;
      const reader = aiSdkStream.getReader();

      // Read chunks and inject metadata into the first assistant message
      let isFirstMessage = true;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Cast to any to check for message properties
          const chunk = value as any;

          // Inject metadata into the first assistant message chunk
          if (isFirstMessage && chunk.id && chunk.role === 'assistant') {
            writer.write({
              ...chunk,
              metadata: { threadId, resourceId, runId }
            } as any);
            isFirstMessage = false;
          } else {
            writer.write(value);
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
  });

  return createUIMessageStreamResponse({ stream: uiMessageStream });
}
