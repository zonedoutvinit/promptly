// src/components/MessageForm.tsx
import React, { useRef, useEffect } from "react";
import { useChatStore, ProviderType } from "../store";
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
  Globe,
  Loader2,
  Cpu,
  ChevronDown,
  Columns2,
  Paperclip,
} from "lucide-react";

interface MessageFormProps {
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onImportClick?: () => void;
}

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
  onImportClick,
}) => {
  const {
    messages,
    customPersonas,
    stopGeneration,
    search,
    setSearchEnabled,
    settings,
    setProvider,
    model,
    availableModels,
    setModel,
    workspaceEnabled = false,
    setWorkspaceEnabled,
    activeWorkspaceSelection,
  } = useChatStore();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const currentProvider = settings.currentProvider;

  const providerLabels: Record<ProviderType, string> = {
    ollama: "Ollama",
    "lm-studio": "LM Studio",
    "openai-compatible": "OpenAI API",
    gemini: "Google Gemini",
  };

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
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [input]);

  useEffect(() => {
    if (messages.length === 0 && textareaRef.current) {
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
    input.length > 0 && (input.includes("\n") || input.trim().length > 28);

  const hasStatusStrip = Boolean(search?.enabled && search.status !== "idle");

  return (
    <div className="space-y-1.5 w-full bg-theme-bg min-w-0">
      {/* Compact Single-Row Personas Tray (New Chat Only) */}
      {messages.length === 0 && (
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-[10px] font-bold text-theme-muted flex items-center gap-1 shrink-0 uppercase tracking-wider">
            <Terminal className="w-3 h-3 text-theme-accent" />
            <span className="hidden sm:inline">Personas</span>
          </div>

          <div className="relative flex-1 overflow-hidden flex items-center min-w-0">
            <button
              type="button"
              onClick={() => scrollCarousel("left")}
              aria-label="Scroll personas left"
              className="absolute left-0 z-10 h-6 w-6 flex items-center justify-center bg-theme-bg/95 border border-theme-border/40 text-theme-muted hover:text-theme-text rounded-md cursor-pointer"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>

            <div
              ref={scrollContainerRef}
              className="flex flex-row flex-nowrap gap-1.5 items-center overflow-x-auto py-0.5 scrollbar-none w-full px-7"
            >
              {customPersonas.map((p) => {
                const ProfileIcon = IconMap[p.icon] || DefaultIcon;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={isLoading}
                    onClick={() => injectProfile(p.prompt)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-theme-panel/40 hover:bg-theme-panel border border-theme-border/60 hover:border-theme-accent/50 rounded-full text-[11px] leading-none text-theme-muted hover:text-theme-text transition-colors cursor-pointer disabled:opacity-40 font-medium shrink-0 max-w-44"
                  >
                    <ProfileIcon className="w-3 h-3 shrink-0" />
                    <span className="truncate">{p.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => scrollCarousel("right")}
              aria-label="Scroll personas right"
              className="absolute right-0 z-10 h-6 w-6 flex items-center justify-center bg-theme-bg/95 border border-theme-border/40 text-theme-muted hover:text-theme-text rounded-md cursor-pointer"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Slim Single-Line Status Strip (Workspace + Search) */}
      {hasStatusStrip && (
        <div className="flex items-center justify-between gap-2 px-2.5 py-1 bg-theme-panel/35 border border-theme-border/50 rounded-lg text-[11px] font-mono min-w-0">
          <div className="flex items-center gap-3 min-w-0 truncate">
            {search.status === "searching" && (
              <span className="inline-flex items-center gap-1.5 text-theme-accent truncate">
                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                <span className="truncate">Searching web...</span>
              </span>
            )}
            {search.status === "completed" && (
              <span className="inline-flex items-center gap-1.5 text-emerald-500 truncate">
                <span>✓</span>
                <span className="truncate">
                  {search.maxResults} sources injected
                </span>
              </span>
            )}
            {search.status === "error" && (
              <span className="inline-flex items-center gap-1.5 text-amber-500 truncate">
                <span>⚠️</span>
                <span className="truncate">Search fallback active</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Compact Composer + Inline Engine/Model Bar */}
      <form onSubmit={onSubmit} className="w-full space-y-1.5 min-w-0">
        <div
          className={`flex bg-theme-panel border rounded-xl transition-colors duration-150 px-2 py-1.5 min-w-0 ${
            workspaceEnabled
              ? "border-theme-accent/60"
              : "border-theme-border focus-within:border-theme-accent/60"
          } ${
            isExpanded ? "flex-col gap-1.5" : "flex-row items-center gap-1.5"
          }`}
        >
          {/* Left Action Toggles (Inline when compact) */}
          {!isExpanded && (
            <div className="flex items-center gap-1 shrink-0">
              {onImportClick && (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={onImportClick}
                  title="Import HTML, image, or audio file"
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-theme-muted hover:bg-theme-bg hover:text-theme-text border border-transparent transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                disabled={isLoading}
                onClick={() => setSearchEnabled(!search.enabled)}
                title={
                  search.enabled
                    ? "Disable Web Search Integration"
                    : "Enable Web Search Integration"
                }
                className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                  search.enabled
                    ? "bg-theme-accent/15 text-theme-accent border border-theme-accent/30"
                    : "text-theme-muted hover:bg-theme-bg hover:text-theme-text border border-transparent"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => setWorkspaceEnabled?.(!workspaceEnabled)}
                title={
                  workspaceEnabled
                    ? "Disable Side-by-Side Workspace"
                    : "Enable Side-by-Side Workspace"
                }
                className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                  workspaceEnabled
                    ? "bg-theme-accent/15 text-theme-accent border border-theme-accent/30"
                    : "text-theme-muted hover:bg-theme-bg hover:text-theme-text border border-transparent"
                }`}
              >
                <Columns2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Prompt Input */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isLoading
                ? "Engine compiling..."
                : workspaceEnabled
                  ? "Create or edit canvas file... (Ctrl+Enter)"
                  : "Enter prompt... (Ctrl+Enter)"
            }
            disabled={isLoading}
            className={`w-full min-w-0 bg-transparent max-h-40 resize-none text-xs sm:text-sm focus:outline-none text-theme-text placeholder-theme-muted disabled:opacity-40 font-mono leading-5 ${
              isExpanded ? "px-1.5 py-1" : "px-1.5 py-1 overflow-y-auto"
            }`}
          />

          {/* Expanded Bottom Action Row vs Compact Right Submit Button */}
          {isExpanded ? (
            <div className="flex items-center justify-between pt-1 border-t border-theme-border/30 w-full">
              <div className="flex items-center gap-1">
                {onImportClick && (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={onImportClick}
                    title="Import HTML, image, or audio file"
                    className="h-7 px-2 rounded-lg flex items-center gap-1 text-[11px] font-mono text-theme-muted hover:bg-theme-bg hover:text-theme-text border border-transparent transition-colors cursor-pointer disabled:opacity-30"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>Import</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => setSearchEnabled(!search.enabled)}
                  title={
                    search.enabled
                      ? "Disable Web Search Integration"
                      : "Enable Web Search Integration"
                  }
                  className={`h-7 px-2 rounded-lg flex items-center gap-1 text-[11px] font-mono transition-colors cursor-pointer disabled:opacity-30 ${
                    search.enabled
                      ? "bg-theme-accent/15 text-theme-accent border border-theme-accent/30 font-semibold"
                      : "text-theme-muted hover:bg-theme-bg hover:text-theme-text border border-transparent"
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Search</span>
                </button>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => setWorkspaceEnabled?.(!workspaceEnabled)}
                  title={
                    workspaceEnabled
                      ? "Disable Side-by-Side Workspace"
                      : "Enable Side-by-Side Workspace"
                  }
                  className={`h-7 px-2 rounded-lg flex items-center gap-1 text-[11px] font-mono transition-colors cursor-pointer disabled:opacity-30 ${
                    workspaceEnabled
                      ? "bg-theme-accent/15 text-theme-accent border border-theme-accent/30 font-semibold"
                      : "text-theme-muted hover:bg-theme-bg hover:text-theme-text border border-transparent"
                  }`}
                >
                  <Columns2 className="w-3.5 h-3.5" />
                  <span>Workspace</span>
                </button>
              </div>

              <button
                type={isLoading ? "button" : "submit"}
                onClick={isLoading ? () => stopGeneration() : undefined}
                disabled={!isLoading && input.trim().length === 0}
                title={isLoading ? "Stop Execution" : "Send Prompt"}
                className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                  isLoading
                    ? "bg-red-500/15 text-red-500 hover:bg-red-500 hover:text-white"
                    : "bg-theme-accent text-theme-bg hover:bg-theme-accent-hover"
                }`}
              >
                {isLoading ? (
                  <Square className="w-3 h-3 fill-current" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          ) : (
            <button
              type={isLoading ? "button" : "submit"}
              onClick={isLoading ? () => stopGeneration() : undefined}
              disabled={!isLoading && input.trim().length === 0}
              title={isLoading ? "Stop Execution" : "Send Prompt"}
              className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0 ${
                isLoading
                  ? "bg-red-500/15 text-red-500 hover:bg-red-500 hover:text-white"
                  : "bg-theme-accent text-theme-bg hover:bg-theme-accent-hover"
              }`}
            >
              {isLoading ? (
                <Square className="w-3 h-3 fill-current" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Single-Row Engine & Model Selector Strip */}
        <div className="flex items-center gap-1.5 px-0.5 flex-wrap">
          <div className="relative inline-flex items-center bg-theme-panel/45 hover:bg-theme-panel border border-theme-border/70 rounded-lg pl-2 pr-6 py-1 transition-colors cursor-pointer">
            <Cpu className="w-3 h-3 text-theme-accent/80 mr-1.5 shrink-0" />
            <select
              aria-label="Engine"
              value={currentProvider}
              onChange={(e) => setProvider(e.target.value as ProviderType)}
              className="appearance-none bg-transparent text-[11px] text-theme-text font-medium outline-none cursor-pointer leading-none"
            >
              {(Object.keys(settings.providers) as ProviderType[]).map((p) => (
                <option
                  key={p}
                  value={p}
                  className="bg-theme-bg text-theme-text text-xs"
                >
                  {providerLabels[p]}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-theme-muted absolute right-1.5 pointer-events-none" />
          </div>

          <div className="relative inline-flex items-center bg-theme-panel/45 hover:bg-theme-panel border border-theme-border/70 rounded-lg pl-2 pr-6 py-1 transition-colors cursor-pointer max-w-52">
            <Sparkles className="w-3 h-3 text-theme-accent/80 mr-1.5 shrink-0" />
            <select
              aria-label="Model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={availableModels.length === 0}
              className="appearance-none bg-transparent text-[11px] text-theme-accent font-mono font-medium outline-none cursor-pointer leading-none truncate disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {availableModels.length > 0 ? (
                availableModels.map((m) => (
                  <option
                    key={m}
                    value={m}
                    className="bg-theme-bg text-theme-text font-mono text-xs"
                  >
                    {m}
                  </option>
                ))
              ) : (
                <option className="bg-theme-bg text-theme-muted font-mono text-xs">
                  No models ready
                </option>
              )}
            </select>
            <ChevronDown className="w-3 h-3 text-theme-muted absolute right-1.5 pointer-events-none" />
          </div>
        </div>
      </form>
    </div>
  );
};
