import { convertToModelMessages, streamText } from "ai";
import { google } from "@ai-sdk/google";

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Input validation: Block sensitive topics
  const lastMessage = messages[messages.length - 1]?.content || "";
  const blockedKeywords = ["password", "credit card", "ssn", "social security"];

  if (blockedKeywords.some(word => lastMessage.toLowerCase().includes(word))) {
    return new Response(
      JSON.stringify({ error: "I cannot help with that topic for security reasons." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: google("gemini-flash-latest"),
    // System message: Gentle guidance on conversation scope
    system: "You are a helpful assistant. Please keep conversations respectful and constructive. Decline requests that involve sensitive personal information, illegal activities, or harmful content.",
    messages: modelMessages,
  });

  // Keep UI message stream format for useChat in @ai-sdk/react.
  // Switching this to text stream can return 200 while showing no chat response in the UI.
  return result.toUIMessageStreamResponse();
}
