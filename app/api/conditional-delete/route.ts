import { mastra } from "@/src/mastra";
import { stepCountIs, type UIMessage, convertToModelMessages } from "ai";

const conditionalDeleteAgent = mastra.getAgent("conditionalDeleteAgent");

export async function POST(req: Request) {
  const {
    messages,
    resourceId,
    threadId: existingThreadId,
  }: {
    messages: UIMessage[];
    resourceId?: string;
    threadId?: string;
  } = await req.json();

  // Use resourceId as threadId for consistent 1-hour sessions
  const threadId = existingThreadId || resourceId || `conditional-delete-thread-${Date.now()}`;

  // Convert UI messages to model messages
  const modelMessages = convertToModelMessages(messages);

  const stream = await conditionalDeleteAgent.stream(modelMessages, {
    stopWhen: stepCountIs(5),
    format: "aisdk",
    memory: resourceId ? {
      thread: threadId,
      resource: resourceId,
    } : undefined,
    maxSteps: 3,
    toolChoice: "auto",
  }) as any;

  // Extract runId from stream for resume functionality
  const runId = stream.runId;

  return stream.toUIMessageStreamResponse({
    sendReasoning: true,
    messageMetadata(options: any) {
      if (options.part.type === "start") {
        return { threadId, resourceId, runId };
      }
    },
  });
}
