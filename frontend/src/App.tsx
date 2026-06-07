import React, { useState, useRef, useEffect } from "react";
import { useChatStore } from "./store";

export default function App() {
  const { messages, isLoading, sendMessage, clearHistory, model, setModel } =
    useChatStore();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Top Header navbar */}
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-tight text-indigo-400">
            ⚡ Promptly
          </span>
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
            Local-First
          </span>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
          >
            <option value="llama3.2:3b">Llama 3.2 (3B)</option>
            <option value="qwen2.5:3b">Qwen 2.5 (3B)</option>
            <option value="llama3.2:1b">Llama 3.2 (1B)</option>
          </select>
          <button
            onClick={clearHistory}
            className="text-sm text-zinc-400 hover:text-red-400 transition"
          >
            Clear Chat
          </button>
        </div>
      </header>

      {/* Main Messages View */}
      <main className="flex-1 overflow-y-auto p-6 space-y-4 max-w-4xl w-full mx-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-zinc-500 space-y-2">
            <p className="text-lg font-medium">
              Ready to converse with your machine.
            </p>
            <p className="text-xs">
              Ensure your local Ollama daemon is active (`ollama serve`).
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col p-4 rounded-xl max-w-[85%] ${
                msg.role === "user"
                  ? "bg-zinc-900 ml-auto border border-zinc-800"
                  : "bg-indigo-950/30 border border-indigo-900/40 mr-auto"
              }`}
            >
              <span
                className={`text-xs font-semibold mb-1 tracking-wide uppercase ${
                  msg.role === "user" ? "text-zinc-400" : "text-indigo-400"
                }`}
              >
                {msg.role === "user" ? "You" : "AI"}
              </span>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                {msg.content ||
                  (isLoading && idx === messages.length - 1 ? "▊" : "")}
              </p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Tray */}
      <footer className="p-6 border-t border-zinc-800 max-w-4xl w-full mx-auto">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything..."
            disabled={isLoading}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-medium px-5 py-3 rounded-xl text-sm transition"
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}
