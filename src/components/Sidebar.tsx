// src/components/Sidebar.tsx
import React, { useState } from "react";
import { Plus, X, Trash2, Settings } from "lucide-react";
import { ChatSession } from "../utils/db";
import { SettingsModal } from "./SettingsModal";

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <aside
        className={`h-screen bg-theme-bg border-r border-theme-border flex flex-col justify-between transition-all duration-300 ease-in-out select-none shrink-0 ${
          isOpen
            ? "w-64 opacity-100 translate-x-0"
            : "w-0 opacity-0 -translate-x-full overflow-hidden border-r-0"
        }`}
      >
        {/* Enforced layout wrapper to prevent text distortion during sidebar scaling */}
        <div className="flex flex-col h-full w-64 overflow-hidden">
          {/* Header Controls */}
          <div className="p-4 border-b border-theme-border flex items-center justify-between h-15.5">
            <span className="text-xs font-bold tracking-wider uppercase text-theme-muted">
              Recent Chats
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-theme-muted hover:text-theme-text p-1.5 hover:bg-theme-panel rounded-lg transition-colors cursor-pointer flex items-center justify-center"
              aria-label="Close Sidebar"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>

          {/* Action Button */}
          <div className="p-3">
            <button
              onClick={onNewChat}
              className="w-full bg-theme-panel hover:bg-theme-panel/80 text-theme-text border border-theme-border px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer group active:scale-[0.98] shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5] text-theme-accent group-hover:text-theme-accent-hover transition-colors" />
              <span>New Chat</span>
            </button>
          </div>

          {/* Sessions List Layer */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
            {sessions.map((session) => {
              const isActive = currentSessionId === session.id;
              return (
                <div
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition text-xs font-medium border ${
                    isActive
                      ? "bg-theme-panel text-theme-accent border-theme-border/80 shadow-xs"
                      : "bg-transparent text-theme-muted border-transparent hover:bg-theme-panel/40 hover:text-theme-text"
                  }`}
                >
                  <div className="flex flex-col truncate pr-2 gap-0.5">
                    <span
                      className={`truncate font-normal transition-colors ${isActive ? "text-theme-accent font-semibold" : "text-theme-text group-hover:text-theme-text"}`}
                    >
                      {session.title}
                    </span>
                    <span className="text-[10px] text-theme-muted/70 font-mono tracking-tight group-hover:text-theme-muted transition-colors">
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
                    className="p-1.5 hover:bg-theme-panel border border-transparent hover:border-theme-border/40 text-theme-muted/50 hover:text-rose-400 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0"
                    title="Delete Thread"
                  >
                    <Trash2 className="w-3.5 h-3.5 stroke-[1.8]" />
                  </button>
                </div>
              );
            })}

            {sessions.length === 0 && (
              <div className="text-center py-12 text-theme-muted/60 text-xs font-normal">
                No recent conversations.
              </div>
            )}
          </div>
        </div>

        {/* Bottom Status Dock */}
        <div className="p-4 border-t border-theme-border text-[10px] text-theme-muted font-mono w-64 flex items-center justify-between bg-theme-bg/80 backdrop-blur-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>
              Sandbox:{" "}
              <span className="text-emerald-500/90 font-semibold">Indexed</span>
            </span>
          </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="text-theme-muted hover:text-theme-text p-1.5 hover:bg-theme-panel rounded-lg transition-colors cursor-pointer flex items-center justify-center group border border-transparent hover:border-theme-border"
            title="Engine Settings"
          >
            <Settings className="w-4 h-4 stroke-[1.8] group-hover:rotate-45 transition-transform duration-300" />
          </button>
        </div>
      </aside>

      {/* Settings Modal Mounting Point */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
};
