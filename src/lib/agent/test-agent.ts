import { loadEnvConfig } from "@next/env";
// Load Next.js environment variables (.env.local) first
loadEnvConfig(process.cwd());

import { createInvestmentAgent } from "./agent";

async function main() {
  const company = process.argv[2] || "Tata Motors";
  console.log(`Starting Investment Research Agent for company: "${company}"...`);

  try {
    const agent = createInvestmentAgent();

    // Invoke the agent
    const response = await agent.invoke({
      messages: [
        {
          role: "user",
          content: `Research the company "${company}" and decide whether to invest or pass.`,
        },
      ],
    });

    console.log("\n--- Agent Execution Complete ---");

    // Retrieve the final message from the agent
    const lastMessage = response.messages[response.messages.length - 1];
    if (!lastMessage || !lastMessage.content) {
      throw new Error("No response message received from the agent.");
    }

    let raw = lastMessage.content as string;
    
    // Clean up potential markdown JSON code fences
    raw = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    // Parse to verify JSON structure
    const parsed = JSON.parse(raw);
    console.log("JSON valid ✓");
    console.log(JSON.stringify(parsed, null, 2));

  } catch (error: unknown) {
    console.error("\nExecution Failed!");
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error("Error:", errMsg);
    if (errStack) {
      console.error(errStack);
    }
    process.exit(1);
  }
}

main();
