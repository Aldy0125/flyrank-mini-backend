
import OpenAI from "openai";

export type AIDecision = "YES" | "NO";

export async function getAIDecision(
  prompt: string
): Promise<AIDecision> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is missing in .env.local");
  }

  if (!prompt.trim()) {
    throw new Error("Decision prompt cannot be empty.");
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
          "You are a binary decision engine. Evaluate the user's question and answer with exactly one word: YES or NO. Do not provide explanations or punctuation.",
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
    completion.choices[0]?.message?.content
      ?.trim()
      .toUpperCase() ?? "";

  if (answer !== "YES" && answer !== "NO") {
    throw new Error(
      `Invalid AI decision response: ${answer || "empty response"}`
    );
  }

  return answer;
}
