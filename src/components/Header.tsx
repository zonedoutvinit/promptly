// src/components/Header.tsx
import React from "react";
import { Menu, Zap, ChevronDown, Cpu } from "lucide-react";
import { useChatStore, ProviderType } from "../store";

interface HeaderProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  model: string;
  availableModels: string[];
  onModelChange: (model: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
}) => {
  // 🔄 Hook into your real-time multi-provider orchestration architecture
  const { settings, setProvider, model, availableModels, setModel } =
    useChatStore();

  const currentProvider = settings.currentProvider;

  // Pretty print labels for your configuration selection mapping
  const providerLabels: Record<ProviderType, string> = {
    ollama: "Ollama",
    "lm-studio": "LM Studio",
    "openai-compatible": "OpenAI API",
    gemini: "Google Gemini",
  };

  return (
    <header className="flex h-15.5 items-center justify-between border-b border-theme-border px-6 py-4 bg-theme-bg/50 backdrop-blur shrink-0 select-none transition-colors duration-200">
      {/* Left Section: Sidebar Toggle & Branding */}
      <div className="flex items-center gap-4">
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-theme-text/70 hover:text-theme-text p-1.5 bg-theme-panel border border-theme-border rounded-lg transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-sm"
            title="Expand History Sidebar"
          >
            <Menu className="w-4 h-4 stroke-2" />
          </button>
        )}
        <div className="flex items-center gap-1.5 font-bold tracking-tight text-theme-accent">
          <Zap className="w-4 h-4 fill-theme-accent/10 stroke-[2.5]" />
          <span className="text-xl">Promptly</span>
        </div>
      </div>

      {/* Right Section: Multi-Provider & Model Selector Pipeline Dropdowns */}
      <div className="flex items-center gap-3">
        {/* ⚙️ Step 1: Provider Selection Dropdown */}
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[9px] uppercase font-bold tracking-widest text-theme-muted/70 mr-1">
            Engine
          </span>
          <div className="relative flex items-center">
            <select
              value={currentProvider}
              onChange={(e) => setProvider(e.target.value as ProviderType)}
              className="appearance-none rounded-xl border border-theme-border bg-theme-panel/60 pl-3 pr-8 py-1 text-xs text-theme-text outline-none focus:border-theme-accent/40 focus:bg-theme-panel transition-all cursor-pointer font-medium tracking-tight shadow-xs"
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
            <Cpu className="w-3 h-3 text-theme-text/40 pointer-events-none absolute right-2.5 stroke-2" />
          </div>
        </div>

        {/* 🤖 Step 2: Model Target Selection Dropdown */}
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[9px] uppercase font-bold tracking-widest text-theme-muted/70 mr-1">
            Model
          </span>
          <div className="relative flex items-center">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={availableModels.length === 0}
              className="appearance-none rounded-xl border border-theme-border bg-theme-panel/60 pl-3 pr-8 py-1 text-xs text-theme-accent outline-none focus:border-theme-accent/40 focus:bg-theme-panel transition-all cursor-pointer font-medium font-mono tracking-tight shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
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
            <ChevronDown className="w-3 h-3 text-theme-accent/60 pointer-events-none absolute right-2.5 stroke-[2.5]" />
          </div>
        </div>
      </div>
    </header>
  );
};
