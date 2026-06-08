import React from "react";

interface HeaderProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  model: string;
}

export const Header: React.FC<HeaderProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
  model,
}) => {
  return (
    <header className="flex items-center justify-between border-b border-zinc-900 px-6 py-4 bg-zinc-950/50 backdrop-blur shrink-0">
      <div className="flex items-center gap-4">
        {/* Sidebar Expand Menu Toggle Button */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-zinc-400 hover:text-zinc-200 p-1.5 bg-zinc-900 border border-zinc-800 rounded-md transition flex items-center justify-center"
            title="Expand History Sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5"
              />
            </svg>
          </button>
        )}

        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-tight text-indigo-400">
            ⚡ Promptly
          </span>
          {model && (
            <span className="rounded-lg bg-indigo-950/40 px-2 py-0.5 text-xs text-indigo-300 border border-indigo-900/30 font-medium">
              {model}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="rounded bg-zinc-900 px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider text-zinc-500 border border-zinc-800">
          Direct Hardware Stream
        </span>
      </div>
    </header>
  );
};
