import { tool } from "ai";
import { z } from "zod";

export const vercelWeatherTool = tool({
  description: "Vercel AI SDK形式で現在の天気を取得します",
  inputSchema: z.object({
    location: z.string().describe('天気を取得する地域'),
  }),
  execute: async ({ location }) => {
    // モックの天気データを返す
    return {
      location: location,
      temperature: "22°C",
      conditions: "晴れ時々曇り",
      humidity: "65%",
      windSpeed: "12 km/h",
      lastUpdated: new Date().toLocaleString('ja-JP'),
    };
  },
});