// src/components/Sidebar.tsx
import React from "react";
import { ChatSession } from "../utils/db";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewChat: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  setIsOpen,
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onNewChat,
}) => {
  return (
    <aside
      className={`h-screen bg-zinc-950 border-r border-zinc-900 flex flex-col justify-between transition-all duration-300 ease-in-out select-none shrink-0 ${
        isOpen
          ? "w-64 opacity-100 translate-x-0"
          : "w-0 opacity-0 -translate-x-full overflow-hidden border-r-0"
      }`}
    >
      {/*
        This nested wrapper enforces our 240px layout structure.
        Without this, shrinking the width to 0 causes standard text elements to scramble vertically during the 300ms window.
      */}
      <div className="flex flex-col h-full w-64 overflow-hidden">
        {/* Header Title Controls */}
        <div className="p-4 border-b border-zinc-900 flex items-center justify-between">
          <span className="text-xs font-bold tracking-wider uppercase text-zinc-400">
            Recent Chats
          </span>
          <button
            onClick={() => setIsOpen(false)}
            className="text-zinc-500 hover:text-zinc-300 p-1 hover:bg-zinc-900 rounded transition"
          >
            ✕
          </button>
        </div>

        {/* Gemini-Style "New Chat" Action Button */}
        <div className="p-3">
          <button
            onClick={onNewChat}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <span>+</span> New Chat
          </button>
        </div>

        {/* Chat Sessions Index Column List */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
          {sessions.map((session) => {
            const isActive = currentSessionId === session.id;
            return (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition text-xs font-medium ${
                  isActive
                    ? "bg-zinc-900 text-indigo-400 border border-zinc-800"
                    : "text-zinc-500 hover:bg-zinc-900/40 hover:text-zinc-300"
                }`}
              >
                <div className="flex flex-col truncate pr-2 gap-0.5">
                  <span className="truncate text-zinc-200 font-normal">
                    {session.title}
                  </span>
                  <span className="text-[10px] text-zinc-600 font-mono tracking-tight">
                    {session.model}
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      confirm(
                        "Delete this conversation thread from local memory storage?",
                      )
                    ) {
                      onDeleteSession(session.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-800 text-zinc-600 hover:text-rose-400 rounded transition"
                >
                  🗑️
                </button>
              </div>
            );
          })}

          {sessions.length === 0 && (
            <div className="text-center py-12 text-zinc-600 text-xs">
              No recent conversations.
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-zinc-900 text-[10px] text-zinc-600 font-mono w-64">
        Sandbox: <span className="text-emerald-600">Local Threads Indexed</span>
      </div>
    </aside>
  );
};
