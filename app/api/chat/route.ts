import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
} from "ai";
import { google } from "@ai-sdk/google";
import {
  getCachedAnswer,
  setCachedAnswer,
  retrieveSections,
  type ContentSection,
} from "@/lib/db";

const isDev = true; //process.env.NODE_ENV !== "production";

// ─────────────────────────────────────────
// Build system prompt from retrieved sections
// ─────────────────────────────────────────
function buildSystemPrompt(sections: ContentSection[]): string {
  const contextBlocks = sections
    .map(s => `### ${s.title} [source: ${s.source_slug}]\n${s.content}`)
    .join('\n\n');

  return `You are a helpful assistant answering questions about a person's professional background.
Answer based only on the context provided below. If the answer isn't in the context, say so clearly.
Be concise and direct.

--- CONTEXT ---
${contextBlocks}
--- END CONTEXT ---`;
}

export async function POST(req: Request) {
  const { messages } = await req.json();

  if (!messages || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "No messages provided." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const lastMessageText = messages[messages.length - 1];
  const lastMessage =
    lastMessageText?.parts?.find((p: { type: string }) => p.type === "text")?.text ??
    lastMessageText?.content ??
    "";

  // Input validation: Empty/whitespace message and sensitive topics
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

  // ── Step 1: Check cache ──────────────────────────
  const cached = await getCachedAnswer(lastMessage);

  if (cached) {
    if (isDev) {
      console.info("[chat-cache] hit", {
        answerChars: cached.answer.length,
        sourcesUsed: cached.sources_used.length,
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
        "X-Cache-Hits": String(cached.hit_count),
        "X-Sources-Used": cached.sources_used.join(","),
      },
    });
  }

  // ── Step 2: Retrieve relevant sections ──────────
  const sections = await retrieveSections(lastMessage, { limit: 6 });

  if (sections.length === 0) {
    return new Response(
      JSON.stringify({
        error: "I couldn't find relevant information to answer that question.",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "X-Cache": "MISS",
        },
      }
    );
  }

  const sourcesUsed = [...new Set(sections.map(s => s.source_slug))];

  if (isDev) {
    console.info("[chat-cache] miss", {
      retrievedSections: sections.length,
      sourcesUsed: sourcesUsed.length,
    });
  }

  // ── Step 3: Stream Gemini response ──────────────
  const systemPrompt = buildSystemPrompt(sections);
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
      "X-Sources-Used": sourcesUsed.join(","),
    },
  });
}