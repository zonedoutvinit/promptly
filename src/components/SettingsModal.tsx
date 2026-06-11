// src/components/SettingsModal.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useChatStore, ProviderType, SystemProfile } from "../store";
import {
  Cpu,
  Palette,
  Users,
  X,
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  PenTool,
  Code,
  BrainCircuit,
  Terminal,
  Check,
} from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = "engine" | "appearance" | "personas";

interface ThemeItem {
  id: string;
  label: string;
  bg: string;
  panel: string;
  border: string;
  text: string;
  accent: string;
}

const IconMap: Record<string, React.ComponentType<any>> = {
  Sparkles,
  PenTool,
  Code,
  BrainCircuit,
  Terminal,
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    settings,
    updateProviderConfig, // 🔄 Hooked into updated multi-provider method
    theme,
    setTheme,
    customPersonas,
    addPersona,
    updatePersona,
    deletePersona,
  } = useChatStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>("engine");

  // Local Scratchpad States
  const [localTheme, setLocalTheme] = useState<string>(theme);
  const [provider, setProvider] = useState<ProviderType>("ollama");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // 🎭 Profile Management Core Editor State Scratchpads
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(
    null,
  );
  const [personaLabel, setPersonaLabel] = useState("");
  const [personaIcon, setPersonaIcon] = useState("Terminal");
  const [personaPrompt, setPersonaPrompt] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Sync store settings to local scratchpad whenever modal mounts open
  useEffect(() => {
    if (isOpen) {
      setLocalTheme(theme);

      // Pull current focus state from dictionary definitions safely
      const activeProvider = settings.currentProvider;
      const providerConfig = settings.providers[activeProvider];

      setProvider(activeProvider);
      setBaseUrl(providerConfig?.baseUrl || "");
      setApiKey(""); // Keep input field visually empty for custom modifications

      if (customPersonas.length > 0 && !selectedPersonaId) {
        loadPersonaIntoEditor(customPersonas[0]);
      }
    }
  }, [isOpen, settings, theme, customPersonas]);

  const loadPersonaIntoEditor = (p: SystemProfile) => {
    setSelectedPersonaId(p.id);
    setPersonaLabel(p.label);
    setPersonaIcon(p.icon);
    setPersonaPrompt(p.prompt);
    setIsCreatingNew(false);
  };

  const initNewPersonaForm = () => {
    setSelectedPersonaId(null);
    setPersonaLabel("");
    setPersonaIcon("Terminal");
    setPersonaPrompt("");
    setIsCreatingNew(true);
  };

  const handleSavePersonaRow = () => {
    if (!personaLabel.trim() || !personaPrompt.trim()) return;

    if (isCreatingNew) {
      addPersona({
        label: personaLabel.trim(),
        icon: personaIcon,
        prompt: personaPrompt.trim(),
      });
      setIsCreatingNew(false);
    } else if (selectedPersonaId) {
      updatePersona(selectedPersonaId, {
        label: personaLabel.trim(),
        icon: personaIcon,
        prompt: personaPrompt.trim(),
      });
    }
  };

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
    const selected = e.target.value as ProviderType;
    setProvider(selected);

    // Pull configurations dynamically from our distinct state maps
    const existingConfig = settings.providers[selected];
    if (existingConfig?.baseUrl) {
      setBaseUrl(existingConfig.baseUrl);
    } else {
      if (selected === "ollama") setBaseUrl("http://localhost:11434");
      else if (selected === "lm-studio") setBaseUrl("http://localhost:1234");
      else setBaseUrl("");
    }
  };

  const handleCommitSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      setTheme(localTheme);
      document.documentElement.setAttribute("data-theme", localTheme);

      // 🛡️ Executing the precise configuration routing logic for your updated store
      await updateProviderConfig(
        provider,
        { baseUrl: baseUrl.trim() },
        apiKey.trim() || undefined,
      );

      // Force-sync global setting provider value if they altered it directly here
      if (settings.currentProvider !== provider) {
        // This ensures the header updates instantly if edited via modal parameters
        useChatStore.getState().setProvider(provider);
      }

      onClose();
    } catch (err) {
      console.error(err);
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
        onClick={() => setLocalTheme(t.id)}
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
      <div className="bg-theme-bg border border-theme-border rounded-xl w-full max-w-4xl h-145 shadow-2xl flex overflow-hidden animate-messageSlide text-sm transition-colors duration-200">
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
                onClick={() => setActiveTab("personas")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-all cursor-pointer text-xs ${
                  activeTab === "personas"
                    ? "bg-theme-panel text-theme-accent border border-theme-border/80 shadow-xs"
                    : "text-theme-muted hover:bg-theme-panel/40 hover:text-theme-text"
                }`}
              >
                <Users className="w-4 h-4 stroke-2" />
                <span>System Personas</span>
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
            V1.1.0 Hub Active
          </div>
        </aside>

        {/* ================= MODAL MAIN CONTENT WORKSPACE ================= */}
        <form
          onSubmit={handleCommitSettings}
          className="flex-1 flex flex-col h-full overflow-hidden bg-theme-bg"
        >
          <div className="p-4 border-b border-theme-border flex justify-between items-center bg-theme-bg shrink-0">
            <h4 className="text-theme-text font-semibold tracking-wide capitalize">
              {activeTab === "engine" && "Inference Coordination"}
              {activeTab === "appearance" && "Theme Engine Workspace"}
              {activeTab === "personas" && "Persona Architecture Studio"}
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
                    <option
                      value="gemini"
                      className="bg-theme-bg text-theme-text"
                    >
                      Google Gemini AI
                    </option>
                  </select>
                </div>

                {provider !== "gemini" && (
                  <div className="space-y-1.5 animate-chipFade">
                    <label className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">
                      Server Endpoint Connection
                    </label>
                    <input
                      type="url"
                      required={true}
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="e.g. http://localhost:11434"
                      className="w-full bg-theme-panel border border-theme-border rounded-lg p-2.5 text-theme-text focus:outline-none focus:border-theme-accent/60 text-xs font-mono"
                    />
                  </div>
                )}

                {provider !== "ollama" && (
                  <div className="space-y-1.5 animate-chipFade">
                    <label className="text-[11px] font-bold text-theme-muted uppercase tracking-wider flex items-center gap-1.5">
                      <span>API Bearer Secret Token</span>
                      <span className="text-[9px] text-theme-accent font-normal normal-case font-mono">
                        {provider === "gemini"
                          ? "(Direct Cloud Secret Required)"
                          : "(client-encrypted)"}
                      </span>
                    </label>
                    <input
                      type="password"
                      required={
                        provider === "gemini" &&
                        !settings.providers.gemini?.encryptedApiKey
                      }
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={
                        settings.providers[provider]?.encryptedApiKey
                          ? "•••••••••••••••• (Saved encrypted)"
                          : "Enter secret API passcode"
                      }
                      className="w-full bg-theme-panel border border-theme-border rounded-lg p-2.5 text-theme-text focus:outline-none focus:border-theme-accent/60 text-xs font-mono placeholder:text-theme-muted"
                    />
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: SYSTEM PERSONAS MANAGEMENT */}
            {activeTab === "personas" && (
              <div className="grid grid-cols-5 gap-4 h-full min-h-100 animate-chipFade">
                <div className="col-span-2 flex flex-col border border-theme-border/60 rounded-xl bg-theme-panel/20 overflow-hidden">
                  <div className="p-2 border-b border-theme-border/60 bg-theme-panel/40 flex items-center justify-between shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">
                      Active Catalogs
                    </span>
                    <button
                      type="button"
                      onClick={initNewPersonaForm}
                      className="p-1 rounded-md bg-theme-accent text-theme-bg hover:bg-theme-accent-hover transition cursor-pointer"
                    >
                      <Plus className="w-3 h-3 stroke-3" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                    {customPersonas.map((p) => {
                      const ItemIcon = IconMap[p.icon] || Terminal;
                      const isSelected =
                        selectedPersonaId === p.id && !isCreatingNew;
                      return (
                        <div
                          key={p.id}
                          onClick={() => loadPersonaIntoEditor(p)}
                          className={`group w-full flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                            isSelected
                              ? "bg-theme-panel text-theme-accent border border-theme-border"
                              : "text-theme-text hover:bg-theme-panel/40"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <ItemIcon
                              className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-theme-accent" : "text-theme-muted"}`}
                            />
                            <span className="text-xs font-medium truncate">
                              {p.label}
                            </span>
                          </div>

                          {!p.isSystemDefault && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deletePersona(p.id);
                                if (selectedPersonaId === p.id) {
                                  setSelectedPersonaId(
                                    customPersonas[0]?.id || null,
                                  );
                                }
                              }}
                              className="text-theme-muted hover:text-red-400 p-1 rounded transition shrink-0 cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 animate-fade-in"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="col-span-3 flex flex-col space-y-3 bg-theme-panel/10 p-3 rounded-xl border border-theme-border/40">
                  <div className="flex items-center gap-1.5 text-xs text-theme-muted font-bold uppercase tracking-wide border-b border-theme-border/40 pb-1.5">
                    <Edit2 className="w-3.5 h-3.5 text-theme-accent" />
                    <span>
                      {isCreatingNew
                        ? "Construct Custom Starter"
                        : "Modify Blueprint Config"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-theme-muted uppercase tracking-wider">
                      Display Label Name
                    </label>
                    <input
                      type="text"
                      disabled={
                        customPersonas.find((p) => p.id === selectedPersonaId)
                          ?.isSystemDefault && !isCreatingNew
                      }
                      value={personaLabel}
                      onChange={(e) => setPersonaLabel(e.target.value)}
                      placeholder="e.g. Legal Contract Reviewer"
                      className="w-full bg-theme-panel border border-theme-border rounded-lg p-2 text-xs font-medium text-theme-text focus:outline-none focus:border-theme-accent/60 disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-theme-muted uppercase tracking-wider">
                      Visual Interface Icon Archetype
                    </label>
                    <div className="grid grid-cols-5 gap-1">
                      {Object.keys(IconMap).map((iconKey) => {
                        const IconChoice = IconMap[iconKey];
                        const isChosen = personaIcon === iconKey;
                        return (
                          <button
                            key={iconKey}
                            type="button"
                            disabled={
                              customPersonas.find(
                                (p) => p.id === selectedPersonaId,
                              )?.isSystemDefault && !isCreatingNew
                            }
                            onClick={() => setPersonaIcon(iconKey)}
                            className={`p-2 border rounded-lg flex items-center justify-center transition cursor-pointer disabled:opacity-40 ${
                              isChosen
                                ? "bg-theme-accent/10 border-theme-accent text-theme-accent"
                                : "bg-theme-panel/40 border-theme-border hover:border-theme-text/30 text-theme-muted"
                            }`}
                          >
                            <IconChoice className="w-4 h-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col space-y-1 min-h-35">
                    <label className="text-[10px] font-bold text-theme-muted uppercase tracking-wider">
                      System Directives Context Injector Payload
                    </label>
                    <textarea
                      disabled={
                        customPersonas.find((p) => p.id === selectedPersonaId)
                          ?.isSystemDefault && !isCreatingNew
                      }
                      value={personaPrompt}
                      onChange={(e) => setPersonaPrompt(e.target.value)}
                      placeholder="Enter specific contextual behaviors, constraint boundaries, and criteria instructions formatting structures..."
                      className="w-full flex-1 bg-theme-panel border border-theme-border rounded-lg p-2.5 text-xs text-theme-text focus:outline-none focus:border-theme-accent/60 font-mono resize-none leading-relaxed disabled:opacity-50"
                    />
                  </div>

                  {!customPersonas.find((p) => p.id === selectedPersonaId)
                    ?.isSystemDefault || isCreatingNew ? (
                    <button
                      type="button"
                      onClick={handleSavePersonaRow}
                      disabled={!personaLabel.trim() || !personaPrompt.trim()}
                      className="w-full bg-theme-accent/10 hover:bg-theme-accent text-theme-accent hover:text-theme-bg border border-theme-accent/30 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Apply Document Blueprint changes</span>
                    </button>
                  ) : (
                    <div className="text-[10px] text-theme-muted font-mono bg-theme-panel/40 p-2 rounded-lg border border-theme-border/40 text-center">
                      🔒 Core factory profiles are locked from
                      deletion/modifications.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: APPEARANCE & THEMES */}
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

                <div className="flex-1 overflow-y-auto pr-4 space-y-5 max-h-80">
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-theme-muted/80 uppercase tracking-widest pl-1">
                      Dark Configurations (8)
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {darkThemes.map((t) => renderThemeButton(t, true))}
                    </div>
                  </div>

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

          <div className="p-4 border-t border-theme-border bg-theme-panel/10 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-theme-panel hover:bg-theme-panel/80 text-theme-text border border-theme-border rounded-xl transition-colors cursor-pointer text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 bg-theme-accent hover:bg-theme-accent-hover text-theme-bg rounded-xl transition-colors cursor-pointer font-medium text-xs disabled:opacity-50 shadow-sm"
            >
              {isSaving ? "Encrypting..." : "Commit Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
