# AI Investment Research Agent

This project is an AI-powered Investment Research Agent designed as a take-home assignment for InsideIIM × Altuni AI Labs. The agent takes a company name, conducts comprehensive web and financial research, and makes a recommendation to **invest** or **pass** with detailed logical reasoning.

---

## 1. Overview
The application is built using Next.js (TypeScript) for the frontend/backend and LangGraph.js to coordinate the agentic reasoning loops. 

### Core Capabilities:
- **Ticker Identification**: Automatically resolves user-provided company names (e.g. "Tata Motors") to their correct stock tickers (e.g. "TTM").
- **Quantitative Financial Research**: Accesses company Profile, Income Statement, and Balance Sheet using the Financial Modeling Prep (FMP) API.
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
   
   # Financial Modeling Prep API Key (from financialmodelingprep.com)
   FMP_API_KEY=YOUR_FMP_API_KEY

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
 [Tavily Search Tool]     [FMP Financials Tool]
 (News & Symbol Search)   (Consolidated Financials)
                                    |
                                    v
                            [.cache/ Directory]
                        (24-Hour File Cache)
```

1. **Resolution Phase**: The agent uses `tavily_search` to find the company's ticker symbol.
2. **Retrieval Phase**: 
   - Queries `fmp_financials` with the resolved symbol to fetch profile and statements.
   - Queries `tavily_search` to fetch qualitative news and market developments.
3. **Analysis & Decision Phase**: The agent evaluates the metrics, compiles bull/bear arguments, estimates confidence (on a 0-100 scale), and writes a structured response matching the JSON schema.

---

## 4. Key Decisions & Trade-Offs

### Decisions:
- **LangGraph over Legacy Chains**: Utilized `@langchain/langgraph` to construct the ReAct agent. This provides more robust state management and aligns with current LangChain best practices.
- **Dynamic Model Selection**: Implemented the model selection fallback to `"gemini-2.5-flash"` for production environments while supporting a local `GEMINI_MODEL` override (e.g. to `"gemini-3.1-flash-lite"`) to handle quota limitations seamlessly.
- **Local File-Based Caching**: FMP API responses are cached locally in the `.cache/` directory for 24 hours. This minimizes credit usage and ensures fast load times for subsequent runs.
- **Improved Performance**: Switched from Alpha Vantage (which required 1.5-second throttling delays to respect free-tier burst limits) to FMP, allowing for sequential API requests with zero latency delays, drastically improving agent response time.

### Trade-Offs:
- **Sequential vs. Parallel Tools**: We choose to wait for ticker resolution before calling FMP. While this adds a small latency, it ensures we do not query the financial API with invalid symbol names.

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

## 6. Developer Log Inspection & Anti-Hallucination Guardrails

### Raw Tool Logs Inspector
The application includes a collapsible **Raw Tool Execution Logs** panel at the bottom of the dashboard layout.
- Styled as a dark developer console (`inspect_payloads.sh`), this panel shows the exact parameters passed to tools and the actual JSON output returned from the network.
- **Display Truncation**: To prevent large payloads (e.g., voluminous FMP financial statements or search news feeds) from cluttering the layout, payloads are truncated to 500 characters by default. 
- Users can click **Show More** to expand the log inline or **Show Less** to collapse it back.

### Anti-Hallucination Prompt Tuning
To prevent the LLM from hallucinating or making up metrics for micro-cap or obscure companies, we implemented explicit prompt guardrails in `agent.ts`:
- **Strict Data Verification**: Every financial figure (P/E, revenue, margins, debt/equity) must be fetched directly from a tool response.
- **Explicit Fallbacks**: If a metric is missing from the API tool result, the agent must output `"N/A"`. Substituting assumptions, estimates, or training dataset knowledge is strictly forbidden.
- **Resilient Tool Cascades**: If the FMP API fails or returns unauthorized/unsupported symbols, the agent seamlessly cascades to Tavily news search queries to gather financial disclosures and verify data points.

---

## 7. What We Would Improve with More Time
- **Single-Stream Output Extraction (Duplicate Call Optimization)**: Currently, the backend calls the agent twice per request—once with `streamEvents` to collect real-time action logs, and once with `invoke` to retrieve the structured JSON verdict. This duplicates API calls and increases token usage/latency. In a production version, we would write a custom parser to extract the final message content directly from the event stream's state updates, reducing the API footprint to a single execution per request.
- **Database Caching**: Move local cache from file-based `.cache/` to a Redis instance or PostgreSQL database.
- **Extended Ratios**: Parse and compute advanced ratios (e.g. Altman Z-Score, DuPont Analysis) automatically inside the tool to supply the LLM with deeper mathematical evaluation.
- **Advanced Graph**: Customize the LangGraph structure to run qualitative search and quantitative checks in parallel steps before feeding into a dedicated decision node.

