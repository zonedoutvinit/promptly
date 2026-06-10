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
  Square, // Added for Stop icon
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
  const { messages, customPersonas, stopGeneration } = useChatStore();
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        onSubmit(e);
      }
    }
  };

  return (
    <div className="space-y-3 w-full bg-theme-bg select-none">
      {/* System Personas Tray Dock: Displays only when conversation history is fresh */}
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

      {/* INPUT CONTROLLER CONTAINER */}
      <form
        onSubmit={onSubmit}
        className="flex gap-2 items-end transition-colors duration-200"
      >
        <div className="flex-1 relative flex items-center bg-theme-panel border border-theme-border rounded-xl focus-within:border-theme-accent/60 transition">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isLoading
                ? "Engine compiling response..."
                : "Enter structural instructions... (Ctrl+Enter to execute)"
            }
            disabled={isLoading}
            className="w-full bg-transparent max-h-40 resize-none px-4 py-3.5 text-sm focus:outline-none transition text-theme-text placeholder-theme-muted disabled:opacity-40 font-mono leading-relaxed"
          />
        </div>

        {/* Dynamic Execute/Stop Button */}
        <button
          type={isLoading ? "button" : "submit"}
          onClick={isLoading ? stopGeneration : undefined}
          disabled={!isLoading && input.trim().length === 0}
          className={`${
            isLoading
              ? "bg-theme-muted hover:bg-red-500 text-white"
              : "bg-theme-accent hover:bg-theme-accent-hover text-theme-bg"
          } font-semibold px-5 h-11.5 rounded-xl text-sm transition-all cursor-pointer active:scale-[0.98] shrink-0 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {isLoading ? (
            <>
              <Square className="w-3 h-3 fill-current" />
              Stop
            </>
          ) : (
            "Execute"
          )}
        </button>
      </form>
    </div>
  );
};
