import { mastra } from "@/src/mastra";
import { stepCountIs, type UIMessage, convertToModelMessages } from "ai";
import { z } from "zod";
import { pdf } from "pdf-parse";
import officeParser from "officeparser";

const evaluationSectionSchema = z.object({
  evaluation: z.string(),
  strengths: z.array(z.string()),
  improvementsNeeded: z.array(z.string()),
  improvementActions: z.array(z.string()),
});

const reviewResponseSchema = z.object({
  overallEvaluation: z.object({
    evaluation: z.string(),
    improvementActions: z.array(z.string()),
  }),
  documentFormat: evaluationSectionSchema,
  readerPerspective: evaluationSectionSchema,
  implementationContent: evaluationSectionSchema,
  userImpact: evaluationSectionSchema,
  costValidity: evaluationSectionSchema,
  scheduleDescription: evaluationSectionSchema,
  organizationChart: evaluationSectionSchema,
});

// Helper function to process files
async function processFile(file: {
  filename: string;
  mediaType: string;
  url: string;
}): Promise<{ type: string; text?: string; image?: string }> {
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

  // Handle PDFs
  if (mediaType === 'application/pdf') {
    try {
      const data = await pdf(buffer);
      return {
        type: 'text',
        text: `[PDF: ${filename}]\n\n${data.text}`,
      };
    } catch (error) {
      console.error('Error parsing PDF:', error);
      return {
        type: 'text',
        text: `[Error: Could not parse PDF file ${filename}]`,
      };
    }
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
  }: {
    messages: UIMessage[];
    model: string;
    webSearch: boolean;
  } = await req.json();

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

        // Add processed file content as text or image part
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

  console.log("Processed UI messages:", JSON.stringify(processedUIMessages, null, 2));

  // Convert UI messages to model messages
  const modelMessages = convertToModelMessages(processedUIMessages);

  console.log("Model messages:", JSON.stringify(modelMessages, null, 2));

  const stream = await myAgent.stream(modelMessages, {
    stopWhen: stepCountIs(3),
    format: "aisdk",
    memory: {
      thread: "2",
      resource: "1",
    },
    maxSteps: 5,
    toolChoice: "auto",
  });

  return stream.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
