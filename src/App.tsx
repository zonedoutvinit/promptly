// src/App.tsx
import React, { useState, useRef, useEffect } from "react";
import { useChatStore } from "./store";
import { getModelSuggestedPrompts } from "./utils/chatHelpers";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
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
    <div className="flex h-screen w-screen bg-theme-bg text-theme-text overflow-hidden transition-colors duration-200">
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
        <Header
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          model={model}
          availableModels={availableModels}
          onModelChange={setModel}
        />

        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          hasMessages={hasMessages}
          messagesEndRef={messagesEndRef}
        />

        {/* Updated footer borders and structure to blend flawlessly */}
        <footer className="p-6 border-t border-theme-border/60 max-w-3xl w-full mx-auto space-y-4 shrink-0 bg-theme-bg">
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
