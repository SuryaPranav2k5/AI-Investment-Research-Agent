import { NextRequest } from "next/server";
import { createInvestmentAgent } from "../../../lib/agent/agent";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company");

  if (!company) {
    return new Response(
      JSON.stringify({ error: "Missing company query parameter" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Helper to enqueue SSE data frames
      const sendEvent = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const agent = createInvestmentAgent();

        // 1. Start Step 1: Searching Ticker & News
        sendEvent({
          type: "step_start",
          step: 1,
          msg: "Searching for company ticker & news...",
        });

        // Invoke streamEvents to intercept tool call cycles
        const eventStream = await agent.streamEvents(
          {
            messages: [
              {
                role: "user",
                content: `Research the company "${company}" and decide whether to invest or pass.`,
              },
            ],
          },
          { version: "v2" }
        );

        let hasCalledFinancials = false;

        for await (const event of eventStream) {
          const eventType = event.event;

          if (eventType === "on_tool_start") {
            const toolName = event.name;
            const toolInput = event.data.input;

            // LangGraph wraps tool calls inside { input: string | object }.
            // We unwrap this to prevent double-stringification in SSE logs.
            let parsedInput = toolInput;
            if (toolInput && typeof toolInput === "object" && "input" in toolInput) {
              if (typeof toolInput.input === "string") {
                try {
                  parsedInput = JSON.parse(toolInput.input);
                } catch {
                  parsedInput = toolInput.input;
                }
              } else {
                parsedInput = toolInput.input;
              }
            }

            // Stream the clean tool call details
            sendEvent({
              type: "tool_call",
              tool: toolName,
              input: JSON.stringify(parsedInput),
            });

            // Transition to Step 2 when the financials tool is invoked
            if (toolName === "fmp_financials" && !hasCalledFinancials) {
              hasCalledFinancials = true;

              // Complete Step 1
              sendEvent({
                type: "step_done",
                step: 1,
              });

              // Start Step 2
              sendEvent({
                type: "step_start",
                step: 2,
                msg: "Fetching financial metrics...",
              });
            }
          } else if (eventType === "on_tool_end") {
            const toolName = event.name;
            const toolOutput = event.data.output;

            // Stream the tool output status
            sendEvent({
              type: "tool_result",
              tool: toolName,
              summary: `${toolName} returned data`,
              output: typeof toolOutput === "string" ? toolOutput : JSON.stringify(toolOutput),
            });
          }
        }

        // Close whatever step is currently open
        if (hasCalledFinancials) {
          sendEvent({
            type: "step_done",
            step: 2,
          });
        } else {
          sendEvent({
            type: "step_done",
            step: 1,
          });
        }

        // 2. Start Step 3: Synthesis & Verdict formulation
        sendEvent({
          type: "step_start",
          step: 3,
          msg: "Analyzing gathered research data and formulating verdict...",
        });

        // Invoke the agent to gather the final compiled structured JSON response
        const finalResult = await finalResultCall(agent, company);

        const lastMessage = finalResult.messages[finalResult.messages.length - 1];
        if (!lastMessage || !lastMessage.content) {
          throw new Error("No final verdict response received from the agent.");
        }

        let raw = lastMessage.content as string;

        // Strip potential markdown JSON code blocks
        raw = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

        let parsedVerdict;
        try {
          parsedVerdict = JSON.parse(raw);
        } catch (parseError: any) {
          console.warn("Failed to parse verdict JSON, falling back to raw output:", parseError.message);
          parsedVerdict = {
            company,
            verdict: "error",
            reasoning: raw,
            error: "Output was not valid JSON",
          };
        }

        // Stream the final structured verdict
        sendEvent({
          type: "verdict",
          data: parsedVerdict,
        });

        // Complete Step 3
        sendEvent({
          type: "step_done",
          step: 3,
        });

        // Close stream with a done event
        sendEvent({
          type: "done",
        });

      } catch (err: any) {
        console.error("Error in analyze streaming route:", err);
        sendEvent({
          type: "error",
          message: err.message || "An unknown error occurred during analysis.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}

/**
 * Isolated invocation execution.
 */
async function finalResultCall(agent: any, company: string) {
  return await agent.invoke({
    messages: [
      {
        role: "user",
        content: `Research the company "${company}" and decide whether to invest or pass.`,
      },
    ],
  });
}
