import React from "react";

interface HeaderProps {
  model: string;
  setModel: (model: string) => void;
  availableModels: string[];
  clearHistory: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  model,
  setModel,
  availableModels,
  clearHistory,
}) => {
  return (
    <header className="flex items-center justify-between border-b border-zinc-900 px-6 py-4 bg-zinc-950/50 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="text-xl font-bold tracking-tight text-indigo-400">
          ⚡ Promptly
        </span>
        <span className="rounded bg-zinc-900 px-2 py-0.5 text-xs text-zinc-500 border border-zinc-800">
          Local Blueprint
        </span>
      </div>
      <div className="flex items-center gap-4">
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-indigo-500 transition cursor-pointer"
        >
          {availableModels.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
          {availableModels.length === 0 && <option>Scanning System...</option>}
        </select>
        <button
          onClick={clearHistory}
          className="text-sm text-zinc-500 hover:text-zinc-300 transition"
        >
          Clear Thread
        </button>
      </div>
    </header>
  );
};
