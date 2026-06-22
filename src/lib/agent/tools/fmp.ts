import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// Define cache configuration
const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface UnifiedFinancialData {
  symbol: string;
  profile: any; // holds either FMP Profile or Alpha Vantage Overview
  incomeStatement: any[]; // standard array of annual reports
  balanceSheet: any[]; // standard array of annual reports
  cachedAt: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Helper to fetch data from FMP API endpoint.
 */
async function fetchFMP(endpointPath: string, symbol: string, apiKey: string, queryParams: string = ""): Promise<any> {
  const url = `https://financialmodelingprep.com/stable/${endpointPath}?symbol=${symbol}&apikey=${apiKey}${queryParams}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FMP HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  
  if (data && typeof data === "object" && !Array.isArray(data) && "Error Message" in data) {
    throw new Error(`FMP API error: ${data["Error Message"]}`);
  }
  
  return data;
}

/**
 * Helper to fetch data from Alpha Vantage API endpoint.
 */
async function fetchAlphaVantage(functionName: string, symbol: string, apiKey: string): Promise<any> {
  const url = `https://www.alphavantage.co/query?function=${functionName}&symbol=${symbol}&apikey=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Alpha Vantage HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  
  if (data["Note"] || data["Information"]) {
    const message = data["Note"] || data["Information"];
    throw new Error(`Alpha Vantage API warning/rate limit: ${message}`);
  }
  
  return data;
}

export const fmpTool = tool(
  async (input) => {
    const symbol = input.symbol.toUpperCase();
    console.log(`[tool] financials called with symbol: "${symbol}"`);

    const fmpCachePath = path.join(CACHE_DIR, `fmp_${symbol}.json`);
    const avCachePath = path.join(CACHE_DIR, `av_${symbol}.json`);

    // 1. Check local cache (FMP first)
    if (fs.existsSync(fmpCachePath)) {
      try {
        const stats = fs.statSync(fmpCachePath);
        const age = Date.now() - stats.mtimeMs;
        if (age < CACHE_EXPIRATION_MS) {
          const cachedContent = fs.readFileSync(fmpCachePath, "utf-8");
          const cachedData: UnifiedFinancialData = JSON.parse(cachedContent);
          console.log(`[tool] FMP cache hit for "${symbol}". Reading from local cache.`);
          return JSON.stringify({
            symbol: cachedData.symbol,
            profile: cachedData.profile,
            incomeStatement: cachedData.incomeStatement,
            balanceSheet: cachedData.balanceSheet,
            source: "fmp_cache",
          });
        }
      } catch (err: any) {
        console.warn(`[tool] Error reading FMP cache for ${symbol}:`, err.message);
      }
    }

    // 2. Check local cache (Alpha Vantage fallback)
    if (fs.existsSync(avCachePath)) {
      try {
        const stats = fs.statSync(avCachePath);
        const age = Date.now() - stats.mtimeMs;
        if (age < CACHE_EXPIRATION_MS) {
          const cachedContent = fs.readFileSync(avCachePath, "utf-8");
          const cachedData: UnifiedFinancialData = JSON.parse(cachedContent);
          console.log(`[tool] Alpha Vantage cache hit for "${symbol}". Reading from local cache.`);
          return JSON.stringify({
            symbol: cachedData.symbol,
            profile: cachedData.profile,
            incomeStatement: cachedData.incomeStatement,
            balanceSheet: cachedData.balanceSheet,
            source: "av_cache",
          });
        }
      } catch (err: any) {
        console.warn(`[tool] Error reading AV cache for ${symbol}:`, err.message);
      }
    }

    // Ensure cache directory exists
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }

    // 3. Try FMP API Fetch
    let fmpError: any = null;
    let fmpApiKey = process.env.FMP_API_KEY;
    if (fmpApiKey === "demo" || !fmpApiKey) {
      // If key is demo, let's proceed but catch legacy/limits
      fmpApiKey = fmpApiKey || "demo";
    }

    try {
      console.log(`[tool] Attempting FMP stable API fetch for "${symbol}"...`);
      
      const profileResponse = await fetchFMP("profile", symbol, fmpApiKey);
      const incomeResponse = await fetchFMP("income-statement", symbol, fmpApiKey, "&period=annual&limit=5");
      const balanceResponse = await fetchFMP("balance-sheet-statement", symbol, fmpApiKey, "&period=annual&limit=5");

      const profile = Array.isArray(profileResponse) && profileResponse.length > 0 ? profileResponse[0] : null;
      const incomeStatement = Array.isArray(incomeResponse) ? incomeResponse : [];
      const balanceSheet = Array.isArray(balanceResponse) ? balanceResponse : [];

      if (!profile && incomeStatement.length === 0 && balanceSheet.length === 0) {
        throw new Error("FMP returned empty financial statements.");
      }

      const mergedData: UnifiedFinancialData = {
        symbol,
        profile,
        incomeStatement,
        balanceSheet,
        cachedAt: new Date().toISOString(),
      };

      fs.writeFileSync(fmpCachePath, JSON.stringify(mergedData, null, 2), "utf-8");
      console.log(`[tool] Successfully created FMP cache file at: ${fmpCachePath}`);

      return JSON.stringify({
        symbol,
        profile,
        incomeStatement,
        balanceSheet,
        source: "fmp_api",
      });

    } catch (err: any) {
      fmpError = err;
      console.warn(`[tool] FMP fetch failed for "${symbol}": ${err.message}. Falling back to Alpha Vantage...`);
    }

    // 4. Try Alpha Vantage Fetch (Fallback)
    try {
      const avApiKey = process.env.ALPHA_VANTAGE_API_KEY;
      if (!avApiKey) {
        throw new Error("ALPHA_VANTAGE_API_KEY is not defined in environment variables.");
      }

      console.log(`[tool] Fetching fresh data from Alpha Vantage API for "${symbol}"...`);
      
      const overview = await fetchAlphaVantage("OVERVIEW", symbol, avApiKey);
      
      // Delay 1.5 seconds to respect burst limits (5 calls/min)
      await delay(1500);
      const incomeResponse = await fetchAlphaVantage("INCOME_STATEMENT", symbol, avApiKey);
      
      // Delay another 1.5 seconds
      await delay(1500);
      const balanceResponse = await fetchAlphaVantage("BALANCE_SHEET", symbol, avApiKey);

      if (!overview.Symbol && !incomeResponse.symbol && !balanceResponse.symbol) {
        throw new Error("Alpha Vantage returned invalid or empty statements.");
      }

      const incomeStatement = incomeResponse.annualReports || [];
      const balanceSheet = balanceResponse.annualReports || [];

      const mergedData: UnifiedFinancialData = {
        symbol,
        profile: overview,
        incomeStatement,
        balanceSheet,
        cachedAt: new Date().toISOString(),
      };

      fs.writeFileSync(avCachePath, JSON.stringify(mergedData, null, 2), "utf-8");
      console.log(`[tool] Successfully created Alpha Vantage cache file at: ${avCachePath}`);

      return JSON.stringify({
        symbol,
        profile: overview,
        incomeStatement,
        balanceSheet,
        source: "av_api",
      });

    } catch (avError: any) {
      console.error(`[tool] Alpha Vantage fetch failed for "${symbol}": ${avError.message}`);
      return `Error retrieving financials. FMP error: ${fmpError?.message || "unknown"}. Alpha Vantage error: ${avError.message}`;
    }
  },
  {
    name: "fmp_financials",
    description: "Get comprehensive financial statements and metadata (Company Profile, Income Statement, and Balance Sheet) using the stock ticker symbol.",
    schema: z.object({
      symbol: z.string().describe("The stock ticker symbol of the company (e.g., TSLA, MSFT, INFY.NS)"),
    }),
  }
);
