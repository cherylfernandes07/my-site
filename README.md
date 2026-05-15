# Resume Assistant

A modern Next.js website featuring an XSLT-rendered resume with an integrated AI chat assistant powered by Google Gemini Flash.

## Overview

This project combines a beautifully rendered resume (transformed from XML via XSLT) with an intelligent chat interface. Users can ask questions about the resume, and the AI assistant retrieves relevant context using Pinecone vector search with semantic understanding.

**Key Features:**
- ✨ Resume rendered from XML using XSLT for clean, semantic markup
- 💬 AI-powered chat with suggested starter questions
- 🎯 RAG (Retrieval-Augmented Generation) using Pinecone for context-aware responses
- 📱 Responsive side-by-side layout (70% resume, 30% fixed chat panel)
- ⚡ Real-time streaming responses with loading indicators
- 📝 Markdown rendering for rich chat formatting
- 🔄 Auto-scrolling chat with smooth UX

## Tech Stack

- **Framework:** Next.js 16 (App Router) with React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **LLM:** Google Gemini Flash via AI SDK v6
- **Vector DB:** Pinecone (for semantic search)
- **XML Processing:** xslt-processor (pure JavaScript XSLT)
- **Chat UI:** React Markdown for formatted responses

## Getting Started

### Prerequisites

Use Node.js v20.19.6:

```bash
nvm use 20.19.6
```

### Installation

```bash
npm install
```

### Environment Setup

Create a `.env.local` file in the project root with the following:

```bash
# Google Generative AI API
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key_here

# Pinecone Vector Database
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=your_index_name

# Azure OpenAI (for embeddings, if using)
AZURE_OPENAI_API_KEY=your_azure_key_here

# Neon Postgres (Phase 1 response cache)
DATABASE_URL=postgresql://user:password@host/database

# Optional cache TTL in days (defaults to 30)
CHAT_CACHE_TTL_DAYS=30
```

### Development

Before first run with cache enabled, apply the database schema in:

- `files/001_initial_schema.sql`

You can run it in Neon SQL Editor or with your preferred Postgres client.

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The page will auto-update as you make changes.

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
my-site/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts              # Chat API endpoint
│   ├── components/
│   │   └── chat.tsx                  # Chat UI component with auto-scroll
│   ├── lib/
│   │   ├── render-resume-html.ts     # XSLT transformation helper
│   │   ├── knowledge.ts              # Knowledge base initialization
│   │   ├── embeddings.ts             # Embedding generation
│   │   └── pinecone.ts               # Pinecone client setup
│   ├── globals.css                   # Global styles
│   ├── layout.tsx                    # Root layout
│   └── page.tsx                      # Home page (70/30 resume + chat)
├── lib/
│   ├── chunker.ts                    # Document chunking for embeddings
│   ├── embeddings.ts                 # Shared embedding utilities
│   └── pinecone.ts                   # Shared Pinecone utilities
├── public/
│   └── assets/
│       └── docs/
│           ├── resume_template.xml   # Resume source data
│           ├── resume_template.xslt  # XSLT stylesheet for rendering
│           └── images/               # Assets
├── scripts/
│   ├── ingest.ts                     # Ingest resume into Pinecone
│   ├── test-embeddings.ts            # Test embedding generation
│   └── test-pinecone.ts              # Test Pinecone connection
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

## Features in Detail

### Resume Rendering (XSLT)

- Source: `public/assets/docs/resume_template.xml`
- Stylesheet: `public/assets/docs/resume_template.xslt`
- Helper: `app/lib/render-resume-html.ts`

The resume is transformed server-side from XML to HTML using XSLT, ensuring:
- Clean semantic markup
- Scoped CSS to prevent conflicts with page styles
- Print-friendly responsive design

### Chat Interface

**Components:**
- `app/components/chat.tsx` - Main chat UI with suggested questions
- `app/api/chat/route.ts` - API endpoint with safety guardrails

**Features:**
- **Suggested Questions:** 3 starter prompts appear when no messages exist
- **Auto-scroll:** Messages container auto-scrolls to latest when new messages arrive
- **Loading Indicator:** Animated spinner + 3 pulsing dots during response generation
- **Markdown Rendering:** Chat responses support full Markdown formatting
- **Status Chip:** Shows "Thinking" while generating, "Ready" when idle

### RAG (Retrieval-Augmented Generation)

Chat responses use context from the resume:

1. User question is embedded using Azure OpenAI/Claude embeddings
2. Pinecone searches for similar resume sections
3. Relevant context is sent to Gemini with the question
4. Gemini generates a response grounded in resume data

## Chat Integration

Chat is implemented with:

