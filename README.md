# My Site

This is a Next.js App Router project with Gemini chat powered by AI SDK v6.

## Getting Started

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Chat Integration

Chat is implemented with:

- API route: `app/api/chat/route.ts`
- Client component: `app/components/chat.tsx`
- Home page mount point: `app/page.tsx`

Required environment variable:

- `.env.local` must contain:

```bash
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

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
