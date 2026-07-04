// src/components/settings/AppearanceTab.tsx
import React, { useMemo } from "react";

interface ThemeItem {
  id: string;
  label: string;
  bg: string;
  panel: string;
  border: string;
  text: string;
  accent: string;
}

interface AppearanceTabProps {
  localTheme: string;
  onThemeSelect: (id: string) => void;
}

export const AppearanceTab: React.FC<AppearanceTabProps> = ({
  localTheme,
  onThemeSelect,
}) => {
  const darkThemes = useMemo<ThemeItem[]>(
    () => [
      {
        id: "zinc-dark",
        label: "Zinc Dark",
        bg: "#09090b",
        panel: "#141417",
        border: "#27272a",
        text: "#f4f4f5",
        accent: "#6366f1",
      },
      {
        id: "cyber-amber",
        label: "Cyberpunk Amber",
        bg: "#080500",
        panel: "#160f02",
        border: "#332204",
        text: "#e6a100",
        accent: "#ffb700",
      },
      {
        id: "archive-retro",
        label: "Archive Retro",
        bg: "#030704",
        panel: "#0b140d",
        border: "#1a301f",
        text: "#2bd115",
        accent: "#5eff40",
      },
      {
        id: "slate-cold",
        label: "Slate Cold",
        bg: "#0b0f19",
        panel: "#171e2e",
        border: "#293548",
        text: "#f1f5f9",
        accent: "#0ea5e9",
      },
      {
        id: "nordic-frost",
        label: "Nordic Frost",
        bg: "#1e222a",
        panel: "#242933",
        border: "#3b4252",
        text: "#eceff4",
        accent: "#88c0d0",
      },
      {
        id: "tokyo-midnight",
        label: "Tokyo Midnight",
        bg: "#0b0813",
        panel: "#131020",
        border: "#26203d",
        text: "#f0f0f5",
        accent: "#00f0ff",
      },
      {
        id: "dracula-eclipse",
        label: "Dracula Eclipse",
        bg: "#1a1625",
        panel: "#221c30",
        border: "#362b4c",
        text: "#f8f8f2",
        accent: "#bd93f9",
      },
      {
        id: "retro-commando",
        label: "Retro Commando",
        bg: "#1a1b15",
        panel: "#24261e",
        border: "#383b2e",
        text: "#f0ebd8",
        accent: "#a3b18a",
      },
    ],
    [],
  );

  const lightThemes = useMemo<ThemeItem[]>(
    () => [
      {
        id: "paperback-minimal",
        label: "Paperback Minimal",
        bg: "#fbfaf5",
        panel: "#f3efe3",
        border: "#e3dcaf",
        text: "#2c2a29",
        accent: "#b1563a",
      },
      {
        id: "silicon-alabaster",
        label: "Silicon Alabaster",
        bg: "#f8fafc",
        panel: "#ffffff",
        border: "#e2e8f0",
        text: "#0f172a",
        accent: "#4f46e5",
      },
      {
        id: "nordic-snow",
        label: "Nordic Snow",
        bg: "#e5e9f0",
        panel: "#eceff4",
        border: "#d8dee9",
        text: "#2e3440",
        accent: "#5e81ac",
      },
      {
        id: "cyber-mint",
        label: "Cybermint Light",
        bg: "#f0fdf4",
        panel: "#ffffff",
        border: "#bbf7d0",
        text: "#166534",
        accent: "#16a34a",
      },
      {
        id: "sakura-blossom",
        label: "Sakura Blossom",
        bg: "#fff5f5",
        panel: "#ffe3e3",
        border: "#ffb8b8",
        text: "#c92a2a",
        accent: "#e64980",
      },
      {
        id: "corporate-teal",
        label: "Corporate Teal",
        bg: "#f0f7f7",
        panel: "#ffffff",
        border: "#cce3e3",
        text: "#0f3434",
        accent: "#008080",
      },
      {
        id: "vintage-canary",
        label: "Vintage Canary",
        bg: "#fffbeb",
        panel: "#fef3c7",
        border: "#fde68a",
        text: "#78350f",
        accent: "#d97706",
      },
      {
        id: "slate-light",
        label: "Slate Tech Light",
        bg: "#f1f5f9",
        panel: "#e2e8f0",
        border: "#cbd5e1",
        text: "#1e293b",
        accent: "#2563eb",
      },
    ],
    [],
  );

  const renderThemeButton = (t: ThemeItem, isDarkSection: boolean) => {
    const isSelected = localTheme === t.id;
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => onThemeSelect(t.id)}
        className={`p-2.5 border rounded-xl cursor-pointer transition-all flex items-center justify-between text-left active:scale-[0.98] ${
          isSelected
            ? "bg-theme-panel border-theme-accent text-theme-accent shadow-xs"
            : "bg-theme-panel/40 border-theme-border/60 text-theme-muted hover:border-theme-border hover:text-theme-text"
        }`}
      >
        <span
          className={`font-semibold text-xs tracking-wide ${isSelected ? "text-theme-accent" : "text-theme-text/90"}`}
        >
          {t.label}
        </span>
        <div
          className={`flex items-center gap-1 p-1 rounded-md border border-zinc-500/10 ${isDarkSection ? "bg-black/20" : "bg-black/5"}`}
        >
          <span
            className="w-2.5 h-2.5 rounded-xs border border-white/10"
            style={{ backgroundColor: t.bg }}
          />
          <span
            className="w-2.5 h-2.5 rounded-xs border border-white/10"
            style={{ backgroundColor: t.panel }}
          />
          <span
            className="w-2.5 h-2.5 rounded-xs border border-white/10"
            style={{ backgroundColor: t.border }}
          />
          <span
            className="w-2.5 h-2.5 rounded-xs border border-white/10"
            style={{ backgroundColor: t.text }}
          />
          <span
            className="w-2.5 h-2.5 rounded-xs border border-white/10"
            style={{ backgroundColor: t.accent }}
          />
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-4 h-full flex flex-col overflow-hidden animate-chipFade">
      <div className="shrink-0">
        <label className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">
          Core Color Interface Style
        </label>
        <p className="text-xs text-theme-muted mb-3">
          Select an active canvas design matrix. Layout sets distinct balance
          definitions live upon commit.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto pr-4 space-y-5 max-h-80">
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-theme-muted/80 uppercase tracking-widest pl-1">
            Dark Configurations ({darkThemes.length})
          </div>
          <div className="grid grid-cols-2 gap-2">
            {darkThemes.map((t) => renderThemeButton(t, true))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[10px] font-bold text-theme-muted/80 uppercase tracking-widest pl-1">
            Light Configurations ({lightThemes.length})
          </div>
          <div className="grid grid-cols-2 gap-2">
            {lightThemes.map((t) => renderThemeButton(t, false))}
          </div>
        </div>
      </div>
    </div>
  );
};
