import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// Define cache configuration
const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface AlphaVantageData {
  symbol: string;
  overview: any;
  incomeStatement: any;
  balanceSheet: any;
  cachedAt: string;
}

/**
 * Helper to delay execution (sleep) to avoid API burst rate limits.
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch data from a specific Alpha Vantage endpoint.
 */
async function fetchAlphaVantage(functionName: string, symbol: string, apiKey: string): Promise<any> {
  const url = `https://www.alphavantage.co/query?function=${functionName}&symbol=${symbol}&apikey=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Alpha Vantage HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  
  // Alpha Vantage returns a "Note" or "Information" property when rate limited or on free tier warnings
  if (data["Note"] || data["Information"]) {
    const message = data["Note"] || data["Information"];
    throw new Error(`Alpha Vantage API warning/rate limit: ${message}`);
  }
  
  return data;
}

export const alphaVantageTool = tool(
  async (input) => {
    const symbol = input.symbol.toUpperCase();
    console.log(`[tool] alphavantage called with: "${symbol}"`);

    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (!apiKey) {
      return "Error: ALPHA_VANTAGE_API_KEY is not defined in the environment variables.";
    }

    const cachePath = path.join(CACHE_DIR, `${symbol}.json`);

    // 1. Check local cache
    if (fs.existsSync(cachePath)) {
      try {
        const stats = fs.statSync(cachePath);
        const age = Date.now() - stats.mtimeMs;
        if (age < CACHE_EXPIRATION_MS) {
          const cachedContent = fs.readFileSync(cachePath, "utf-8");
          const cachedData: AlphaVantageData = JSON.parse(cachedContent);
          console.log(`[tool] alphavantage cache hit for "${symbol}". Reading from local cache.`);
          return JSON.stringify({
            symbol: cachedData.symbol,
            overview: cachedData.overview,
            incomeStatement: cachedData.incomeStatement,
            balanceSheet: cachedData.balanceSheet,
            source: "local_cache",
          });
        }
      } catch (err: any) {
        console.warn(`[tool] Error reading cache for ${symbol}, falling back to API:`, err.message);
      }
    }

    // 2. Fetch fresh data from Alpha Vantage API
    try {
      console.log(`[tool] Fetching fresh data from Alpha Vantage API for "${symbol}"...`);
      
      const overview = await fetchAlphaVantage("OVERVIEW", symbol, apiKey);
      
      // Delay 1.5 seconds to respect the 5 calls/min limit (prevents burst blocking)
      await delay(1500);
      const incomeStatement = await fetchAlphaVantage("INCOME_STATEMENT", symbol, apiKey);
      
      // Delay another 1.5 seconds
      await delay(1500);
      const balanceSheet = await fetchAlphaVantage("BALANCE_SHEET", symbol, apiKey);

      // Verify that we actually received valid data and not empty/error responses
      if (!overview.Symbol && !incomeStatement.symbol && !balanceSheet.symbol) {
        return `Error: Alpha Vantage did not return valid data for symbol "${symbol}". Ensure the symbol is correct.`;
      }

      const mergedData: AlphaVantageData = {
        symbol,
        overview,
        incomeStatement,
        balanceSheet,
        cachedAt: new Date().toISOString(),
      };

      // Ensure cache directory exists
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }

      // Write to cache
      fs.writeFileSync(cachePath, JSON.stringify(mergedData, null, 2), "utf-8");
      console.log(`[tool] Successfully created cache file at: ${cachePath}`);

      return JSON.stringify({
        symbol,
        overview,
        incomeStatement,
        balanceSheet,
        source: "api_fetch",
      });
    } catch (error: any) {
      return `Error retrieving data from Alpha Vantage API: ${error.message}`;
    }
  },
  {
    name: "alphavantage_financials",
    description: "Get comprehensive financial statements (Company Overview, Income Statement, and Balance Sheet) for a company using its exact stock ticker symbol.",
    schema: z.object({
      symbol: z.string().describe("The exact stock ticker symbol of the company (e.g., TSLA, MSFT, TATAMOTORS.BSE)"),
    }),
  }
);
