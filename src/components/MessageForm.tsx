// src/components/MessageForm.tsx
import React, { useRef, useEffect } from "react";
import { useChatStore } from "../store";
import {
  Terminal,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  PenTool,
  Code,
  BrainCircuit,
  Terminal as DefaultIcon,
  Square,
  Send,
  Globe, // Added for Web Search control toggle UI visualization
  Loader2, // Added for continuous inline execution tracking state
} from "lucide-react";

interface MessageFormProps {
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

// Map store literal token labels back to explicit Lucide components
const IconMap: Record<string, React.ComponentType<any>> = {
  Sparkles,
  PenTool,
  Code,
  BrainCircuit,
  Terminal: DefaultIcon,
};

export const MessageForm: React.FC<MessageFormProps> = ({
  input,
  setInput,
  isLoading,
  onSubmit,
}) => {
  // Destructured the search configuration slice variables from your updated Zustand state
  const { messages, customPersonas, stopGeneration, search, setSearchEnabled } =
    useChatStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Custom Frame-by-Frame Smooth Scroll Engine Loop
  const scrollCarousel = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollAmount = 220;
    const startPosition = container.scrollLeft;
    const targetPosition =
      direction === "left"
        ? startPosition - scrollAmount
        : startPosition + scrollAmount;

    const duration = 240;
    let startTime: number | null = null;

    const animateScroll = (currentTime: number) => {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;

      const progress = Math.min(timeElapsed / duration, 1);
      // Clean ease-in-out calculation curve
      const easeQuadInOut =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      container.scrollLeft =
        startPosition + (targetPosition - startPosition) * easeQuadInOut;

      if (timeElapsed < duration) {
        requestAnimationFrame(animateScroll);
      }
    };

    requestAnimationFrame(animateScroll);
  };

  const injectProfile = (directive: string) => {
    setInput(directive + "\n\n");
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [input]);

  // Force focus back to the input if the chat is cleared or deleted
  useEffect(() => {
    if (messages.length === 0 && textareaRef.current) {
      // A microtask timeout ensures the DOM has finished updating/rendering
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [messages.length]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        onSubmit(e);
      }
    }
  };

  const isExpanded =
    input.length > 0 && (input.includes("\n") || input.trim().length > 0);

