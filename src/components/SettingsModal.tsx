// src/components/SettingsModal.tsx
import React, { useState, useEffect } from "react";
import { useChatStore, ProviderType, SystemProfile } from "../store";
import { Cpu, Palette, Users, X } from "lucide-react";
import { EngineConfigTab } from "./settings/EngineConfigTab";
import { PersonasTab } from "./settings/PersonasTab";
import { AppearanceTab } from "./settings/AppearanceTab";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = "engine" | "appearance" | "personas";

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    settings,
    updateProviderConfig,
    theme,
    setTheme,
    customPersonas,
    addPersona,
    updatePersona,
    deletePersona,
  } = useChatStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>("engine");
  const [localTheme, setLocalTheme] = useState<string>(theme);
  const [provider, setProvider] = useState<ProviderType>("ollama");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(
    null,
  );
  const [personaLabel, setPersonaLabel] = useState("");
  const [personaIcon, setPersonaIcon] = useState("Terminal");
  const [personaPrompt, setPersonaPrompt] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);

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

  useEffect(() => {
    if (isOpen) {
      setLocalTheme(theme);
      const activeProvider = settings.currentProvider;
      const providerConfig = settings.providers[activeProvider];
      setProvider(activeProvider);
      setBaseUrl(providerConfig?.baseUrl || "");
      setApiKey("");
    }
  }, [isOpen, settings, theme]);

  const handleProviderChange = async (selected: ProviderType) => {
    setProvider(selected);
    // 1. Update the local configuration
    const existingConfig = settings.providers[selected];
    setBaseUrl(existingConfig?.baseUrl || "");
    // 2. IMPORTANT: Update the store's current provider to trigger effects
    useChatStore.getState().setProvider(selected);
    // 3. Trigger the model fetch immediately
    await useChatStore.getState().fetchModels();
  };

  const handleTestConnection = () => {
    return useChatStore.getState().testProviderConnection(provider);
  };

  const handleCommitSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      setTheme(localTheme);
      document.documentElement.setAttribute("data-theme", localTheme);
      await updateProviderConfig(
        provider,
        { baseUrl: baseUrl.trim() },
        apiKey.trim() || undefined,
      );
      if (settings.currentProvider !== provider) {
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

  const handleSavePersona = () => {
    if (isCreatingNew) {
      addPersona({
        label: personaLabel,
        icon: personaIcon,
        prompt: personaPrompt,
        isSystemDefault: false,
      });
    } else if (selectedPersonaId) {
      updatePersona(selectedPersonaId, {
        label: personaLabel,
        icon: personaIcon,
        prompt: personaPrompt,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in select-none">
      <div className="bg-theme-bg border border-theme-border rounded-xl w-full max-w-4xl h-145 shadow-2xl flex overflow-hidden animate-messageSlide text-sm transition-colors duration-200">
        <aside className="w-48 bg-theme-panel/40 border-r border-theme-border p-4 flex flex-col justify-between shrink-0">
          <div className="space-y-4">
            <div className="px-2 py-1">
              <h3 className="text-theme-muted font-bold tracking-wider text-[11px] uppercase">
                Configuration
              </h3>
            </div>
            <nav className="space-y-1">
              {["engine", "personas", "appearance"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab as SettingsTab)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-all cursor-pointer text-xs ${activeTab === tab ? "bg-theme-panel text-theme-accent border border-theme-border/80 shadow-xs" : "text-theme-muted hover:bg-theme-panel/40 hover:text-theme-text"}`}
                >
                  {tab === "engine" && <Cpu className="w-4 h-4" />}
                  {tab === "personas" && <Users className="w-4 h-4" />}
                  {tab === "appearance" && <Palette className="w-4 h-4" />}
                  <span className="capitalize">{tab}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <form
          onSubmit={handleCommitSettings}
          className="flex-1 flex flex-col h-full overflow-hidden bg-theme-bg"
        >
          <div className="p-4 border-b border-theme-border flex justify-between items-center shrink-0">
            <h4 className="text-theme-text font-semibold tracking-wide capitalize">
              {activeTab} Settings
            </h4>
            <button
              type="button"
              onClick={onClose}
              className="text-theme-muted hover:text-theme-text p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {activeTab === "engine" && (
              <EngineConfigTab
                provider={provider}
                baseUrl={baseUrl}
                apiKey={apiKey}
                savedEncryptedKey={
                  !!settings.providers[provider]?.encryptedApiKey
                }
                onProviderChange={handleProviderChange}
                onBaseUrlChange={setBaseUrl}
                onApiKeyChange={setApiKey}
                onTestConnection={handleTestConnection}
              />
            )}
            {activeTab === "personas" && (
              <PersonasTab
                customPersonas={customPersonas}
                selectedPersonaId={selectedPersonaId}
                isCreatingNew={isCreatingNew}
                personaLabel={personaLabel}
                personaIcon={personaIcon}
                personaPrompt={personaPrompt}
                onLoadPersona={loadPersonaIntoEditor}
                onInitNewPersona={initNewPersonaForm}
                onDeletePersona={deletePersona}
                onLabelChange={setPersonaLabel}
                onIconChange={setPersonaIcon}
                onPromptChange={setPersonaPrompt}
                onSavePersona={handleSavePersona}
              />
            )}
            {activeTab === "appearance" && (
              <AppearanceTab
                localTheme={localTheme}
                onThemeSelect={setLocalTheme}
              />
            )}
          </div>

          <div className="p-4 border-t border-theme-border bg-theme-panel/10 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-theme-panel border border-theme-border rounded-xl cursor-pointer text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 bg-theme-accent text-theme-bg rounded-xl cursor-pointer font-medium text-xs disabled:opacity-50"
            >
              {isSaving ? "Encrypting..." : "Commit Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
