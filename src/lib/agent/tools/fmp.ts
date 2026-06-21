import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// Define cache configuration
const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface FMPData {
  symbol: string;
  profile: any;
  incomeStatement: any;
  balanceSheet: any;
  cachedAt: string;
}

/**
 * Helper to fetch data from FMP API endpoint.
 */
async function fetchFMP(endpointPath: string, symbol: string, apiKey: string, queryParams: string = ""): Promise<any> {
  const url = `https://financialmodelingprep.com/api/v3/${endpointPath}/${symbol}?apikey=${apiKey}${queryParams}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FMP HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  
  // Handle FMP error responses or limit warnings
  if (data && typeof data === "object" && "Error Message" in data) {
    throw new Error(`FMP API error: ${data["Error Message"]}`);
  }
  
  return data;
}

export const fmpTool = tool(
  async (input) => {
    const symbol = input.symbol.toUpperCase();
    console.log(`[tool] fmp called with symbol: "${symbol}"`);

    let apiKey = process.env.FMP_API_KEY;
    if (!apiKey) {
      console.warn("[tool] FMP_API_KEY is not defined. Falling back to 'demo' key.");
      apiKey = "demo";
    }

    const cachePath = path.join(CACHE_DIR, `fmp_${symbol}.json`);

    // 1. Check local cache
    if (fs.existsSync(cachePath)) {
      try {
        const stats = fs.statSync(cachePath);
        const age = Date.now() - stats.mtimeMs;
        if (age < CACHE_EXPIRATION_MS) {
          const cachedContent = fs.readFileSync(cachePath, "utf-8");
          const cachedData: FMPData = JSON.parse(cachedContent);
          console.log(`[tool] fmp cache hit for "${symbol}". Reading from local cache.`);
          return JSON.stringify({
            symbol: cachedData.symbol,
            profile: cachedData.profile,
            incomeStatement: cachedData.incomeStatement,
            balanceSheet: cachedData.balanceSheet,
            source: "local_cache",
          });
        }
      } catch (err: any) {
        console.warn(`[tool] Error reading cache for ${symbol}, falling back to API:`, err.message);
      }
    }

    // 2. Fetch fresh data from FMP API
    try {
      console.log(`[tool] Fetching fresh data from FMP API for "${symbol}"...`);
      
      const profileResponse = await fetchFMP("profile", symbol, apiKey);
      const incomeResponse = await fetchFMP("income-statement", symbol, apiKey, "&period=annual&limit=5");
      const balanceResponse = await fetchFMP("balance-sheet-statement", symbol, apiKey, "&period=annual&limit=5");

      // FMP returns profiles as an array. Extract the first profile object.
      const profile = Array.isArray(profileResponse) && profileResponse.length > 0 ? profileResponse[0] : null;
      const incomeStatement = Array.isArray(incomeResponse) ? incomeResponse : [];
      const balanceSheet = Array.isArray(balanceResponse) ? balanceResponse : [];

      if (!profile && incomeStatement.length === 0 && balanceSheet.length === 0) {
        return `Error: FMP did not return any data for symbol "${symbol}". Ensure the symbol is correct and valid on FMP.`;
      }

      const mergedData: FMPData = {
        symbol,
        profile,
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
      console.log(`[tool] Successfully created FMP cache file at: ${cachePath}`);

      return JSON.stringify({
        symbol,
        profile,
        incomeStatement,
        balanceSheet,
        source: "api_fetch",
      });
    } catch (error: any) {
      return `Error retrieving data from FMP API: ${error.message}`;
    }
  },
  {
    name: "fmp_financials",
    description: "Get comprehensive financial statements and metadata (Company Profile, Income Statement, and Balance Sheet) for a company using its exact stock ticker symbol.",
    schema: z.object({
      symbol: z.string().describe("The exact stock ticker symbol of the company (e.g., TSLA, MSFT, INFY.NS)"),
    }),
  }
);
