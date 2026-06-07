import React, { useState, useRef, useEffect } from "react";
import { useChatStore } from "./store";
import { getModelSuggestedPrompts } from "./utils/chatHelpers";
import { Header } from "./components/Header";
import { ChatWindow } from "./components/ChatWindow";
import { PromptOptions } from "./components/PromptOptions";
import { MessageForm } from "./components/MessageForm";

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

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

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
    <div className="flex h-screen w-screen flex-col bg-zinc-950 text-zinc-100">
      <Header
        model={model}
        setModel={setModel}
        availableModels={availableModels}
        clearHistory={clearHistory}
      />

      <ChatWindow
        messages={messages}
        isLoading={isLoading}
        hasMessages={hasMessages}
        messagesEndRef={messagesEndRef}
      />

      <footer className="p-6 border-t border-zinc-900 max-w-3xl w-full mx-auto space-y-4">
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
  );
}
