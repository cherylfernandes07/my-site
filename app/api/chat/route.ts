import { convertToModelMessages, streamText } from "ai";
import { google } from "@ai-sdk/google";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: google("gemini-flash-latest"),
    messages: modelMessages,
  });

  // Keep UI message stream format for useChat in @ai-sdk/react.
  // Switching this to text stream can return 200 while showing no chat response in the UI.
  return result.toUIMessageStreamResponse();
}
