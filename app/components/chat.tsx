"use client";

import { FormEvent, useRef, useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
import Fuse from "fuse.js";

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
interface ResumeSection {
  id: string;
  source_slug: string;
  section_key: string;
  title: string;
  content: string;
  keywords: string[];
}

interface FuseResult {
  item: ResumeSection;
  score: number;
}

// ─────────────────────────────────────────
// Fuse.js config
// ─────────────────────────────────────────
const FUSE_OPTIONS = {
  keys: [
    { name: "title",       weight: 0.4 },
    { name: "content",     weight: 0.3 },
    { name: "keywords",    weight: 0.2 },
    { name: "section_key", weight: 0.1 },
  ],
  threshold: 0.5,
  includeScore: true,
  minMatchCharLength: 2,
};

// ─────────────────────────────────────────
// Stopwords
// ─────────────────────────────────────────
const STOPWORDS = new Set([
  'what','are','the','is','a','an','about','tell','me','your','you',
  'have','has','did','do','does','can','could','would','should','will',
  'been','being','be','was','were','had','how','who','when','where',
  'which','there','their','they','this','that','these','those','with',
  'for','and','but','or','not','any','all','some','more','most','many',
  'like','just','also','than','then','them','its','our','my','his','her',
  'give','show','list','please','help',
]);

function extractSearchTerms(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOPWORDS.has(w))
    .join(' ');
}

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────
export default function Chat() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat();
  const isLoading = status === "submitted" || status === "streaming";
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Fuse.js state
  const [fuseResults, setFuseResults] = useState<FuseResult[]>([]);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const fuseRef = useRef<Fuse<ResumeSection> | null>(null);

  // Rate limit state
  const [rateLimitHit, setRateLimitHit] = useState(false);

  // Load resume sections from Neon on mount
  useEffect(() => {
    fetch("/api/sections")
      .then(r => r.json())
      .then(data => {
        if (data.sections) {
          fuseRef.current = new Fuse(data.sections, FUSE_OPTIONS);
        }
      })
      .catch(err => console.error("Failed to load resume sections:", err));
  }, []);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading, fuseResults]);

  // ── Core: Fuse first, then Gemini ──
  async function handleQuery(text: string) {
    setFuseResults([]);
    setPendingQuery(null);

    if (fuseRef.current) {
      const searchTerms = extractSearchTerms(text);
      const results = searchTerms
        ? (fuseRef.current.search(searchTerms) as FuseResult[])
        : [];

      if (results.length > 0) {
        setFuseResults(results.slice(0, 4));
        setPendingQuery(text);
        return; // Show Fuse results, wait for user to decide
      }
    }

    // No Fuse results — go straight to Gemini
    await callGemini(text);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    await handleQuery(text);
  }

  async function handleSuggestedQuestion(question: string) {
    await handleQuery(question);
  }

  // ── Gemini call with 429 guard ──
  async function callGemini(text: string) {
    try {
      await sendMessage({ text });
    } catch (err: any) {
      const is429 =
        err?.status === 429 ||
        err?.message?.includes("429") ||
        err?.message?.toLowerCase().includes("resource exhausted") ||
        err?.message?.toLowerCase().includes("quota");
      if (is429) {
        setRateLimitHit(true);
      } else {
        throw err;
      }
    }
  }

  async function handleKnowMore() {
    if (!pendingQuery) return;
    const query = pendingQuery;
    setFuseResults([]);
    setPendingQuery(null);
    await callGemini(query);
  }

  function handleDismiss() {
    setFuseResults([]);
    setPendingQuery(null);
  }

  const suggestedQuestions = [
    "What are the key skills?",
    "Summarize the experience",
    "What projects have been completed?"
  ];

  return (
    <div className="flex h-full min-h-[calc(100vh-2rem)] flex-col rounded-[2rem] border border-slate-200 bg-white/90 p-4 shadow-2xl shadow-slate-900/5 backdrop-blur lg:min-h-[calc(100vh-2.5rem)]">

      {/* ── Header ── */}
      <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">
            Resume Assistant
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 lg:hidden">
            Ask questions about Cheryl&apos;s Resume or scroll to read
          </h1>
          <h1 className="hidden mt-2 text-2xl font-semibold tracking-tight text-slate-950 lg:block">
            Read the resume and ask questions in the chat below.
          </h1>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
          {isLoading ? "Thinking" : "Ready"}
        </div>
      </div>

      {/* ── Messages ── */}
      <div ref={messagesContainerRef} className="flex-1 space-y-3 overflow-y-auto pr-1">

        {/* Chat messages */}
        {messages.map((m) => {
          const text = m.parts
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n");

          return (
            <div
              key={m.id}
              className={`max-w-[92%] rounded-2xl p-4 text-sm leading-6 ${
                m.role === "user"
                  ? "ml-auto bg-slate-950 text-white"
                  : "mr-auto border border-slate-200 bg-slate-100 text-slate-800"
              }`}
            >
              <span className={`mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] ${
                m.role === "user" ? "text-slate-300" : "text-slate-500"
              }`}>
                {m.role}
              </span>
              <ReactMarkdown>{text}</ReactMarkdown>
            </div>
          );
        })}

        {/* Suggested questions (empty state) */}
        {messages.length === 0 && fuseResults.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 mb-3">
              Suggested Questions
            </p>
            {suggestedQuestions.map((question) => (
              <button
                key={question}
                onClick={() => handleSuggestedQuestion(question)}
                disabled={isLoading}
                className="w-full text-left rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition hover:bg-blue-50 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {question}
              </button>
            ))}
          </div>
        )}

        {/* Fuse.js results */}
        {fuseResults.length > 0 && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-500">
              Quick Results
            </p>

            {fuseResults.map(({ item, score }) => (
              <div
                key={item.id ?? item.section_key}
                className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-900">{item.title}</span>
                  <span className="text-[10px] text-slate-400">
                    {Math.round((1 - (score ?? 0)) * 100)}% match
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-5 line-clamp-3">
                  {item.content}
                </p>
              </div>
            ))}

            {/* Footer CTA */}
            <div className="flex items-center justify-between pt-1 border-t border-blue-100">
              <p className="text-xs text-slate-500">
                Results using <span className="font-semibold text-blue-600">Fuse.js</span> — Would you like to know more?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDismiss}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition"
                >
                  Dismiss
                </button>
                <button
                  onClick={handleKnowMore}
                  disabled={isLoading}
                  className="rounded-xl bg-slate-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition disabled:opacity-50"
                >
                  Ask Gemini →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 429 Rate limit notice */}
        {rateLimitHit && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-800 mb-1">
              ⚠ Gemini token limit reached
            </p>
            <p className="text-xs text-red-700 leading-5">
              The Gemini API quota has been exhausted. You can still search
              using Fuse.js — type a keyword below to find resume sections
              instantly without any API calls.
            </p>
            <button
              onClick={() => setRateLimitHit(false)}
              className="mt-2 text-xs text-red-600 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Gemini loading */}
        {isLoading && (
          <div
            className="mr-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500"
            role="status"
            aria-live="polite"
          >
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" aria-hidden="true" />
            <span className="inline-flex items-center gap-1" aria-hidden="true">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500" style={{ animationDelay: "200ms" }} />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500" style={{ animationDelay: "400ms" }} />
            </span>
            <span>Gemini is typing...</span>
          </div>
        )}
      </div>

      {/* ── Input form ── */}
      <form onSubmit={onSubmit} className="mt-4 flex gap-2 border-t border-slate-200 pt-4">
        <input
          className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about Cheryl's Resume..."
        />
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}