// src/components/PromptOptions.tsx
import React, { useState, useRef } from "react";
import { genericOptions } from "../utils/chatHelpers";
import { ChevronLeft, ChevronRight, Edit3 } from "lucide-react";

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

  // 1️⃣ Hardware-Accelerated Programmatic Smooth Scroll Loop
  const scrollCarousel = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollAmount = 240;
    const startPosition = container.scrollLeft;
    const targetPosition =
      direction === "left"
        ? startPosition - scrollAmount
        : startPosition + scrollAmount;

    const duration = 250; // Animation timing in milliseconds
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

  // 2️⃣ Edit Action Interceptor Pipeline
  const handleEditOption = (e: React.MouseEvent, promptText: string) => {
    e.stopPropagation(); // Stop the button's parent bubble click from firing onSubmit

    // Locate target textarea via shared layout node hierarchy
    const footerElement = document.querySelector("footer");
    const textarea = footerElement?.querySelector("textarea");

    if (textarea) {
      // Find the React state setter by walking up to the DOM instance property tracker
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
    <div className="flex flex-col gap-2 transition-colors duration-200 select-none">
      {/* Control Bar Header */}
      <div className="flex items-center justify-between border-b border-theme-border/50 pb-1.5">
        {hasDynamicPrompts ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("dynamic")}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === "dynamic"
                  ? "bg-theme-accent/10 text-theme-accent border border-theme-accent/30"
                  : "text-theme-muted hover:text-theme-text"
              }`}
            >
              Suggested Paths
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("generic")}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === "generic"
                  ? "bg-theme-panel text-theme-text border border-theme-border"
                  : "text-theme-muted hover:text-theme-text"
              }`}
            >
              Structural Paths
            </button>
          </div>
        ) : (
          <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider px-1 py-1">
            Structural Prompt Toolkit
          </span>
        )}

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-theme-muted hover:text-theme-text p-1 hover:bg-theme-panel rounded-md transition-all flex items-center justify-center cursor-pointer"
          title={isExpanded ? "Collapse tray" : "Expand tray"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-3.5 h-3.5 transform transition-transform duration-200 ${
              isExpanded ? "" : "-rotate-180"
            }`}
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* ================= HORIZONTAL CAROUSEL TRAY DOCK ================= */}
      {isExpanded && (
        <div className="relative w-full overflow-hidden group/carousel flex items-center">
          {/* Left Arrow Controller */}
          {activeTab === "dynamic" && dynamicSuggestedPrompts.length > 0 && (
            <button
              type="button"
              onClick={() => scrollCarousel("left")}
              className="absolute left-0 z-10 p-1 bg-theme-bg/90 border border-theme-border/40 text-theme-muted hover:text-theme-text rounded-md opacity-70 hover:opacity-100 transition-all cursor-pointer backdrop-blur-sm shadow-md"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Swipe Container Track */}
          <div
            ref={scrollContainerRef}
            className={`flex flex-row flex-nowrap gap-2 items-center overflow-x-auto pb-1.5 pt-0.5 scrollbar-none scroll-smooth w-full ${activeTab === "generic" ? "px-3" : "px-6"}`}
          >
            {activeTab === "dynamic" && hasDynamicPrompts
              ? dynamicSuggestedPrompts.map((promptText, i) => (
                  <div
                    key={`dynamic-${i}`}
                    onClick={() => onSubmit(promptText)}
                    className="flex items-center gap-1.5 text-xs bg-theme-accent/5 hover:bg-theme-accent/10 text-theme-accent border border-theme-accent/20 pl-3 pr-2 py-1.5 rounded-xl transition-all shrink-0 max-w-65 font-mono cursor-pointer active:scale-95 group/chip animate-chipFade"
                  >
                    <span className="truncate">"{promptText}"</span>
                    {/* Inline micro-edit mechanism */}
                    <button
                      type="button"
                      onClick={(e) => handleEditOption(e, promptText)}
                      title="Edit option structure"
                      className="p-1 rounded-md text-theme-accent/60 hover:text-theme-accent hover:bg-theme-accent/10 transition shrink-0 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              : genericOptions.map((opt, i) => (
                  <div
                    key={`generic-${i}`}
                    onClick={() => onSubmit(opt.prompt)}
                    className="flex items-center gap-1.5 text-xs bg-theme-panel hover:bg-theme-panel/80 text-theme-text/80 hover:text-theme-text border border-theme-border pl-3 pr-2 py-1.5 rounded-xl transition-all shrink-0 font-medium cursor-pointer active:scale-95 group/chip animate-chipFade"
                  >
                    <span>{opt.label}</span>
                    {/* Inline micro-edit mechanism */}
                    <button
                      type="button"
                      onClick={(e) => handleEditOption(e, opt.prompt)}
                      title="Stage option for editing"
                      className="p-1 rounded-md text-theme-muted hover:text-theme-text hover:bg-black/20 transition shrink-0 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
          </div>

          {/* Right Arrow Controller */}
          {activeTab === "dynamic" && dynamicSuggestedPrompts.length > 0 && (
            <button
              type="button"
              onClick={() => scrollCarousel("right")}
              className="absolute right-0 z-10 p-1 bg-theme-bg/90 border border-theme-border/40 text-theme-muted hover:text-theme-text rounded-md opacity-70 hover:opacity-100 transition-all cursor-pointer backdrop-blur-sm shadow-md"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Fade mask for smooth clipping visual feedback */}
          <div className="absolute top-0 right-0 h-full w-6 bg-linear-to-l from-theme-bg to-transparent pointer-events-none" />
          <div className="absolute top-0 left-0 h-full w-6 bg-linear-to-r from-theme-bg to-transparent pointer-events-none" />
        </div>
      )}
    </div>
  );
};
