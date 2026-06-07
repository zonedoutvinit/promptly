import React, { useState, useRef, useEffect } from "react";
import { useChatStore } from "./store";
import ReactMarkdown from "react-markdown";

export default function App() {
  const {
    messages,
    isLoading,
    sendMessage,
    clearHistory,
    model,
    setModel,
    availableModels,
    fetchModels,
  } = useChatStore();
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState<"dynamic" | "generic">("dynamic");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load available system models automatically on startup
  useEffect(() => {
    fetchModels();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (dynamicSuggestedPrompts.length === 0) {
      setActiveTab("generic");
    } else {
      setActiveTab("dynamic");
    }
  }, [messages, isLoading]); // Tracks thread updates

  const handleSubmit = (e: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText || input;
    if (!textToSend.trim()) return;
    sendMessage(textToSend);
    setInput("");
  };

  // Strictly generic, non-topic specific relatable prompt paths
  const genericOptions = [
    {
      label: "Deepen Analysis",
      prompt: "Can you elaborate further on this with deeper context?",
    },
    {
      label: "Show Counter-View",
      prompt:
        "What is a strong counter-argument or alternative perspective to what you just said?",
    },
    {
      label: "Summarize Core",
      prompt:
        "Summarize your previous point down into one clear, punchy sentence.",
    },
    {
      label: "Turn to Checklist",
      prompt:
        "Convert your response into a clean, actionable step-by-step checklist.",
    },
  ];

  const fillerBlacklist = [
    // --- Conversational Next Steps / Endings ---
    "what's next",
    "whats next",
    "let me know",
    "what sparks your interest",
    "what interests you",
    "what catches your eye",
    "what sounds good",
    "what would you like",
    "where should we start",
    "where would you like to start",
    "where would you like to go",
    "where should we go from here",
    "dive right in",
    "dive in",
    "get us started",
    "get started",
    "feel free to",
    "just let me know",
    "let's dive",
    "lets dive",
    "happy to explore",
    "gladly talk about",

    // --- Questions & Invitations ---
    "do you want to know",
    "do you want to explore",
    "do you want to talk",
    "do you have a favorite",
    "want to learn more",
    "want to explore",
    "want to know more",
    "would you be interested",
    "are you interested",
    "are you curious",
    "are you looking for",
    "in the mood for",
    "tell me what",
    "tell me which",
    "tell me how",

    // --- Meta Context Setups ---
    "can you talk about",
    "can we talk about",
    "can we discuss",
    "we could talk about",
    "we could discuss",
    "we could explore",
    "we can dive",
    "we can explore",
    "we can discuss",
    "i can share",
    "i'd love to",
    "id love to",
    "that's a vast topic",
    "thats a vast topic",
    "to give you some",
    "here are some ideas",
    "here are a few",
    "options include",
    "following areas",
    "such as:",
    "for example:",
  ];

  const hasMessages = messages.length > 0;
  const lastMessage = hasMessages ? messages[messages.length - 1] : null;
  const showOptions =
    hasMessages &&
    !isLoading &&
    messages[messages.length - 1].role === "assistant";

  const cleanMarkdownText = (str: string): string => {
    return (
      str
        // Remove bold/italic markers (**text**, *text*, __text__, _text_)
        .replace(/[\*\-_]+/g, "")
        // Remove leading list/bullet artifacts if any slipped through
        .replace(/^[\s\-\*•\d\.\)]+/, "")
        // Remove any trailing colons or weird hanging spacing
        .replace(/:\s*$/, "")
        .trim()
    );
  };

  const isValidPrompt = (str: string) => {
    const lower = str.toLowerCase().trim();

    // 1. Check strict substring match from blacklist first (Fast path)
    const isStrictFiller = fillerBlacklist.some((filler) =>
      lower.includes(filler),
    );
    if (isStrictFiller) return false;

    // 2. Length-based cleanups
    if (lower.length < 8) return false;

    // 3. 🧠 Fuzzy Match Overlap Scoring Engine (No external dependencies)
    // Break the extracted string into individual words
    const candidateWords = lower
      .replace(/[?.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 1);
    if (candidateWords.length === 0) return false;

    // Create a set of all individual filler words from your blacklist
    const uniqueFillerWords = new Set<string>();
    fillerBlacklist.forEach((phrase) => {
      phrase.split(/\s+/).forEach((word) => {
        if (word.length > 1) uniqueFillerWords.add(word);
      });
    });

    // Count how many words in the candidate string exist in our filler dictionary
    let fillerWordCount = 0;
    candidateWords.forEach((word) => {
      if (uniqueFillerWords.has(word)) {
        fillerWordCount++;
      }
    });

    // Calculate score (percentage of filler words making up the string)
    const overlapScore = fillerWordCount / candidateWords.length;

    // If collectively more than 40% of the string consists of filler words, block it!
    if (overlapScore >= 0.4) {
      return false;
    }

    return true;
  };

  const getModelSuggestedPrompts = () => {
    if (!lastMessage || !lastMessage.content) return [];

    const text = lastMessage.content;
    const suggestions: string[] = [];

    // Check if the response contains structural choice patterns
    const isInvitation =
      text.includes("?") ||
      text.includes(":") ||
      text.toLowerCase().includes("learning about") ||
      text.toLowerCase().includes("interested in");

    if (isInvitation) {
      const lines = text.split("\n");

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // --- STRATEGY 1: Parse Key-Value Options (e.g., **Food history:** Like where...) ---
        // If a line contains a colon, the model is likely offering a category prefix option
        if (
          trimmedLine.includes(":") &&
          (trimmedLine.startsWith("**") ||
            trimmedLine.startsWith("*") ||
            /^[A-Z]/.test(trimmedLine))
        ) {
          const parts = trimmedLine.split(":");
          const potentialHeader = parts[0].trim();

          // Clean the prefix completely using our new sanitizer helper
          const cleanHeader = cleanMarkdownText(potentialHeader);

          if (isValidPrompt(cleanHeader) && cleanHeader.length < 50) {
            // Re-add a clean question mark if it makes semantic sense as a prompt button
            const finalPrompt = cleanHeader.endsWith("?")
              ? cleanHeader
              : `${cleanHeader}?`;
            if (!suggestions.includes(finalPrompt)) {
              suggestions.push(finalPrompt);
            }
          }
        }
        // --- STRATEGY 2: Standard Line Lists / Bullets Fallback ---
        else if (/^[\s\-\*•\d\.\)]+/.test(trimmedLine)) {
          const cleanLine = cleanMarkdownText(trimmedLine);
          if (isValidPrompt(cleanLine) && cleanLine.length < 80) {
            const trailingClean = cleanLine
              .replace(/\s*\(e\.g\.,.*?\)/g, "")
              .trim();
            if (
              isValidPrompt(trailingClean) &&
              !suggestions.includes(trailingClean)
            ) {
              suggestions.push(trailingClean);
            }
          }
        }
      }
    }

    // --- STRATEGY 3: Double-Quote Fallback (Only if structural strategy yields nothing) ---
    if (suggestions.length === 0) {
      const quoteRegex = /"([^"\n]{15,80})"/g;
      let quoteMatch;
      while ((quoteMatch = quoteRegex.exec(text)) !== null) {
        const cleanQuote = cleanMarkdownText(quoteMatch[1]);
        if (isValidPrompt(cleanQuote)) {
          if (!suggestions.includes(cleanQuote)) {
            suggestions.push(cleanQuote);
          }
        }
      }
    }

    return suggestions.slice(0, 4); // Keep a maximum threshold of 4 chips
  };

  const dynamicSuggestedPrompts = showOptions ? getModelSuggestedPrompts() : [];

  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Dynamic Header */}
      <header className="flex items-center justify-between border-b border-zinc-900 px-6 py-4 bg-zinc-950/50 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-tight text-indigo-400">
            ⚡ Promptly
          </span>
          <span className="rounded bg-zinc-900 px-2 py-0.5 text-xs text-zinc-500 border border-zinc-800">
            Local Blueprint
          </span>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-indigo-500 transition cursor-pointer"
          >
            {availableModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            {availableModels.length === 0 && (
              <option>Scanning System...</option>
            )}
          </select>
          <button
            onClick={clearHistory}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition"
          >
            Clear Thread
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 bg-zinc-950">
        <div className="max-w-3xl w-full mx-auto space-y-6 flex flex-col">
          {!hasMessages ? (
            <div className="flex h-[70vh] flex-col items-center justify-center text-zinc-600 space-y-3 text-center">
              <div className="h-12 w-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-indigo-400 font-bold text-lg">
                P
              </div>
              <div>
                <p className="text-base font-medium text-zinc-400">
                  Promptly is offline-ready.
                </p>
                <p className="text-xs text-zinc-600 max-w-xs mt-1">
                  Select an active model from your system configuration menu
                  above to begin a session.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col p-4 rounded-xl max-w-[85%] w-fit border transition ${
                  msg.role === "user"
                    ? "bg-zinc-900 ml-auto border-zinc-800 text-zinc-100 self-end"
                    : "bg-zinc-950/40 border-zinc-900 mr-auto text-zinc-200 self-start"
                }`}
              >
                <span
                  className={`text-[10px] font-bold mb-1.5 tracking-wider uppercase ${
                    msg.role === "user" ? "text-zinc-500" : "text-indigo-400"
                  }`}
                >
                  {msg.role === "user" ? "User Intent" : "Local Engine"}
                </span>

                {/* Markdown renderer for Assistant, standard layout handling for User */}
                {msg.role === "assistant" ? (
                  <div className="prose prose-invert prose-sm max-w-none text-zinc-200 leading-relaxed">
                    <ReactMarkdown>
                      {msg.content ||
                        (isLoading && idx === messages.length - 1 ? "▊" : "")}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {msg.content}
                  </p>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Tray & Adaptive Options Panel */}
      <footer className="p-6 border-t border-zinc-900 max-w-3xl w-full mx-auto space-y-4">
        {/* Dynamic Context Options Section */}
        {showOptions && (
          <div className="flex flex-col gap-3 animate-fade-in">
            {/* Interactive Toggle Switch Tab Bar (Only displays if options actually exist) */}
            {dynamicSuggestedPrompts.length > 0 && (
              <div className="flex items-center gap-1 border-b border-zinc-900 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("dynamic")}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md transition ${
                    activeTab === "dynamic"
                      ? "bg-indigo-950 text-indigo-400 border border-indigo-900/40"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Suggested Paths
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("generic")}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md transition ${
                    activeTab === "generic"
                      ? "bg-zinc-900 text-zinc-300 border border-zinc-800"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Structural Paths
                </button>
              </div>
            )}

            {/* Rendered Action Row Panel */}
            <div className="flex flex-wrap gap-2 items-center min-h-[38px]">
              {activeTab === "dynamic" && dynamicSuggestedPrompts.length > 0
                ? dynamicSuggestedPrompts.map((promptText, i) => (
                    <button
                      key={`dynamic-${i}`}
                      type="button"
                      onClick={() => handleSubmit(undefined, promptText)}
                      className="text-xs bg-indigo-950/30 hover:bg-indigo-900/50 text-indigo-300 border border-indigo-900/40 px-3 py-2 rounded-lg transition text-left truncate max-w-xs"
                    >
                      "{promptText}"
                    </button>
                  ))
                : genericOptions.map((opt, i) => (
                    <button
                      key={`generic-${i}`}
                      type="button"
                      onClick={() => handleSubmit(undefined, opt.prompt)}
                      className="text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 px-3 py-2 rounded-lg transition"
                    >
                      {opt.label}
                    </button>
                  ))}
            </div>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={(e) => handleSubmit(e)} className="flex gap-2 pt-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isLoading
                ? "Engine compiling response..."
                : "Enter structural text instructions..."
            }
            disabled={isLoading}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-indigo-500 transition text-zinc-100 placeholder-zinc-600 disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-900 disabled:text-zinc-700 font-medium px-5 rounded-xl text-sm transition text-white"
          >
            Execute
          </button>
        </form>
      </footer>
    </div>
  );
}
