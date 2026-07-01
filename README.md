# AI Investment Research Agent

This project is an AI-powered Investment Research Agent designed as a take-home assignment for InsideIIM × Altuni AI Labs. The agent takes a company name, conducts comprehensive web and financial research, and makes a recommendation to **invest** or **pass** with detailed logical reasoning.

*   **Live Vercel Deployment**: [https://ai-investment-research-agent-sand.vercel.app/](https://ai-investment-research-agent-sand.vercel.app/)
*   **LLM Chat Session logs**: The complete, human-readable pair-programming interaction transcript is packaged in the root directory as [`Setting Up Investment Agent App.md`](file:///D:/Model/investment-agent/Setting%20Up%20Investment%20Agent%20App.md) to fulfill the bonus points requirement. It details all user queries, design pivots, and helper actions in chronological order.

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
   
   # Exa AI API Key (from exa.ai)
   EXA_API_KEY=YOUR_EXA_API_KEY

   # Financial Modeling Prep API Key (from financialmodelingprep.com)
   FMP_API_KEY=YOUR_FMP_API_KEY

   # Alpha Vantage API Key (fallback database from alphavantage.co)
   ALPHA_VANTAGE_API_KEY=YOUR_ALPHA_VANTAGE_API_KEY

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
- **Single-Stream Output Extraction**: The backend extracts the final JSON verdict directly from the `streamEvents` stream context. This eliminates the duplicate execution call (which previously ran `streamEvents` then `invoke`), cutting API credit usage by 50% and reducing latency by 5-10 seconds per request.

### Trade-Offs:
- **Sequential vs. Parallel Tools**: We choose to wait for ticker resolution before calling FMP. While this adds a small latency, it ensures we do not query the financial API with invalid symbol names.

---

## 6. Example Runs

### Example 1: Apple Inc. (AAPL) — "invest" Verdict (Full JSON Output)
```json
{
  "reasoning": "Apple remains a high-quality, resilient compounder with a massive installed base of 2.5 billion devices. The company is successfully executing a strategic mix shift toward high-margin Services, which now contribute significantly to profitability. While the company faces near-term headwinds from rising memory costs and geopolitical risks in China, its ability to maintain strong gross margins and generate massive free cash flow provides a solid foundation. The stock is currently priced for continued growth, and while valuation is at a premium, the company's ability to return capital to shareholders and its ongoing innovation in AI and hardware keep it as a core holding for long-term investors.",
  "scoreDerivation": "Financial Score Calculation: Base Score (50) + Valuation (0 points for P/E of 38.63, which is > 35) + Balance Sheet Health (15 points for D/E of 1.52, which is between 1.0 and 2.0) + Growth Trends (10 points for Revenue Growth of 6.43% and Net Income Growth of 19.49% - both > 5%) + Profitability (10 points for Operating Margin of 31.97% > 25%). Total Financial Score: 50 + 0 + 15 + 10 + 10 = 85. Confidence Score: 85 (Financial) + 5 (moderate moat/1-2 catalysts) - 5 (moderate risks) = 85.",
  "company": "Apple Inc.",
  "symbol": "AAPL",
  "verdict": "invest",
  "confidence": 85,
  "financialScore": 85,
  "newsSentiment": "bullish",
  "marketConsensus": "buy",
  "riskLevel": "medium",
  "metrics": {
    "peRatio": "38.63",
    "debtToEquity": "1.52",
    "operatingMargin": "31.97%",
    "grossMargin": "46.91%",
    "revenueGrowthYoY": "6.43%",
    "netIncomeGrowthYoY": "19.49%",
    "revenue": "$416.16B",
    "netIncome": "$112.01B"
  },
  "bullCase": [
    "Strong Services segment growth with high margins (76.5%+).",
    "Massive installed base of 2.5 billion active devices driving recurring revenue.",
    "Consistent capital return program through dividends and massive share buybacks."
  ],
  "bearCase": [
    "Rising memory component costs pressuring gross margins.",
    "Geopolitical risks and intense competition in the Greater China market.",
    "Regulatory scrutiny regarding the Google search payment and App Store practices."
  ],
  "risks": [
    "Supply chain constraints for key hardware products.",
    "Potential loss of high-margin licensing revenue from Google search.",
    "Slowing consumer demand in mature hardware categories."
  ],
  "sources": [
    "Financial Modeling Prep (FMP) Financial Statements (FY2025)",
    "Deep Research Global: Apple (AAPL) Fundamental Analysis Report 2026",
    "TIKR.com: Apple Stock Posts $111B Record Quarter",
    "AlphaGridHub: Apple (AAPL) Fundamentals 2026",
    "TickerSpark: Apple (AAPL) Premium Growth at a Premium Price",
    "Tickeron: Apple Inc. (AAPL) Stock Analysis"
  ]
}
```

### Example 2: Tesla, Inc. (TSLA) — "pass" Verdict (Full JSON Output)
```json
{
  "reasoning": "Tesla is currently transitioning from a pure-play EV manufacturer to an AI and robotics-focused enterprise. While its core automotive business faces significant headwinds, including declining annual delivery volumes, intense global competition, and margin compression, the company's valuation is increasingly supported by its long-term optionality in autonomous driving (FSD/Robotaxi), energy storage, and humanoid robotics. The financial performance in 2025 showed a contraction in net income and revenue growth, reflecting these challenges. Given the high valuation, mixed analyst sentiment, and the execution risk associated with its AI-driven growth pillars, a cautious approach is warranted.",
  "scoreDerivation": "Financial Score Calculation: Base Score (50) + Valuation (-10 for P/E > 35) + Balance Sheet Health (+15 for D/E < 1.0) + Growth Trends (+0 for both growth rates < 5%) + Profitability (+0 for Operating Margin < 15%) = 55. Confidence Calculation: Financial Score (55) + Moat & Catalysts (+5 for moderate moat/catalysts) + Risk Adjustments (-5 for moderate risks) = 55.",
  "company": "Tesla, Inc.",
  "symbol": "TSLA",
  "verdict": "pass",
  "confidence": 55,
  "financialScore": 55,
  "newsSentiment": "neutral",
  "marketConsensus": "hold",
  "riskLevel": "medium",
  "metrics": {
    "peRatio": "356.44",
    "debtToEquity": "0.10",
    "operatingMargin": "4.6%",
    "grossMargin": "18.0%",
    "revenueGrowthYoY": "-2.9%",
    "netIncomeGrowthYoY": "-46.8%",
    "revenue": "$94.83B",
    "netIncome": "$3.79B"
  },
  "bullCase": [
    "Leadership in autonomous driving technology (FSD) and potential for high-margin software revenue.",
    "Strong growth in the Energy Generation and Storage segment, which is becoming a significant contributor to profit.",
    "Significant long-term optionality in robotics (Optimus) and AI-driven fleet services."
  ],
  "bearCase": [
    "Core automotive business is experiencing volume contraction and margin pressure due to intense global competition.",
    "High valuation multiples are difficult to justify based on current automotive earnings alone.",
    "Execution risk remains high for the transition to a robotaxi-centric business model."
  ],
  "risks": [
    "Intense competition in the EV market, particularly from Chinese manufacturers, impacting pricing power.",
    "Regulatory and safety hurdles for widespread autonomous driving deployment.",
    "Sensitivity to macroeconomic factors and the potential for further demand softening in key markets."
  ],
  "sources": [
    "Financial Modeling Prep (FMP) API - Financial Statements (2021-2025)",
    "MarketBeat - Tesla Analyst Ratings and Forecast (June 2026)",
    "Benzinga - Tesla Analyst Ratings and Price Targets (June 2026)",
    "DeepResearchGlobal - Fundamental Analysis Report (June 2026)",
    "Public.com - Tesla Stock Forecast and Analyst Ratings (June 2026)"
  ]
}
```

---

## 7. Compare Mode (Side-by-Side Analysis Engine)

The dashboard includes a dedicated **Compare Engine** mode enabling users to analyze two companies side-by-side.

### Core Capabilities & Architecture:
- **Parallel Client Connections**: The React dashboard triggers two concurrent, non-blocking `EventSource` connections to `/api/analyze`, requesting streams for both Company A and Company B simultaneously.
- **Consolidated Prefixed Terminal**: Logs from both streams are merged in real-time within the terminal console, prefixed with `[A]` and `[B]` tags to clearly showcase parallel multi-agent execution and orchestration.
- **Comparison Summary Matrix**: Once both streams finish, a high-level matrix table aggregates and compares key statistics side-by-side: Ticker Symbol, AI Research Verdict, Confidence Score, Financial Score, News Sentiment, Consensus, Risk Level, Bull Catalysts, and Risk Factors.
- **Side-by-Side Verdict Reports**: Detailed cards for both companies are rendered adjacent to each other, allowing for direct comparison of qualitative reasons, catalysts, risks, and cited sources.

---

## 8. What We Would Improve with More Time
- **Database Caching**: Move local cache from file-based `.cache/` to a Redis instance or PostgreSQL database.
- **Claim-Level Evidence Attribution**: Tag each verdict claim with the exact tool and source that verified it, making hallucination detection transparent at the individual statement level.
- **Extended Ratios**: Parse and compute advanced ratios (e.g. Altman Z-Score, DuPont Analysis) automatically inside the tool to supply the LLM with deeper mathematical evaluation.
- **Advanced Graph**: Customize the LangGraph structure to run qualitative search and quantitative checks in parallel steps before feeding into a dedicated decision node.
