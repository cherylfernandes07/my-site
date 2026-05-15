// app/api/chat/route.ts
// Replaces the old embedding + Pinecone path with:
//   1. Cache lookup (Neon query_cache)
//   2. Keyword/FTS retrieval (Neon content_sections)
//   3. Gemini streaming (only on cache miss)
//   4. Cache write on stream completion
//
// Pinecone/embeddings are kept behind ENABLE_VECTOR_SEARCH=true for future use.

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  getCachedAnswer,
  setCachedAnswer,
  retrieveSections,
  type ContentSection,
} from '@/lib/db';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

// Feature flag — set ENABLE_VECTOR_SEARCH=true in Vercel env vars to re-enable
// the old Pinecone embedding path for future scaling.
const VECTOR_SEARCH_ENABLED = process.env.ENABLE_VECTOR_SEARCH === 'true';

// Max sections to inject into the Gemini context window
const MAX_CONTEXT_SECTIONS = 6;


// ─────────────────────────────────────────
// Build the system prompt from retrieved sections
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


// ─────────────────────────────────────────
// POST /api/chat
// ─────────────────────────────────────────
export async function POST(req: Request) {
  const { messages } = await req.json();

  if (!messages || messages.length === 0) {
    return new Response('No messages provided', { status: 400 });
  }

  const latestMessage: string = messages[messages.length - 1]?.content ?? '';

  // ── Step 1: Check cache ──────────────────────────
  const cached = await getCachedAnswer(latestMessage);

  if (cached) {
    // Return cached answer as a plain streaming response
    // so the client-side streaming logic doesn't need to change.
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(cached.answer));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Cache': 'HIT',
        'X-Cache-Hits': String(cached.hit_count),
        'X-Sources-Used': cached.sources_used.join(','),
      },
    });
  }

  // ── Step 2: Retrieve relevant sections ──────────
  let sections: ContentSection[] = [];

  if (VECTOR_SEARCH_ENABLED) {
    // Future: call your Pinecone/embedding path here and merge results
    // For now fall through to keyword retrieval
  }

  sections = await retrieveSections(latestMessage, { limit: MAX_CONTEXT_SECTIONS });

  if (sections.length === 0) {
    return new Response(
      "I couldn't find relevant information to answer that question.",
      {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Cache': 'MISS',
        },
      }
    );
  }

  // ── Step 3: Stream Gemini response ──────────────
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const systemPrompt = buildSystemPrompt(sections);
  const sourcesUsed  = [...new Set(sections.map(s => s.source_slug))];

  // Rebuild conversation history for Gemini (excluding the latest message)
  const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({
    history,
    systemInstruction: systemPrompt,
  });

  const result = await chat.sendMessageStream(latestMessage);

  // ── Step 4: Stream to client, accumulate for cache write ──
  const encoder = new TextEncoder();
  let fullAnswer = '';

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          fullAnswer += text;
          controller.enqueue(encoder.encode(text));
        }
      } finally {
        controller.close();

        // Write to cache after stream completes (non-blocking)
        setCachedAnswer(latestMessage, fullAnswer, sourcesUsed).catch(err =>
          console.error('[cache write error]', err)
        );
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Cache': 'MISS',
      'X-Sources-Used': sourcesUsed.join(','),
    },
  });
}
