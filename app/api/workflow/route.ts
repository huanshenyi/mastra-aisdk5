import { mastra } from "@/src/mastra";

const myAgent = mastra.getAgent("reviewAgent");
export async function POST(req: Request) {
    const { messages } = await req.json();

    const run = await mastra.getWorkflow("reviewWorkflow").createRunAsync()
    const result = await run.streamVNext({
        inputData: { input: "こんにちは" }
    })

    for await (const chunk of result) {
        console.log("chunk:", chunk);
    }

    const stream = await myAgent.stream(messages, {
        format: "aisdk",
        memory: {
            thread: "2",
            resource: "1",
        },
    });

    return stream.toUIMessageStreamResponse({
        sendReasoning: true,
    });
}
