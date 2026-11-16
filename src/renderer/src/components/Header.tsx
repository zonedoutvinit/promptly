// src/components/Header.tsx
import React from "react";
import { Menu, Zap } from "lucide-react";

interface HeaderProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
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
    </header>
  );
};
