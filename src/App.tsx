import React, { useState, useRef, useEffect } from "react";
import { useChatStore } from "./store";
import { getModelSuggestedPrompts } from "./utils/chatHelpers";
import { Sidebar } from "./components/Sidebar";
import { ChatWindow } from "./components/ChatWindow";
import { PromptOptions } from "./components/PromptOptions";
import { MessageForm } from "./components/MessageForm";

export default function App() {
  const {
    messages,
    isLoading,
    sendMessage,
    model,
    setModel,
    availableModels,
    fetchModels,
    sessions,
    currentSessionId,
    createNewSession,
    selectSession,
    deleteSession,
    loadSessionsFromStorage,
  } = useChatStore();

  const [input, setInput] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"dynamic" | "generic">("dynamic");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchModels();
    loadSessionsFromStorage();
  }, [fetchModels, loadSessionsFromStorage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const hasMessages = messages.length > 0;
  const lastMessage = hasMessages ? messages[messages.length - 1] : null;
  const showOptions =
    hasMessages && !isLoading && lastMessage?.role === "assistant";

  const dynamicSuggestedPrompts = showOptions
    ? getModelSuggestedPrompts(lastMessage)
    : [];

  useEffect(() => {
    if (dynamicSuggestedPrompts.length === 0) {
      setActiveTab("generic");
    } else {
      setActiveTab("dynamic");
    }
  }, [dynamicSuggestedPrompts.length]);

  const handleSubmit = (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText || input;
    if (!textToSend.trim()) return;
    sendMessage(textToSend);
    setInput("");
  };

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={selectSession}
        onDeleteSession={deleteSession}
        onNewChat={createNewSession}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Integrated Header Controls Block */}
        <header className="flex items-center justify-between border-b border-zinc-900 px-6 py-4 bg-zinc-950/50 backdrop-blur shrink-0">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="text-zinc-400 hover:text-zinc-200 p-1.5 bg-zinc-900 border border-zinc-800 rounded-md transition"
              >
                📂
              </button>
            )}
            <span className="text-xl font-bold tracking-tight text-indigo-400">
              ⚡ Promptly
            </span>
          </div>

          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-indigo-500 transition cursor-pointer font-medium"
          >
            {availableModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </header>

        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          hasMessages={hasMessages}
          messagesEndRef={messagesEndRef}
        />

        <footer className="p-6 border-t border-zinc-900 max-w-3xl w-full mx-auto space-y-4 shrink-0">
          {showOptions && (
            <PromptOptions
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              dynamicSuggestedPrompts={dynamicSuggestedPrompts}
              onSubmit={(text) => handleSubmit(undefined, text)}
            />
          )}

          <MessageForm
            input={input}
            setInput={setInput}
            isLoading={isLoading}
            onSubmit={(e) => handleSubmit(e)}
          />
        </footer>
      </div>
    </div>
  );
}
