import { convertToModelMessages, streamText } from "ai";
import { google } from "@ai-sdk/google";
import fs from "fs";

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

  // Load resume XML for context
  let resumeContent = "";
  try {
    resumeContent = fs.readFileSync("/Users/cherylfernandes/Documents/GitHub/resume/resume_template.xml", "utf-8");
  } catch (error) {
    console.warn("Resume file not found, proceeding without resume context");
  }

  // Get chat mode from environment (strict or best-effort)
  const chatMode = process.env.CHAT_MODE || "best-effort";
  const isStrictMode = chatMode === "strict";

  // Build system prompt based on mode
  const systemPrompt = isStrictMode
    ? `You are Cheryl's resume assistant. You ONLY answer questions based on the resume provided below. If a question is not answerable from the resume, respond with: "I can only answer questions about Cheryl's resume from the provided information."

Here is Cheryl's resume:
${resumeContent}`
    : `You are Cheryl's resume assistant. You primarily answer questions based on Cheryl's resume provided below. You may provide general context or advice when helpful, but always prioritize resume information. If information is not in the resume, be clear about what you're supplementing with general knowledge.

Here is Cheryl's resume:
${resumeContent}`;

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: google("gemini-flash-latest"),
    system: systemPrompt,
    messages: modelMessages,
  });

  // Keep UI message stream format for useChat in @ai-sdk/react.
  // Switching this to text stream can return 200 while showing no chat response in the UI.
  return result.toUIMessageStreamResponse();
}
