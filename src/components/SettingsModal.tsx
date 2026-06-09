// src/components/SettingsModal.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useChatStore, EngineSettings } from "../store";
import { Cpu, Palette, X } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = "engine" | "appearance";

interface ThemeItem {
  id: string;
  label: string;
  bg: string;
  panel: string;
  border: string;
  text: string;
  accent: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { settings, updateSettings, theme, setTheme } = useChatStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>("engine");

  // Local Scratchpad States (Changes only commit to global store on Submit)
  const [localTheme, setLocalTheme] = useState<string>(theme);
  const [provider, setProvider] =
    useState<EngineSettings["provider"]>("ollama");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Sync store settings to local scratchpad whenever modal mounts open
  useEffect(() => {
    if (isOpen) {
      setLocalTheme(theme);
      setProvider(settings.provider);
      setBaseUrl(settings.baseUrl);
      setApiKey("");
    }
  }, [isOpen, settings, theme]);

  // Static Matrix Array Dataset Memoized for Performance
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

  if (!isOpen) return null;

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value as EngineSettings["provider"];
    setProvider(selected);
    if (selected === "ollama") setBaseUrl("http://localhost:11434");
    else if (selected === "lm-studio") setBaseUrl("http://localhost:1234");
  };

  // Global Transaction Commit Handler
  const handleCommitSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // 1. Commit theme change downstream to context DOM node handles
      setTheme(localTheme);
      document.documentElement.setAttribute("data-theme", localTheme);

      // 2. Commit engine parameters to hardware configuration streams
      await updateSettings(
        { baseUrl: baseUrl.trim(), provider },
        apiKey.trim() || undefined,
      );

      onClose();
    } catch (err) {
      alert("Error processing security encryption tokens.");
    } finally {
      setIsSaving(false);
    }
  };

  // Reusable card component for grid render loops
  const renderThemeButton = (t: ThemeItem, isDarkSection: boolean) => {
    const isSelected = localTheme === t.id;
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => setLocalTheme(t.id)} // Writes to local scratchpad only!
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
            className={`w-2.5 h-2.5 rounded-xs border ${isDarkSection ? "border-white/10" : "border-black/10"}`}
            style={{ backgroundColor: t.bg }}
          />
          <span
            className={`w-2.5 h-2.5 rounded-xs border ${isDarkSection ? "border-white/10" : "border-black/10"}`}
            style={{ backgroundColor: t.panel }}
          />
          <span
            className={`w-2.5 h-2.5 rounded-xs border ${isDarkSection ? "border-white/10" : "border-black/10"}`}
            style={{ backgroundColor: t.border }}
          />
          <span
            className={`w-2.5 h-2.5 rounded-xs border ${isDarkSection ? "border-white/10" : "border-black/10"}`}
            style={{ backgroundColor: t.text }}
          />
          <span
            className={`w-2.5 h-2.5 rounded-xs border ${isDarkSection ? "border-white/10" : "border-black/10"}`}
            style={{ backgroundColor: t.accent }}
          />
        </div>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in select-none">
      <div className="bg-theme-bg border border-theme-border rounded-xl w-full max-w-3xl h-140 shadow-2xl flex overflow-hidden animate-messageSlide text-sm transition-colors duration-200">
        {/* ================= MODAL SIDEBAR PANEL ================= */}
        <aside className="w-48 bg-theme-panel/40 border-r border-theme-border p-4 flex flex-col justify-between shrink-0">
          <div className="space-y-4">
            <div className="px-2 py-1">
              <h3 className="text-theme-muted font-bold tracking-wider text-[11px] uppercase">
                Configuration
              </h3>
            </div>
            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => setActiveTab("engine")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-all cursor-pointer text-xs ${
                  activeTab === "engine"
                    ? "bg-theme-panel text-theme-accent border border-theme-border/80 shadow-xs"
                    : "text-theme-muted hover:bg-theme-panel/40 hover:text-theme-text"
                }`}
              >
                <Cpu className="w-4 h-4 stroke-2" />
                <span>Model Engine</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("appearance")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-all cursor-pointer text-xs ${
                  activeTab === "appearance"
                    ? "bg-theme-panel text-theme-accent border border-theme-border/80 shadow-xs"
                    : "text-theme-muted hover:bg-theme-panel/40 hover:text-theme-text"
                }`}
              >
                <Palette className="w-4 h-4 stroke-2" />
                <span>Appearance</span>
              </button>
            </nav>
          </div>
          <div className="px-2 text-[10px] text-theme-muted/70 font-mono tracking-tight">
            V1.0.0 Node Connected
          </div>
        </aside>

        {/* ================= MODAL MAIN CONTENT WORKSPACE ================= */}
        <form
          onSubmit={handleCommitSettings}
          className="flex-1 flex flex-col h-full overflow-hidden bg-theme-bg"
        >
          <div className="p-4 border-b border-theme-border flex justify-between items-center bg-theme-bg shrink-0">
            <h4 className="text-theme-text font-semibold tracking-wide capitalize">
              {activeTab === "engine"
                ? "Inference Coordination"
                : "Theme Engine Workspace"}
            </h4>
            <button
              type="button"
              onClick={onClose}
              className="text-theme-muted hover:text-theme-text p-1 hover:bg-theme-panel rounded-md transition-colors cursor-pointer flex items-center justify-center"
            >
              <X className="w-4 h-4 stroke-2" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {/* TAB 1: MODEL ENGINE SETTINGS */}
            {activeTab === "engine" && (
              <div className="space-y-4 animate-chipFade">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">
                    Engine Provider
                  </label>
                  <select
                    value={provider}
                    onChange={handleProviderChange}
                    className="w-full bg-theme-panel border border-theme-border rounded-lg p-2.5 text-theme-text focus:outline-none focus:border-theme-accent/60 text-xs font-mono cursor-pointer"
                  >
                    <option
                      value="ollama"
                      className="bg-theme-bg text-theme-text"
                    >
                      Ollama (Default)
                    </option>
                    <option
                      value="lm-studio"
                      className="bg-theme-bg text-theme-text"
                    >
                      LM Studio
                    </option>
                    <option
                      value="openai-compatible"
                      className="bg-theme-bg text-theme-text"
                    >
                      OpenAI Compatible Gateway
                    </option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">
                    Server Endpoint Connection
                  </label>
                  <input
                    type="url"
                    required
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="e.g. http://localhost:11434"
                    className="w-full bg-theme-panel border border-theme-border rounded-lg p-2.5 text-theme-text focus:outline-none focus:border-theme-accent/60 text-xs font-mono"
                  />
                </div>

                {provider !== "ollama" && (
                  <div className="space-y-1.5 animate-chipFade">
                    <label className="text-[11px] font-bold text-theme-muted uppercase tracking-wider flex items-center gap-1.5">
                      <span>API Bearer Secret Token</span>
                      <span className="text-[9px] text-theme-accent font-normal normal-case font-mono">
                        (client-encrypted)
                      </span>
                    </label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={
                        settings.encryptedApiKey
                          ? "•••••••••••••••• (Saved encrypted)"
                          : "Enter secret key passcode"
                      }
                      className="w-full bg-theme-panel border border-theme-border rounded-lg p-2.5 text-theme-text focus:outline-none focus:border-theme-accent/60 text-xs font-mono placeholder:text-theme-muted"
                    />
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: APPEARANCE & THEMES */}
            {activeTab === "appearance" && (
              <div className="space-y-4 h-full flex flex-col overflow-hidden animate-chipFade">
                <div className="shrink-0">
                  <label className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">
                    Core Color Interface Style
                  </label>
                  <p className="text-xs text-theme-muted mb-3">
                    Select an active canvas design matrix. Layout sets distinct
                    balance definitions live upon commit.
                  </p>
                </div>

                {/* 🌟 OPTIMIZED GAP CONTAINER: Switched to pr-4 to create separation from scrollbar knob */}
                <div className="flex-1 overflow-y-auto pr-4 space-y-5 max-h-80">
                  {/* DARK VARIANTS */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-theme-muted/80 uppercase tracking-widest pl-1">
                      Dark Configurations (8)
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {darkThemes.map((t) => renderThemeButton(t, true))}
                    </div>
                  </div>

                  {/* LIGHT VARIANTS */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-theme-muted/80 uppercase tracking-widest pl-1">
                      Light Configurations (8)
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {lightThemes.map((t) => renderThemeButton(t, false))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Persistent Form Commit Dock */}
          <div className="p-4 border-t border-theme-border bg-theme-panel/10 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-theme-panel hover:bg-theme-panel/80 text-theme-text border border-theme-border rounded-lg transition-colors cursor-pointer text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 bg-theme-accent hover:bg-theme-accent-hover text-theme-bg rounded-lg transition-colors cursor-pointer font-medium text-xs disabled:opacity-50"
            >
              {isSaving ? "Encrypting..." : "Commit Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
