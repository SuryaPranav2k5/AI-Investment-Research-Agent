# AI Investment Research Agent

This project is an AI-powered Investment Research Agent designed as a take-home assignment for InsideIIM × Altuni AI Labs. The agent takes a company name, conducts comprehensive web and financial research, and makes a recommendation to **invest** or **pass** with detailed logical reasoning.

---

## 1. Overview
The application is built using Next.js (TypeScript) for the frontend/backend and LangGraph.js to coordinate the agentic reasoning loops. 

### Core Capabilities:
- **Ticker Identification**: Automatically resolves user-provided company names (e.g. "Tata Motors") to their correct stock tickers (e.g. "TTM").
- **Quantitative Financial Research**: Accesses company Overview, Income Statement, and Balance Sheet using the Alpha Vantage API.
- **Qualitative Web Research**: Gathers recent business news, industry trends, market sentiment, and competitor dynamics using the Tavily Search API.
- **Investment Assessment**: Evaluates the gathered financial data and qualitative reports to formulate an invest/pass recommendation, outputting a highly structured JSON verdict.

---

## 2. How to Run It

### Prerequisites
- Node.js (v18+)
- npm / yarn / pnpm

### Setup Steps
1. Clone the repository and navigate to the project directory:
   ```bash
   cd investment-agent
   ```
2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
3. Configure your API keys in the `.env.local` file at the root of the project:
   ```env
   # Gemini API Key (from Google AI Studio)
   GEMINI_API_KEY=YOUR_GEMINI_API_KEY
   
   # Tavily API Key (from tavily.com)
   TAVILY_API_KEY=YOUR_TAVILY_API_KEY
   
   # Alpha Vantage API Key (from alphavantage.co)
   ALPHA_VANTAGE_API_KEY=YOUR_ALPHA_VANTAGE_API_KEY

   # Optional: Model Override (defaults to gemini-2.5-flash if not specified)
   # For local development and bypassing daily quota limits, you can set this to: gemini-3.1-flash-lite
   GEMINI_MODEL=gemini-2.5-flash
   ```

### Running the Agent in Isolation (CLI)
You can run the agent as a standalone Node script to test its research and decision loop:
```bash
npx tsx src/lib/agent/test-agent.ts "Tata Motors"
```

### Running the Web Server
To start the Next.js development server:
```bash
npm run dev
```

---

## 3. How It Works (Architecture)

The agent utilizes a **ReAct (Reasoning + Acting) loop** orchestrated by LangGraph's `createReactAgent`.

```
[User Query] -> [ReAct Agent (Gemini 2.5 Flash)]
                      |
        +-------------+-------------+
        |                           |
        v                           v
 [Tavily Search Tool]     [Alpha Vantage Tool]
 (News & Symbol Search)   (Consolidated Financials)
                                    |
                                    v
                            [.cache/ Directory]
                        (24-Hour File Cache)
```

1. **Resolution Phase**: The agent uses `tavily_search` to find the company's ticker symbol.
2. **Retrieval Phase**: 
   - Queries `alphavantage_financials` with the resolved symbol to fetch overview and statements.
   - Queries `tavily_search` to fetch qualitative news and market developments.
3. **Analysis & Decision Phase**: The agent evaluates the metrics, compiles bull/bear arguments, estimates confidence (on a 0-100 scale), and writes a structured response matching the JSON schema.

---

## 4. Key Decisions & Trade-Offs

### Decisions:
- **LangGraph over Legacy Chains**: Utilized `@langchain/langgraph` to construct the ReAct agent. This provides more robust state management and aligns with current LangChain best practices.
- **Dynamic Model Selection**: Implemented the model selection fallback to `"gemini-2.5-flash"` for production environments while supporting a local `GEMINI_MODEL` override (e.g. to `"gemini-3.1-flash-lite"`) to handle quota limitations seamlessly.
- **Local File-Based Caching**: Alpha Vantage free tier is restricted to 25 requests/day. To prevent rate limit depletion during development, we implemented a local `.cache/` folder that preserves retrieved stock financials on disk for 24 hours.
- **Sequential Burst Throttling**: Added a 1.5-second delay between Alpha Vantage endpoint calls to prevent exceeding their 5 calls/minute burst limits.

### Trade-Offs:
- **Sequential vs. Parallel Tools**: We choose to wait for ticker resolution before calling Alpha Vantage. While this adds a small latency (1-2 seconds), it ensures we do not query the financial API with invalid symbol names.

---

## 5. Example Run
Running `npx tsx src/lib/agent/test-agent.ts "Tata Motors"` outputs:
```json
{
  "company": "Tata Motors Limited",
  "symbol": "TTM",
  "verdict": "invest",
  "confidence": 80,
  "reasoning": "Tata Motors has demonstrated a significant financial turnaround in the last two fiscal years, moving from substantial losses to strong profitability and showing robust revenue growth...",
  "bullCase": [
    "Continued strong growth in revenue and net income driven by demand for its vehicles, especially in the EV segment.",
    "Successful global expansion and increased market share in key segments."
  ],
  "bearCase": [
    "Intense competition in the global automotive and EV markets could hinder growth.",
    "Economic slowdowns or supply chain disruptions could impact production and sales."
  ],
  "risks": [
    "Market Competition: Highly competitive automotive industry, especially in the rapidly evolving EV space."
  ],
  "sources": [
    "Alpha Vantage Financials (for TTM)",
    "https://economictimes.indiatimes.com/tata-motors-ltd/stocksupdate/companyid-12934.cms"
  ]
}
```

---

## 6. What We Would Improve with More Time
- **Single-Stream Output Extraction (Duplicate Call Optimization)**: Currently, the backend calls the agent twice per request—once with `streamEvents` to collect real-time action logs, and once with `invoke` to retrieve the structured JSON verdict. This duplicates API calls and increases token usage/latency. In a production version, we would write a custom parser to extract the final message content directly from the event stream's state updates, reducing the API footprint to a single execution per request.
- **Database Caching**: Move local cache from file-based `.cache/` to a Redis instance or PostgreSQL database.
- **Extended Ratios**: Parse and compute advanced ratios (e.g. Altman Z-Score, DuPont Analysis) automatically inside the tool to supply the LLM with deeper mathematical evaluation.
- **Advanced Graph**: Customize the LangGraph structure to run qualitative search and quantitative checks in parallel steps before feeding into a dedicated decision node.
