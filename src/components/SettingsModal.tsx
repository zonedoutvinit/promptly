// src/components/SettingsModal.tsx
import React, { useState, useEffect } from "react";
import { useChatStore, EngineSettings } from "../store";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { settings, updateSettings } = useChatStore();
  const [provider, setProvider] =
    useState<EngineSettings["provider"]>("ollama");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setProvider(settings.provider);
      setBaseUrl(settings.baseUrl);
      setApiKey(""); // Keep input key empty for display sanitation
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value as EngineSettings["provider"];
    setProvider(selected);
    if (selected === "ollama") {
      setBaseUrl("http://localhost:11434");
    } else if (selected === "lm-studio") {
      setBaseUrl("http://localhost:1234");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateSettings(
        { baseUrl: baseUrl.trim(), provider },
        apiKey.trim() || undefined, // Only pass raw key changes if user explicitly typed something
      );
      onClose();
    } catch (err) {
      alert("Error processing security encryption tokens.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-messageSlide">
        <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="text-zinc-200 font-semibold tracking-wide">
            Inference Coordination
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Provider Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Engine Provider
            </label>
            <select
              value={provider}
              onChange={handleProviderChange}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-200 focus:outline-none focus:border-indigo-500 text-sm"
            >
              <option value="ollama">Ollama (Default)</option>
              <option value="lm-studio">LM Studio</option>
              <option value="openai-compatible">
                OpenAI Compatible Gateway
              </option>
            </select>
          </div>

          {/* Base URL Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Server Endpoint Connection
            </label>
            <input
              type="url"
              required
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="e.g. http://localhost:11434"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-200 focus:outline-none focus:border-indigo-500 text-sm"
            />
          </div>

          {/* Conditional Encrypted Key Field */}
          {provider !== "ollama" && (
            <div className="space-y-1.5 animate-chipFade">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                API Bearer Secret Token{" "}
                <span className="text-[10px] text-emerald-500 font-normal lowercase">
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
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-200 focus:outline-none focus:border-indigo-500 text-sm placeholder:text-zinc-600"
              />
            </div>
          )}

          <div className="pt-2 flex justify-end gap-3 text-sm">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors cursor-pointer font-medium disabled:opacity-50"
            >
              {isSaving ? "Encrypting..." : "Commit Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
