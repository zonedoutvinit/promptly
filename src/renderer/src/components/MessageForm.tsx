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
} from "lucide-react";

interface MessageFormProps {
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
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
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
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
            <button
              type="button"
              onClick={() => scrollCarousel("left")}
              className="absolute left-0 z-10 p-1 bg-theme-bg/90 border border-theme-border/40 text-theme-muted hover:text-theme-text rounded-md opacity-70 hover:opacity-100 transition-all cursor-pointer backdrop-blur-sm shadow-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

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

            <button
              type="button"
              onClick={() => scrollCarousel("right")}
              className="absolute right-0 z-10 p-1 bg-theme-bg/90 border border-theme-border/40 text-theme-muted hover:text-theme-text rounded-md opacity-70 hover:opacity-100 transition-all cursor-pointer backdrop-blur-sm shadow-xs"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

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
      <form onSubmit={onSubmit} className="w-full space-y-2">
        <div
          className={`flex bg-theme-panel border border-theme-border rounded-2xl focus-within:border-theme-accent/60 transition-all duration-200 p-2 ${
            isExpanded
              ? "flex-col min-h-27.5 justify-between"
              : "flex-row items-center gap-2"
          }`}
        >
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

          {isExpanded ? (
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

        {/* BOTTOM CONFIGURATION BAR: Revamped Sleek Pills */}
        <div className="flex items-center gap-2 px-1 pt-1">
          {/* Engine Selection Pill */}
          <div className="relative flex items-center bg-theme-panel/50 hover:bg-theme-panel border border-theme-border/80 hover:border-theme-accent/40 rounded-xl px-2.5 py-1 transition-all shadow-2xs group cursor-pointer">
            <Cpu className="w-3.5 h-3.5 text-theme-accent/80 mr-1.5 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[8px] uppercase font-bold tracking-wider text-theme-muted/70 leading-none mb-0.5">
                Engine
              </span>
              <select
                value={currentProvider}
                onChange={(e) => setProvider(e.target.value as ProviderType)}
                className="appearance-none bg-transparent text-xs text-theme-text font-medium outline-none pr-5 cursor-pointer leading-tight"
              >
                {(Object.keys(settings.providers) as ProviderType[]).map(
                  (p) => (
                    <option
                      key={p}
                      value={p}
                      className="bg-theme-bg text-theme-text text-xs"
                    >
                      {providerLabels[p]}
                    </option>
                  ),
                )}
              </select>
            </div>
            <ChevronDown className="w-3 h-3 text-theme-muted group-hover:text-theme-text absolute right-2 pointer-events-none transition-colors" />
          </div>

          {/* Model Selection Pill */}
          <div className="relative flex items-center bg-theme-panel/50 hover:bg-theme-panel border border-theme-border/80 hover:border-theme-accent/40 rounded-xl px-2.5 py-1 transition-all shadow-2xs group cursor-pointer">
            <Sparkles className="w-3.5 h-3.5 text-theme-accent/80 mr-1.5 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[8px] uppercase font-bold tracking-wider text-theme-muted/70 leading-none mb-0.5">
                Model
              </span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={availableModels.length === 0}
                className="appearance-none bg-transparent text-xs text-theme-accent font-mono font-medium outline-none pr-5 cursor-pointer leading-tight disabled:opacity-50 disabled:cursor-not-allowed"
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
            </div>
            <ChevronDown className="w-3 h-3 text-theme-muted group-hover:text-theme-text absolute right-2 pointer-events-none transition-colors" />
          </div>
        </div>
      </form>
    </div>
  );
};
