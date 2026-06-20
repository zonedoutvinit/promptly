// src/App.tsx
import React, { useState, useRef, useEffect, useMemo } from "react";
import { useChatStore } from "./store";
import { getModelSuggestedPrompts } from "./utils/chatHelpers";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { ChatWindow } from "./components/ChatWindow";
import { PromptOptions } from "./components/PromptOptions";
import { MessageForm } from "./components/MessageForm";
import { ContextSidebar } from "./components/ContextSidebar";
import { EmptyStateCanvas } from "./components/EmptyStateCanvas";

export default function App() {
  // Extract functions from state hooks layout container
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
    onUpdateUserMessage,
    onRegenerateFromCheckpoint,
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

  const isProcessingSuggestions = isLoading && messages.length > 0;

  const dynamicSuggestedPrompts = useMemo(() => {
    if (!showOptions || !lastMessage) return [];
    const data = getModelSuggestedPrompts(lastMessage);
    return data;
  }, [lastMessage, showOptions, currentSessionId]);

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

  /* Shared rendering block for footer contents to prevent structural code duplication */
  const renderFooterContents = () => (
    <>
      {isProcessingSuggestions ? (
        <div className="flex items-center gap-2 animate-pulse px-4 py-2 text-xs text-theme-muted">
          <div className="w-1.5 h-1.5 rounded-full bg-theme-accent" />
          Analyzing path...
        </div>
      ) : showOptions ? (
        <PromptOptions
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          dynamicSuggestedPrompts={dynamicSuggestedPrompts}
          onSubmit={(text) => handleSubmit(undefined, text)}
        />
      ) : null}

      <MessageForm
        input={input}
        setInput={setInput}
        isLoading={isLoading}
        onSubmit={(e) => handleSubmit(e)}
      />
    </>
  );

  return (
    <div className="flex h-screen w-screen bg-theme-bg text-theme-text overflow-hidden transition-colors duration-200">
      {/* LEFT RAIL: Sessions Navigation History */}
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={selectSession}
        onDeleteSession={deleteSession}
        onNewChat={createNewSession}
      />

      {/* WORKSPACE ROOT PANEL */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* GLOBAL HEADER CONTROLLER */}
        <Header
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          model={model}
          availableModels={availableModels}
          onModelChange={setModel}
        />

        {/* CHAT STREAM + TELEMETRY HORIZONTAL ROW SEGREGATOR */}
        <div className="flex-1 flex flex-row overflow-hidden w-full relative">
          {!hasMessages ? (
            /* ================= EMPTY STATE CENTER HOIST ================= */
            <div className="flex-1 flex flex-col items-center justify-center p-6 min-w-0 overflow-y-auto">
              {/* This tight flex container locks both the canvas and form into a centralized cluster */}
              <div className="max-w-3xl w-full flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in-95 duration-300">
                <EmptyStateCanvas />
                <div className="w-full bg-theme-bg">
                  {renderFooterContents()}
                </div>
              </div>
            </div>
          ) : (
            /* ================= ACTIVE CHAT MODE WORKSPACE ================= */
            <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0 animate-in fade-in duration-200">
              <ChatWindow
                messages={messages}
                isLoading={isLoading}
                messagesEndRef={messagesEndRef}
                onUpdateUserMessage={onUpdateUserMessage}
                onRegenerateFromCheckpoint={onRegenerateFromCheckpoint}
              />

              <footer className="p-6 border-t border-theme-border/60 max-w-3xl w-full mx-auto space-y-4 shrink-0 bg-theme-bg animate-in slide-in-from-bottom-4 duration-300">
                {renderFooterContents()}
              </footer>
            </div>
          )}

          {/* 📌 RIGHT RAIL: Advanced Telemetry & Selective Memory Context Maps */}
          <ContextSidebar />
        </div>
      </div>
    </div>
  );
}