  return (
    <div className="space-y-2 w-full bg-theme-bg">
      {/* System Personas Tray Dock */}
      {messages.length === 0 && (
        <div className="flex flex-col space-y-1">
          <div className="text-[10px] font-bold text-theme-muted flex items-center gap-1 shrink-0 uppercase tracking-wider pl-1">
            <Terminal className="w-3 h-3 text-theme-accent" />{" "}
            <span>System Personas:</span>
          </div>

          <div className="relative w-full overflow-hidden flex items-center group/formCarousel">
            {/* Static Left Navigation Arrow Badge */}
            <button
              type="button"
              onClick={() => scrollCarousel("left")}
              className="absolute left-0 z-10 p-1 bg-theme-bg/90 border border-theme-border/40 text-theme-muted hover:text-theme-text rounded-md opacity-70 hover:opacity-100 transition-all cursor-pointer backdrop-blur-sm shadow-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Scrolling Horizontal Lane Tracker */}
            <div
              ref={scrollContainerRef}
              className="flex flex-row flex-nowrap gap-2 items-center overflow-x-auto pb-1 pt-0.5 scrollbar-none w-full px-7"
            >
              {customPersonas.map((p) => {
                const ProfileIcon = IconMap[p.icon] || DefaultIcon;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={isLoading}
                    onClick={() => injectProfile(p.prompt)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-theme-panel/40 hover:bg-theme-panel border border-theme-border/60 hover:border-theme-accent/50 rounded-full text-xs text-theme-muted hover:text-theme-text transition cursor-pointer active:scale-95 disabled:opacity-40 font-medium shrink-0 max-w-50"
                  >
                    <ProfileIcon className="w-3 h-3 shrink-0" />
                    <span className="truncate">{p.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Static Right Navigation Arrow Badge */}
            <button
              type="button"
              onClick={() => scrollCarousel("right")}
              className="absolute right-0 z-10 p-1 bg-theme-bg/90 border border-theme-border/40 text-theme-muted hover:text-theme-text rounded-md opacity-70 hover:opacity-100 transition-all cursor-pointer backdrop-blur-sm shadow-xs"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Gradient Masks for smooth trailing side cuts */}
            <div className="absolute top-0 right-0 h-full w-7 bg-linear-to-l from-theme-bg to-transparent pointer-events-none" />
            <div className="absolute top-0 left-0 h-full w-7 bg-linear-to-r from-theme-bg to-transparent pointer-events-none" />
          </div>
        </div>
      )}

      {/* RAG SEARCH STATUS NOTIFIER BANNER */}
      {search?.enabled && search.status !== "idle" && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-theme-panel/30 border border-theme-border/40 rounded-lg text-xs font-mono transition-all animate-fade-in">
          {search.status === "searching" && (
            <div className="flex items-center gap-2 text-theme-accent">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Searching web for real-time sources...</span>
            </div>
          )}
          {search.status === "completed" && (
            <div className="flex items-center gap-2 text-emerald-500">
              <span className="font-bold">✓</span>
              <span>
                Found {search.maxResults} matching sources. Injecting context...
              </span>
            </div>
          )}
          {search.status === "error" && (
            <div className="flex items-center gap-2 text-amber-500">
              <span className="font-bold">⚠️</span>
              <span>
                Web search failed. Proceeding with fallback internal knowledge
                base...
              </span>
            </div>
          )}
        </div>
      )}

      {/* INPUT CONTROLLER CONTAINER */}
      <form onSubmit={onSubmit} className="w-full">
        <div
          className={`flex bg-theme-panel border border-theme-border rounded-2xl focus-within:border-theme-accent/60 transition-all duration-200 p-2 ${
            isExpanded
              ? "flex-col min-h-27.5 justify-between"
              : "flex-row items-center gap-2"
          }`}
        >
          {/* Top/Center Workspace Row: Contains Textarea */}
          <div
            className={`w-full ${isExpanded ? "mb-2" : "flex items-center"}`}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isLoading
                  ? "Engine compiling..."
                  : "Enter Prompt... (Ctrl+Enter to execute)"
              }
              disabled={isLoading}
              className={`w-full bg-transparent max-h-48 resize-none text-sm focus:outline-none transition text-theme-text placeholder-theme-muted disabled:opacity-40 font-mono ${
                isExpanded
                  ? "pt-1.5 px-3 pb-0 leading-relaxed"
                  : "py-1.5 px-1 leading-5 overflow-hidden block"
              }`}
            />
          </div>

          {/* Action Button Controls */}
          {isExpanded ? (
            /* --- ACTION BAR VIEW (Stacked Below) --- */
            <div className="flex items-center justify-between pt-1 px-1 w-full border-t border-theme-border/20">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setSearchEnabled(!search.enabled)}
                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-30 ${
                  search.enabled
                    ? "bg-theme-accent/15 text-theme-accent border border-theme-accent/30"
                    : "text-theme-muted hover:bg-theme-bg hover:text-theme-text border border-transparent"
                }`}
              >
                <Globe className="w-4 h-4" />
              </button>

              <button
                type={isLoading ? "button" : "submit"}
                onClick={isLoading ? () => stopGeneration() : undefined}
                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                  isLoading
                    ? "bg-red-500/10 text-red-500"
                    : "bg-theme-accent text-theme-bg hover:bg-theme-accent-hover"
                }`}
              >
                {isLoading ? (
                  <Square className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          ) : (
            /* --- INLINE VIEW (Single Baseline Row) --- */
            <>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setSearchEnabled(!search.enabled)}
                title={
                  search.enabled
                    ? "Disable Web Search Integration"
                    : "Enable Web Search Integration"
                }
                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed order-first shrink-0 ml-0.5 ${
                  search.enabled
                    ? "bg-theme-accent/15 text-theme-accent border border-theme-accent/30"
                    : "text-theme-muted hover:bg-theme-bg hover:text-theme-text border border-transparent"
                }`}
              >
                <Globe className="w-4 h-4" />
              </button>

              <button
                type={isLoading ? "button" : "submit"}
                onClick={isLoading ? () => stopGeneration() : undefined}
                disabled={!isLoading && input.trim().length === 0}
                title={isLoading ? "Stop Execution" : "Send Prompt"}
                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shrink-0 mr-0.5 ${
                  isLoading
                    ? "bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white"
                    : "bg-theme-accent text-theme-bg hover:bg-theme-accent-hover"
                }`}
              >
                {isLoading ? (
                  <Square className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
};
