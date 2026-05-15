import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
} from "ai";
import { google } from "@ai-sdk/google";
import { embedQuery } from "@/lib/embeddings";
import { getIndex } from "@/lib/pinecone";
import { getCachedAnswer, setCachedAnswer } from "@/lib/cache";

const isDev = true; //process.env.NODE_ENV !== "production";

export async function POST(req: Request) {
  const { messages } = await req.json();


  // Input validation: Empty/whitespace message and sensitive topics
  const lastMessageText = messages[messages.length - 1];
  const lastMessage =
    lastMessageText?.parts?.find((p: { type: string }) => p.type === "text")?.text ??
    lastMessageText?.content ??
    "";
  const blockedKeywords = ["password", "credit card", "ssn", "social security"];

  if (!lastMessage.trim()) {
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

  // Phase 1 cache: short-circuit Gemini on cache hit.
  const cached = await getCachedAnswer(lastMessage);
  if (cached) {
    if (isDev) {
      console.info("[chat-cache] hit", {
        answerChars: cached.answer.length,
        sourcesUsed: cached.sourcesUsed.length,
      });
    }

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        const id = `cached-${Date.now()}`;

        writer.write({ type: "text-start", id });
        writer.write({ type: "text-delta", id, delta: cached.answer });
        writer.write({ type: "text-end", id });
      },
    });

    return createUIMessageStreamResponse({
      stream,
      headers: {
        "X-Cache": "HIT",
      },
    });
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

  const sourcesUsed = [
    ...new Set(
      results.matches
        .map((match) => (typeof match.metadata?.source === "string" ? match.metadata.source : ""))
        .filter(Boolean)
    ),
  ];

  if (isDev) {
    console.info("[chat-cache] miss", {
      matchedChunks: results.matches.length,
      sourcesUsed: sourcesUsed.length,
    });
  }

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
    onFinish: async ({ text }) => {
      await setCachedAnswer(lastMessage, text, sourcesUsed);
    },
  });

  return result.toUIMessageStreamResponse({
    headers: {
      "X-Cache": "MISS",
    },
  });
}