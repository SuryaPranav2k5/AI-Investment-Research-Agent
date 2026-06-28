# AI Investment Research Agent

This project is an AI-powered Investment Research Agent designed as a take-home assignment for InsideIIM × Altuni AI Labs. The agent takes a company name, conducts comprehensive web and financial research, and makes a recommendation to **invest** or **pass** with detailed logical reasoning.

---

## 1. Overview
The application is built using Next.js (TypeScript) for the frontend/backend and LangGraph.js to coordinate the agentic reasoning loops. 

### Core Capabilities:
- **Ticker Identification**: Automatically resolves user-provided company names (e.g. "Tata Motors") to their correct stock tickers (e.g. "TTM").
- **Quantitative Financial Research**: Accesses company Profile, Income Statement, and Balance Sheet using the Financial Modeling Prep (FMP) API, falling back to Alpha Vantage if needed.
- **Qualitative Web Research (Tavily)**: Gathers recent business news, real-time events, and timeline-sensitive keyword disclosures from the last 6 months.
- **Expert & Analyst Research (Exa)**: Performs semantic, neural-based search queries to extract industry analyst reports, fundamental moats, and expert consensus.
- **Market Sentiment Dashboard**: Computes and displays quantitative/qualitative metrics (`financialScore`, `newsSentiment`, `marketConsensus`, and `riskLevel`) using strict mapping logic.
- **Investment Assessment**: Evaluates the gathered financial data and qualitative reports to formulate an invest/pass recommendation, outputting a highly structured JSON verdict.

---

## 2. How to Run It

### Prerequisites
- Node.js (v18+)
- npm / yarn / pnpm

### Setup Steps
1. Clone the repository and navigate to the project directory:
   ```bash
    cd "Inside IIM"
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
   
   # Exa AI API Key (from exa.ai)
   EXA_API_KEY=YOUR_EXA_API_KEY
   
   # Financial Modeling Prep API Key (from financialmodelingprep.com)
   FMP_API_KEY=YOUR_FMP_API_KEY

   # Optional: Model Override (defaults to gemini-2.5-flash if not specified)
   # For local development, you can uncomment this to override the default model string:
   # GEMINI_MODEL=gemini-3.1-flash-lite
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
[User Query] -> [ReAct Agent (Gemini)]
                       |
        +--------------+--------------+
        |              |              |
        v              v              v
   [Tavily]          [Exa]          [FMP]
 (Recent News)   (Expert Views)  (Financials)
                                      |
                                      v
                              [.cache/ Directory]
                            (24-Hour File Cache)
```

1. **Resolution Phase**: The agent uses `tavily_search` to find the company's ticker symbol.
2. **Retrieval Phase**: 
   - Queries `fmp_financials` with the resolved symbol to fetch profile and statements (caches for 24 hours).
   - Queries `tavily_search` for breaking news, real-time events, and sentiment under 6 months old.
   - Queries `exa_search` for analyst consensus, expert evaluations, competitive moat analysis, and industry fundamentals.
3. **Analysis & Decision Phase**: The agent evaluates the metrics, compiles bull/bear arguments, estimates confidence (on a 0-100 scale), and writes a structured response matching the JSON schema.

---

## 4. Market Sentiment & Decision Indicators

The agent calculates and outputs four key sentiment and health indicators:
- **Financial Score (0-100)**: Derived mathematically by summing:
  - Base Score: `50`
  - Valuation (Trailing P/E): Under 20 (+10), 20 to 30 (+5), 30 to 35 (+0), Over 35 (-10).
  - Balance Sheet (D/E): Under 1.0 (+15), 1.0 to 2.0 (+10), Over 2.0 (+0).
  - Growth Trends (YoY Rev & NI Growth): Both > 10% (+15), Both > 5% (+10), Only one > 5% (+5), Otherwise (+0).
  - Profitability (Operating Margin): Over 25% (+10), 15% to 25% (+5), Under 15% (+0).
