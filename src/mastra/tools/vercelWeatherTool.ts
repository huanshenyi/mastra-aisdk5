import { tool } from "ai";
import { z } from "zod";

export const vercelWeatherTool = tool({
  description: "Fetches current weather using Vercel AI SDK format",
  inputSchema: z.object({
    location: z.string().describe('The location to get the weather for'),
  }),
  execute: async ({ location }) => {
    console.log(`Fetching weather for ${location} (Vercel format tool)`);

    // Return mock weather data
    return {
      location: location,
      temperature: "22°C",
      conditions: "Partly cloudy",
      humidity: "65%",
      windSpeed: "12 km/h",
      lastUpdated: new Date().toLocaleString(),
    };
  },
});