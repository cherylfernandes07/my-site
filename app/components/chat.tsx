"use client";

import { FormEvent, useRef, useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";

export default function Chat() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat();
  const isLoading = status === "submitted" || status === "streaming";
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();
    if (!text) return;

    setInput("");
    await sendMessage({ text });
  }

  const suggestedQuestions = [
    "What are the key skills?",
    "Summarize the experience",
    "What projects have been completed?"
  ];

  async function handleSuggestedQuestion(question: string) {
    await sendMessage({ text: question });
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-2rem)] flex-col rounded-[2rem] border border-slate-200 bg-white/90 p-4 shadow-2xl shadow-slate-900/5 backdrop-blur lg:min-h-[calc(100vh-2.5rem)]">
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

      <div ref={messagesContainerRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
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
              <span className={`mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] ${m.role === "user" ? "text-slate-300" : "text-slate-500"}`}>
                {m.role}
              </span>
              <ReactMarkdown>{text}</ReactMarkdown>
            </div>
          );
        })}
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 mb-3">Suggested Questions</p>
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
