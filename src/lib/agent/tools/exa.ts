import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Custom Exa Neural/Semantic Search tool.
 * Logs execution in the format: [tool] exa_search called with: "..."
 * Utilizes direct HTTP requests to avoid version constraints with external SDKs.
 */
export const exaSearchTool = tool(
  async (input) => {
    console.log(`[tool] exa_search called with: "${input.query}"`);
    
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) {
      return "Error: EXA_API_KEY is not defined in environment variables.";
    }

    try {
      const response = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          query: input.query,
          numResults: 5,
          highlights: true,
          contents: {
            highlights: true,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Exa HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.results || data.results.length === 0) {
        return "No conceptual expert analysis or analyst opinions found.";
      }

      const formatted = data.results
        .map((res: any, idx: number) => {
          const highlightsStr = Array.isArray(res.highlights)
            ? res.highlights.join(" ... ")
            : "No highlight summary available.";
          return `[Expert Source ${idx + 1}] Title: ${res.title}\nURL: ${res.url}\nPublished Date: ${res.publishedDate || "N/A"}\nExpert Insights: ${highlightsStr}`;
        })
        .join("\n\n");

      return formatted;
    } catch (error: any) {
      return `Error performing Exa semantic search: ${error.message}`;
    }
  },
  {
    name: "exa_search",
    description: "Search the web using neural semantic algorithms. Best for analyst opinions, expert consensus, fundamentals, industry positioning, and answering conceptual questions (e.g. 'what do experts say about X'). Avoid using for breaking news under 6 months old.",
    schema: z.object({
      query: z.string().describe("The semantic/neural search query to search for expert analyst opinions or industry fundamentals"),
    }),
  }
);