- API route: `app/api/chat/route.ts`
- Client component: `app/components/chat.tsx`
- Home page mount point: `app/page.tsx`

## Deployment

### Vercel

When deploying to Vercel, configure these environment variables in your project settings:

**Path:** Vercel Dashboard → Project → Settings → Environment Variables

**Required variables:**
- `GOOGLE_GENERATIVE_AI_API_KEY` - Google Generative AI API key
- `PINECONE_API_KEY` - Pinecone API key
- `PINECONE_INDEX_NAME` - Your Pinecone index name
- `AZURE_OPENAI_API_KEY` - Azure OpenAI key (if using for embeddings)
- `DATABASE_URL` - Neon Postgres connection string (for persistent response cache)

After saving, redeploy the project so the API route can access these variables at runtime.

### Environment Variables Reference

| Variable | Purpose | Required |
|----------|---------|----------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini Flash LLM | ✅ Yes |
| `PINECONE_API_KEY` | Vector database auth | ✅ Yes |
| `PINECONE_INDEX_NAME` | Pinecone index name | ✅ Yes |
| `AZURE_OPENAI_API_KEY` | Embedding generation | ✅ Yes |
| `DATABASE_URL` | Neon Postgres response cache | ✅ Yes for cache |
| `CHAT_CACHE_TTL_DAYS` | Cache expiration window in days | Optional |

## Scripts

### Ingest Resume into Pinecone

Chunk and embed the resume, then upload to Pinecone:

```bash
npx ts-node scripts/ingest.ts
```

### Test Embeddings

Verify embedding generation is working:

```bash
npx ts-node scripts/test-embeddings.ts
```

### Test Pinecone Connection

Verify Pinecone connection and index:

```bash
npx ts-node scripts/test-pinecone.ts
```

## Safety Guardrails

This project uses a layered guardrails approach (defense-in-depth), not a "guard summary".

Current layers are implemented in `app/api/chat/route.ts`:

1. Input guardrails:
	- Checks the latest user message for blocked sensitive terms (for example: password, credit card, ssn, social security).
	- Returns `400` without calling the model when blocked content is detected.
2. Behavioral guardrails:
	- Sends a system instruction to the model to keep responses respectful, constructive, and within policy.
	- Tells the assistant to decline harmful or sensitive requests.

Why this helps:

- Prevents some risky prompts before they reach Gemini.
- Reinforces safe behavior during generation.
- Uses multiple checks instead of relying on a single safety mechanism.

## AI SDK v6 Protocol Pairing

For `useChat` with `@ai-sdk/react`, the server should:

1. Convert incoming UI messages to model messages.
2. Return a UI message stream response.

Recommended pattern in `app/api/chat/route.ts`:

```ts
import { convertToModelMessages, streamText } from "ai";
import { google } from "@ai-sdk/google";

export async function POST(req: Request) {
	const { messages } = await req.json();

	const result = streamText({
		model: google("gemini-flash-latest"),
		messages: convertToModelMessages(messages),
	});

	return result.toUIMessageStreamResponse();
}
```

## Troubleshooting

### 200 OK but no response in UI

Symptom:

- Request to `/api/chat` returns 200, but no assistant message appears.

Most common cause:

- Stream format mismatch between client and server.

Fix checklist:

1. Confirm `app/api/chat/route.ts` uses `convertToModelMessages(messages)`.
2. Confirm `app/api/chat/route.ts` returns `toUIMessageStreamResponse()`.
3. Confirm `app/components/chat.tsx` imports `useChat` from `@ai-sdk/react`.
4. In browser dev tools, confirm response header `x-vercel-ai-ui-message-stream: v1`.
5. Restart dev server after route or env changes.

### Cannot find useChat in ai/react

Cause:

- AI SDK v6 moved hooks out of `ai/react`.

Fix:

- Install `@ai-sdk/react` and import `useChat` from `@ai-sdk/react`.

### Tailwind oxide native binding missing (macOS)

Symptom:

- Build errors mention `@tailwindcss/oxide-darwin-arm64` or optional dependencies.

Fix in project root:

```bash
rm -rf node_modules package-lock.json
npm install
```

## References

- Next.js docs: [https://nextjs.org/docs](https://nextjs.org/docs)
- AI SDK docs: [https://ai-sdk.dev/docs](https://ai-sdk.dev/docs)
- Google AI Studio API keys: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

## Future Work

### Client localStorage cache

Planned Phase 2 optimization:

- Add a per-user localStorage cache in the chat client for instant repeat answers.
- Check local cache before sending requests to `/api/chat`.
- Keep Neon as the shared server-side cache and localStorage as a fast device-level cache.
- Add TTL and a clear-cache UI control to avoid stale answers.
