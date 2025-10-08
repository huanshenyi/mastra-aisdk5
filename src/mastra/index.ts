import { Mastra } from "@mastra/core";
import { PinoLogger } from "@mastra/loggers";
import { LangfuseExporter } from "@mastra/langfuse";
import { reviewWorkflow } from "./workflows/review-workflow"
import { weatherAgent } from "./agents";
import { reviewAgent } from "./agents/review-agent"
import { SamplingStrategyType, clearAITracingRegistry } from '@mastra/core/ai-tracing';
import { LibSQLStore } from "@mastra/libsql";

const exporter = new LangfuseExporter({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASEURL,
  realtime: process.env.NODE_ENV === "development",
  options: {
    environment: process.env.NODE_ENV,
  }
})

const getMastraInstance = () => {
  clearAITracingRegistry();

  return new Mastra({
    agents: { weatherAgent, reviewAgent },
    workflows: { reviewWorkflow },
    logger: new PinoLogger({
      name: "Mastra",
      level: "info",
    }),
    storage: new LibSQLStore({
      url: ":memory:"
    }),
    observability: {
      configs: {
        langfuse: {
          sampling: { type: SamplingStrategyType.ALWAYS },
          serviceName: "ai",
          exporters: [
            exporter
          ],
        },
      },
    },
  });
}

export const mastra = getMastraInstance();