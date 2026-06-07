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
  isLoading,
  hasMessages,
  messagesEndRef,
}) => {
  return (
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
                Select an active model from your system configuration menu above
                to begin a session.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col p-4 rounded-xl w-fit border transition ${
                msg.role === "user"
                  ? "bg-zinc-900 ml-auto border-zinc-800 text-zinc-100 self-end max-w-[85%]"
                  : "bg-zinc-950/40 border-zinc-900 mr-auto text-zinc-200 text-justify"
              }`}
            >
              <span
                className={`text-[10px] font-bold mb-1.5 tracking-wider uppercase ${
                  msg.role === "user" ? "text-zinc-500" : "text-indigo-400"
                }`}
              >
                {msg.role === "user" ? "User" : "Local Engine"}
              </span>

              {msg.role === "assistant" ? (
                <div className="prose prose-invert prose-sm max-w-none text-zinc-200 leading-relaxed text-justify">
                  {/* Added text-justify here too so the inner markdown paragraphs align cleanly */}
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
  );
};
