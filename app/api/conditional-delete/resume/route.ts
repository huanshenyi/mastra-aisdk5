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
    // resumeData として approved を渡す（resumeSchema に合わせる）
    const stream = await conditionalDeleteAgent.resumeStream(
      { approved },  // resumeSchema: z.object({ approved: z.boolean() })
      { runId, toolCallId }
    ) as any;

    return stream.toUIMessageStreamResponse({
      sendReasoning: true,
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