- **News Sentiment**: `"bullish"` | `"bearish"` | `"neutral"` based on news searches.
- **Risk Level**: `"low"` | `"medium"` | `"high"` based on debt leverage, valuations, and geopolitical regulatory exposures.
- **Market Consensus**: Mapped strictly using conditional rules:
  - `"strong buy"`: `financialScore > 80` AND `newsSentiment = bullish`
  - `"buy"`: `financialScore` is 65 to 80 OR (`financialScore > 65` and `newsSentiment = neutral`)
  - `"hold"`: mixed signals OR `financialScore` is 45 to 65
  - `"sell"`: `financialScore < 45` OR (`riskLevel = high` and `newsSentiment = bearish`)
  - `"underperform"`: `financialScore < 30` AND `newsSentiment = bearish` AND `riskLevel = high`

These metrics are rendered at the top of the verdict card in Single Mode and side-by-side inside the comparison matrix.

---

## 5. Key Decisions & Trade-Offs

### Decisions:
- **Autoregressive Prompt Schema Alignment**: Reordered the JSON schema in the prompt to place the `"reasoning"` and `"scoreDerivation"` keys at the very top. This forces the LLM to output its mathematical scratchpad calculations *before* outputting the final numeric scores (`financialScore`, `confidence`). This prevents the autoregressive LLM from hallucinating or rounding final ratings.
- **Dual-Search Traffic Splitting**: Separated search responsibilities between Tavily (speed and recency) and Exa (semantic depth and expert perspective), maximizing data relevance.
- **Local File-Based Caching**: FMP/Alpha Vantage responses are cached locally in the `.cache/` directory for 24 hours. This minimizes credit usage and ensures fast load times for subsequent runs.
- **Resilient Tool Cascades**: If the FMP API fails or returns unauthorized/unsupported symbols, the agent seamlessly cascades to Tavily news search queries to gather financial disclosures and verify data points.

### Trade-Offs:
- **Sequential vs. Parallel Tools**: We choose to wait for ticker resolution before calling FMP. While this adds a small latency, it ensures we do not query the financial API with invalid symbol names.

---

## 6. Compare Mode (Side-by-Side Analysis Engine)

The dashboard includes a dedicated **Compare Engine** mode enabling users to analyze two companies side-by-side.

### Core Capabilities & Architecture:
- **Parallel Client Connections**: The React dashboard triggers two concurrent, non-blocking `EventSource` connections to `/api/analyze`, requesting streams for both Company A and Company B simultaneously.
- **Consolidated Prefixed Terminal**: Logs from both streams are merged in real-time within the terminal console, prefixed with `[A]` and `[B]` tags to clearly showcase parallel multi-agent execution and orchestration.
- **Comparison Summary Matrix**: Once both streams finish, a high-level matrix table aggregates and compares key statistics side-by-side: Ticker Symbol, AI Research Verdict, Confidence Score, Financial Score, News Sentiment, Consensus, Risk Level, Bull Catalysts, and Risk Factors.
- **Side-by-Side Verdict Reports**: Detailed cards for both companies are rendered adjacent to each other, allowing for direct comparison of qualitative reasons, catalysts, risks, and cited sources.

---

## 7. What We Would Improve with More Time
- **Single-Stream Output Extraction (Duplicate Call Optimization)**: Currently, the backend calls the agent twice per request—once with `streamEvents` to collect real-time action logs, and once with `invoke` to retrieve the structured JSON verdict. This duplicates API calls and increases token usage/latency. In a production version, we would write a custom parser to extract the final message content directly from the event stream's state updates, reducing the API footprint to a single execution per request.
- **Database Caching**: Move local cache from file-based `.cache/` to a Redis instance or PostgreSQL database.
- **Claim-Level Evidence Attribution**: Tag each verdict claim with the exact tool and source that verified it, making hallucination detection transparent at the individual statement level.
- **Extended Ratios**: Parse and compute advanced ratios (e.g. Altman Z-Score, DuPont Analysis) automatically inside the tool to supply the LLM with deeper mathematical evaluation.
- **Advanced Graph**: Customize the LangGraph structure to run qualitative search and quantitative checks in parallel steps before feeding into a dedicated decision node.
