"use client";

import { FormEvent, useState } from "react";
import { useChat } from "@ai-sdk/react";

export default function Chat() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();
    if (!text) return;

    setInput("");
    await sendMessage({ text });
  }

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Gemini Chat</h1>

      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {messages.map((m) => {
          const text = m.parts
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n");

          return (
            <div
              key={m.id}
              className={`p-3 rounded-lg ${
                m.role === "user"
                  ? "bg-blue-100 self-end text-right"
                  : "bg-gray-100 self-start"
              }`}
            >
              <span className="block text-xs font-semibold text-gray-500 mb-1 capitalize">
                {m.role}
              </span>
              {text}
            </div>
          );
        })}
        {status === "streaming" && (
          <div className="text-sm text-gray-400 italic">Gemini is typing...</div>
        )}
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Say something..."
        />
        <button
          type="submit"
          disabled={status === "streaming"}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
