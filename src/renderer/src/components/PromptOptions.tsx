// src/components/PromptOptions.tsx
import React, { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, Edit3, ChevronDown } from "lucide-react";
import { genericOptions } from "@renderer/utils/chatHelpers";

interface PromptOptionsProps {
  activeTab: "dynamic" | "generic";
  setActiveTab: (tab: "dynamic" | "generic") => void;
  dynamicSuggestedPrompts: string[];
  onSubmit: (promptText: string) => void;
}

export const PromptOptions: React.FC<PromptOptionsProps> = ({
  activeTab,
  setActiveTab,
  dynamicSuggestedPrompts,
  onSubmit,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasDynamicPrompts = dynamicSuggestedPrompts.length > 0;

  // Hardware-Accelerated Programmatic Smooth Scroll Loop
  const scrollCarousel = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollAmount = 240;
    const startPosition = container.scrollLeft;
    const targetPosition =
      direction === "left"
        ? startPosition - scrollAmount
        : startPosition + scrollAmount;

    const duration = 250;
    let startTime: number | null = null;

    // 🚀 Custom interpolation engine running on the graphics card thread
    const animateScroll = (currentTime: number) => {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;

      // Clean quad ease-in-out curve for natural deceleration acceleration physics
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

  // Clicking the chip stages the text for editing in the footer textarea
  const stagePromptForEdit = (e: React.MouseEvent, promptText: string) => {
    e.stopPropagation();
    const footerElement = document.querySelector("footer");
    const textarea = footerElement?.querySelector("textarea");

    if (textarea) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(textarea, promptText);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        textarea.focus();
      }
    }
  };

  return (
    <div className="mb-1 flex flex-col gap-1 select-none min-w-0">
      {/* Ultra-compact Header Strip */}
      <div className="flex items-center justify-between px-0.5">
        {hasDynamicPrompts ? (
          <div className="inline-flex items-center gap-1 bg-theme-panel/40 p-0.5 rounded-lg border border-theme-border/40">
            <button
              type="button"
              onClick={() => {
                setActiveTab("dynamic");
                setIsExpanded(true);
              }}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                activeTab === "dynamic"
                  ? "bg-theme-accent/15 text-theme-accent"
                  : "text-theme-muted hover:text-theme-text"
              }`}
            >
              Suggested
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("generic");
                setIsExpanded(true);
              }}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                activeTab === "generic"
                  ? "bg-theme-panel text-theme-text"
                  : "text-theme-muted hover:text-theme-text"
              }`}
            >
              Defaults
            </button>
          </div>
        ) : (
          <span className="text-[10px] font-bold text-theme-muted/80 uppercase tracking-wider px-1">
            Prompt Toolkit
          </span>
        )}

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? "Collapse prompts" : "Expand prompts"}
          className="text-theme-muted hover:text-theme-text p-1 hover:bg-theme-panel/60 rounded-md transition-colors cursor-pointer"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${
              isExpanded ? "" : "-rotate-90"
            }`}
          />
        </button>
      </div>

      {/* Single-Row Horizontal Chip Strip */}
      {isExpanded && (
        <div className="relative w-full overflow-hidden flex items-center min-w-0">
          {activeTab === "dynamic" && hasDynamicPrompts && (
            <button
              type="button"
              onClick={() => scrollCarousel("left")}
              aria-label="Scroll prompts left"
              className="absolute left-0 z-10 h-6 w-6 flex items-center justify-center bg-theme-bg/95 border border-theme-border/50 text-theme-muted hover:text-theme-text rounded-md backdrop-blur-xs cursor-pointer"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
          )}

          <div
            ref={scrollContainerRef}
            className={`flex flex-row flex-nowrap gap-1.5 items-center overflow-x-auto py-0.5 scrollbar-none w-full min-w-0 ${
              activeTab === "dynamic" && hasDynamicPrompts ? "px-7" : "px-1"
            }`}
          >
            {activeTab === "dynamic" && hasDynamicPrompts
              ? dynamicSuggestedPrompts.map((promptText, i) => (
                  <button
                    key={`dynamic-${i}`}
                    type="button"
                    onClick={(e) => stagePromptForEdit(e, promptText)}
                    className="inline-flex items-center text-[11px] leading-none bg-theme-accent/5 hover:bg-theme-accent/15 text-theme-accent border border-theme-accent/20 hover:border-theme-accent/40 px-2.5 py-1.5 rounded-lg transition-colors shrink-0 font-mono cursor-pointer max-w-60 truncate"
                  >
                    <span className="truncate">"{promptText}"</span>
                  </button>
                ))
              : genericOptions.map((opt, i) => (
                  <div
                    key={`generic-${i}`}
                    onClick={() => onSubmit(opt.prompt)}
                    className="inline-flex items-center gap-1 text-[11px] leading-none bg-theme-panel/60 hover:bg-theme-panel text-theme-text/85 hover:text-theme-text border border-theme-border/70 hover:border-theme-accent/40 pl-2.5 pr-1.5 py-1 rounded-lg transition-colors shrink-0 font-medium cursor-pointer"
                  >
                    <span className="truncate max-w-44">{opt.label}</span>
                    <button
                      type="button"
                      onClick={(e) => stagePromptForEdit(e, opt.prompt)}
                      title="Stage option for editing"
                      className="p-0.5 rounded text-theme-muted hover:text-theme-text hover:bg-theme-bg/60 transition shrink-0 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
          </div>

          {activeTab === "dynamic" && hasDynamicPrompts && (
            <button
              type="button"
              onClick={() => scrollCarousel("right")}
              aria-label="Scroll prompts right"
              className="absolute right-0 z-10 h-6 w-6 flex items-center justify-center bg-theme-bg/95 border border-theme-border/50 text-theme-muted hover:text-theme-text rounded-md backdrop-blur-xs cursor-pointer"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
