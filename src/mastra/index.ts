import { Mastra } from "@mastra/core";
import { PinoLogger } from "@mastra/loggers";
import { LangfuseExporter } from "@mastra/langfuse";

import { weatherAgent } from "./agents";

export const mastra = new Mastra({
  agents: { weatherAgent },
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
  observability: {
    configs: {
      langfuse: {
        serviceName: "ai",
        exporters: [
          new LangfuseExporter({
            publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
            secretKey: process.env.LANGFUSE_SECRET_KEY!,
            baseUrl: process.env.LANGFUSE_BASE_URL,
            options: {
              environment: process.env.NODE_ENV,
            },
          }),
        ],
      },
    },
  },
});
