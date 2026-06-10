// src/components/Sidebar.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  X,
  Trash2,
  Settings,
  FileText,
  Braces,
  MoreVertical,
} from "lucide-react";
import { ChatSession } from "../utils/db";
import { SettingsModal } from "./SettingsModal";
import { exportToMarkdown, exportToJSON } from "../utils/exporter";

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
  const [activeMenuSessionId, setActiveMenuSessionId] = useState<string | null>(
    null,
  );
  const menuRef = useRef<HTMLDivElement>(null);

  // 🖱️ Event trigger to clear the menu if a user clicks anywhere outside its bounding box
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuSessionId(null);
      }
    };

    if (activeMenuSessionId !== null) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [activeMenuSessionId]);

  const toggleMenu = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation(); // Block selection triggers on row click
    setActiveMenuSessionId(
      activeMenuSessionId === sessionId ? null : sessionId,
    );
  };

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
          <div className="p-4 border-b border-theme-border flex items-center justify-between h-15.5 shrink-0">
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
          <div className="p-3 shrink-0">
            <button
              onClick={onNewChat}
              className="w-full bg-theme-panel hover:bg-theme-panel/80 text-theme-text border border-theme-border px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer group active:scale-[0.98] shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5] text-theme-accent group-hover:text-theme-accent-hover transition-colors" />
              <span>New Chat</span>
            </button>
          </div>

          {/* Sessions List Layer */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 scrollbar-none">
            {sessions.map((session) => {
              const isActive = currentSessionId === session.id;
              const isMenuOpen = activeMenuSessionId === session.id;
              const hasMessages =
                session.messages && session.messages.length > 0;

              return (
                <div
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition text-xs font-medium border ${
                    isActive
                      ? "bg-theme-panel text-theme-accent border-theme-border/80 shadow-xs"
                      : "bg-transparent text-theme-muted border-transparent hover:bg-theme-panel/40 hover:text-theme-text"
                  }`}
                >
                  {/* Left Side: Session Details */}
                  <div className="flex flex-col truncate pr-2 gap-0.5 max-w-[85%]">
                    <span
                      className={`truncate font-normal transition-colors ${
                        isActive
                          ? "text-theme-accent font-semibold"
                          : "text-theme-text"
                      }`}
                    >
                      {session.title}
                    </span>
                    <span className="text-[10px] text-theme-muted/70 font-mono tracking-tight transition-colors">
                      {session.model}
                    </span>
                  </div>

                  {/* Right Side: Persistent Action Anchor Menu Key */}
                  <div className="relative shrink-0 flex items-center">
                    <button
                      type="button"
                      onClick={(e) => toggleMenu(e, session.id)}
                      className="p-1 text-theme-text hover:bg-theme-panel/80 border border-transparent hover:border-theme-border/40 rounded-md transition-all cursor-pointer flex items-center justify-center"
                      title="Thread Utilities Menu"
                    >
                      <MoreVertical className="w-3.5 h-3.5 stroke-2" />
                    </button>

                    {/* ⚙️ Absolute Context Dropdown Overlay Panel */}
                    {isMenuOpen && (
                      <div
                        ref={menuRef}
                        className="absolute right-0 top-7 z-50 w-44 bg-theme-panel border border-theme-border rounded-xl shadow-lg p-1 animate-fadeIn font-normal text-theme-text text-xs space-y-0.5"
                        onClick={(e) => e.stopPropagation()} // Keep actions from selecting row underneath
                      >
                        {hasMessages && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                exportToMarkdown(session);
                                setActiveMenuSessionId(null);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-2 text-left text-theme-muted hover:text-theme-text hover:bg-theme-bg/60 rounded-lg transition-colors cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5 text-theme-accent/80" />
                              <span>Export Markdown</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                exportToJSON(session);
                                setActiveMenuSessionId(null);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-2 text-left text-theme-muted hover:text-theme-text hover:bg-theme-bg/60 rounded-lg transition-colors cursor-pointer"
                            >
                              <Braces className="w-3.5 h-3.5 text-theme-accent/80" />
                              <span>Export JSON Context</span>
                            </button>

                            <div className="h-px bg-theme-border/60 my-1 mx-1" />
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuSessionId(null);
                            if (
                              confirm(
                                "Delete this conversation thread from local memory storage?",
                              )
                            ) {
                              onDeleteSession(session.id);
                            }
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 text-left text-rose-400/90 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 stroke-[1.8]" />
                          <span>Delete Thread</span>
                        </button>
                      </div>
                    )}
                  </div>
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
        <div className="p-4 border-t border-theme-border text-[10px] text-theme-muted font-mono w-64 flex items-center justify-between bg-theme-bg/80 backdrop-blur-xs shrink-0">
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
