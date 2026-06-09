// src/components/ChatWindow.tsx
import { Zap } from "lucide-react";
import React from "react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: string;
  content: string;
}

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
  hasMessages: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  hasMessages,
  messagesEndRef,
}) => {
  return (
    <main className="flex-1 overflow-y-auto p-6 bg-theme-bg transition-colors duration-200">
      <div className="max-w-3xl w-full mx-auto space-y-6 flex flex-col">
        {!hasMessages ? (
          /* ================= EMPTY STATE CANVAS ================= */
          <div className="flex h-[70vh] flex-col items-center justify-center text-theme-muted space-y-3 text-center">
            <div className="h-12 w-12 rounded-2xl bg-theme-panel border border-theme-border flex items-center justify-center text-theme-accent font-bold text-lg shadow-sm">
              <Zap className="w-4 h-4 fill-theme-accent/10 stroke-[2.5]" />
            </div>
            <div>
              <p className="text-base font-medium text-theme-text">
                Promptly is offline-ready.
              </p>
              <p className="text-xs text-theme-muted max-w-xs mt-1">
                Select an active model from your system configuration menu above
                to begin a session.
              </p>
            </div>
          </div>
        ) : (
          /* ================= CONVERSATION THREAD MESSAGES ================= */
          messages.map((msg, idx) => {
            return (
              <div
                key={idx}
                className={`flex flex-col p-4 rounded-xl w-fit border animate-messageSlide transition-all duration-200 ${
                  msg.role === "user"
                    ? "bg-theme-panel border-theme-border text-theme-text ml-auto self-end max-w-[85%]"
                    : "bg-theme-panel/40 border-theme-border/60 mr-auto text-theme-text text-justify"
                }`}
              >
                {/* Meta Role Tags */}
                <span
                  className={`text-[10px] font-bold mb-1.5 tracking-wider uppercase ${
                    msg.role === "user"
                      ? "text-theme-muted"
                      : "text-theme-accent"
                  }`}
                >
                  {msg.role === "user" ? "User" : "Local Engine"}
                </span>

                {/* Body Content Engine Processing */}
                {msg.role === "assistant" ? (
                  <div className="prose prose-invert prose-sm max-w-none text-theme-text leading-relaxed text-justify">
                    <ReactMarkdown>{msg.content || ""}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-theme-text">
                    {msg.content}
                  </p>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    </main>
  );
};
