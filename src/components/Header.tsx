// src/components/Header.tsx
import React from "react";
import { Menu, Zap, ChevronDown } from "lucide-react";

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
  model,
  availableModels,
  onModelChange,
}) => {
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

      {/* Right Section: Model Selector with Label */}
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-[9px] uppercase font-bold tracking-widest text-theme-muted/70 mr-1">
          Select Model
        </span>
        <div className="relative flex items-center">
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="appearance-none rounded-xl border border-theme-border bg-theme-panel/60 pl-3 pr-8 py-1 text-xs text-theme-accent outline-none focus:border-theme-accent/40 focus:bg-theme-panel transition-all cursor-pointer font-medium font-mono tracking-tight shadow-xs"
          >
            {availableModels.map((m) => (
              <option
                key={m}
                value={m}
                className="bg-theme-bg text-theme-text font-mono text-xs"
              >
                {m}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 text-theme-accent/60 pointer-events-none absolute right-2.5 stroke-[2.5]" />
        </div>
      </div>
    </header>
  );
};
