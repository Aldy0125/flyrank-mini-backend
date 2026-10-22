
import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is missing in .env.local" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const prompt =
      typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json(
        { error: "Please provide a prompt." },
        { status: 400 }
      );
    }

    const client = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });

const completion = await client.chat.completions.create({
  model: "openai/gpt-oss-20b",
  messages: [
    {
      role: "system",
      content:
        "You are a binary decision engine. Answer with exactly one word: YES or NO. Do not provide explanations or punctuation.",
    },
    {
      role: "user",
      content: prompt,
    },
  ],
  temperature: 0,
  max_completion_tokens: 1024,
});
    const answer =
      completion.choices[0]?.message?.content?.trim().toUpperCase() ?? "";

    if (answer !== "YES" && answer !== "NO") {
      return NextResponse.json(
        {
          error: "The model did not return exactly YES or NO.",
          answer,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      decision: answer,
      model: "openai/gpt-oss-20b",
    });
  } catch (error) {
    console.error("Groq API error:", error);

    return NextResponse.json(
      { error: "AI request failed. Check the server terminal." },
      { status: 500 }
    );
  }
}
