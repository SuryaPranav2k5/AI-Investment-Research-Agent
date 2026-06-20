import { TavilySearch } from "@langchain/tavily";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Custom-logged Tavily Search tool wrapper.
 * Meets the requirement to log: [tool] tavily_search called with: "..."
 * Lazy initializes TavilySearch inside the tool execution to prevent hoisting issues with environment variables.
 */
export const tavilySearchTool = tool(
  async (input) => {
    console.log(`[tool] tavily_search called with: "${input.query}"`);
    try {
      // Lazy instantiate to ensure environment variables are fully loaded first
      const searchTool = new TavilySearch({
        maxResults: 5,
      });
      const results = await searchTool.invoke(input);
      return results;
    } catch (error: any) {
      return `Error performing web search: ${error.message}`;
    }
  },
  {
    name: "tavily_search",
    description: "Search the web for recent news, articles, developments, and general information about a company.",
    schema: z.object({
      query: z.string().describe("The search query to run on the web"),
    }),
  }
);
