import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not defined in .env.local" },
        { status: 400 }
      );
    }

    // Initialize the Gemini model (gemini-2.5-flash is supported by the key)
    const model = new ChatGoogleGenerativeAI({
      apiKey: apiKey,
      model: "gemini-2.5-flash",
    });

    // Invoke the model with a simple prompt
    const response = await model.invoke("Hello, please confirm you are connected and responding correctly with a single sentence.");

    return NextResponse.json({
      status: "success",
      response: response.content,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      {
        status: "error",
        message: message,
      },
      { status: 500 }
    );
  }
}
