// src/components/PromptOptions.tsx
import React, { useState } from "react";
import { genericOptions } from "../utils/chatHelpers";

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
  const hasDynamicPrompts = dynamicSuggestedPrompts.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Control Bar Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
        {hasDynamicPrompts ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("dynamic")}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition ${
                activeTab === "dynamic"
                  ? "bg-indigo-950 text-indigo-400 border border-indigo-900/40"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Suggested Paths
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("generic")}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition ${
                activeTab === "generic"
                  ? "bg-zinc-900 text-zinc-300 border border-zinc-800"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Structural Paths
            </button>
          </div>
        ) : (
          <span className="text-xs font-semibold text-zinc-500 px-1 py-1.5">
            🛠️ Structural Prompt Toolkit
          </span>
        )}

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-zinc-500 hover:text-zinc-300 p-1.5 hover:bg-zinc-900 rounded-md transition flex items-center justify-center"
          title={isExpanded ? "Collapse panel" : "Expand panel"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-4 h-4 transform transition-transform duration-200 ${
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

      {/* Content Tray Section with Stagger-friendly Entry */}
      {isExpanded && (
        <div className="flex flex-wrap gap-2 items-center min-h-9.5">
          {activeTab === "dynamic" && hasDynamicPrompts
            ? dynamicSuggestedPrompts.map((promptText, i) => (
                <button
                  key={`dynamic-${i}`}
                  type="button"
                  onClick={() => onSubmit(promptText)}
                  className="text-xs bg-indigo-950/30 hover:bg-indigo-900/50 text-indigo-300 border border-indigo-900/40 px-3 py-2 rounded-lg transition text-left truncate max-w-xs animate-chipFade"
                >
                  "{promptText}"
                </button>
              ))
            : genericOptions.map((opt, i) => (
                <button
                  key={`generic-${i}`}
                  type="button"
                  onClick={() => onSubmit(opt.prompt)}
                  className="text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 px-3 py-2 rounded-lg transition animate-chipFade"
                >
                  {opt.label}
                </button>
              ))}
        </div>
      )}
    </div>
  );
};
