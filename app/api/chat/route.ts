import { convertToModelMessages, streamText } from "ai";
import { google } from "@ai-sdk/google";
import { embedQuery } from "@/lib/embeddings";
import { getIndex } from "@/lib/pinecone";

export async function POST(req: Request) {
  const { messages } = await req.json();


  // Input validation: Empty/whitespace message and sensitive topics
  const lastMessageText = messages[messages.length - 1];
  const lastMessage = 
  lastMessageText?.parts?.find((p: {type: string}) => p.type === 'text')?.text 
  ?? lastMessageText?.content  // fallback for older format
  ?? "";
  const blockedKeywords = ["password", "credit card", "ssn", "social security"];
  console.log("**** 1. " , messages, messages[messages.length - 1], (lastMessage || 'none'))
  if (!lastMessage.trim()) {
    console.log("**** 2. ")
    return new Response(
      JSON.stringify({ error: "Message is empty." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (blockedKeywords.some(word => lastMessage.toLowerCase().includes(word))) {
    return new Response(
      JSON.stringify({ error: "I cannot help with that topic for security reasons." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 1. Embed the user's question
  const queryVector = await embedQuery(lastMessage);

  // 2. Search Pinecone for the most relevant chunks
  const results = await getIndex().query({
    vector: queryVector,
    topK: 5,                  // retrieve top 5 most relevant chunks
    includeMetadata: true,    // we need the original text back
  });

  // 3. Extract the text from each matching chunk
  const relevantChunks = results.matches
    .map(match => match.metadata?.text as string)
    .filter(Boolean)
    .join("\n\n---\n\n");

  // Get chat mode from environment (strict or best-effort)
  const chatMode = process.env.CHAT_MODE || "best-effort";
  const isStrictMode = chatMode === "strict";

  // 4. Build system prompt with retrieved context (same logic as before)
  const systemPrompt = isStrictMode
    ? `You are Cheryl's website assistant. You ONLY answer questions based on the documents provided below. If a question is not answerable from the provided documents, respond with: "I can only answer questions about the provided site documents."

Here are the relevant documents:
${relevantChunks || "No relevant documents found."}`
    : `You are Cheryl's website assistant. You primarily answer questions based on the provided site documents. You may provide general context or advice when helpful, but always prioritize the site documents. If information is not in the documents, be clear about what you're supplementing with general knowledge.

Here are the relevant documents:
${relevantChunks || "No relevant documents found."}`;

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: google("gemini-flash-latest"),
    system: systemPrompt,
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}