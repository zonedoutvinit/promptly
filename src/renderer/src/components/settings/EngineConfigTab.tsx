// src/components/settings/EngineConfigTab.tsx
import React, { useState } from "react";
import { ProviderType } from "../../store";
import { useChatStore } from "../../store";
import {
  Check,
  AlertCircle,
  RefreshCw,
  Server,
  Key,
  Cpu,
  Zap,
} from "lucide-react";

interface EngineConfigTabProps {
  provider: ProviderType;
  baseUrl: string;
  apiKey: string;
  savedEncryptedKey: boolean;
  onProviderChange: (provider: ProviderType) => void;
  onBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onTestConnection: () => Promise<{ success: boolean; message: string }>;
}

export const EngineConfigTab: React.FC<EngineConfigTabProps> = ({
  provider,
  baseUrl,
  apiKey,
  savedEncryptedKey,
  onProviderChange,
  onBaseUrlChange,
  onApiKeyChange,
  onTestConnection,
}) => {
  const { availableModels, model, setModel, isFetchingModels } = useChatStore();
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const providers: { id: ProviderType; name: string }[] = [
    { id: "ollama", name: "Ollama" },
    { id: "lm-studio", name: "LM Studio" },
    { id: "openai-compatible", name: "OpenAI Compatible" },
    { id: "gemini", name: "Google Gemini" },
  ];

  const handleTest = async () => {
    setTestStatus("testing");
    try {
      const res = await onTestConnection();
      setTestStatus(res.success ? "success" : "error");
      setTestMessage(res.message);
    } catch (e) {
      setTestStatus("error");
      setTestMessage("Connection error occurred.");
    }
  };

  return (
    <div className="space-y-6 animate-chipFade">
      {/* Provider Selector */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold text-theme-muted uppercase tracking-wider flex items-center gap-1.5">
          <Zap className="w-3 h-3" /> Engine Provider
        </label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {providers.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setTestStatus("idle");
                setTestMessage(null);
                onProviderChange(p.id);
              }}
              className={`p-2.5 rounded-lg border text-xs font-medium transition-all ${
                provider === p.id
                  ? "bg-theme-accent/10 border-theme-accent text-theme-accent ring-1 ring-theme-accent"
                  : "bg-theme-panel border-theme-border text-theme-text hover:border-theme-accent/50"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Connection Details */}
      <div className="space-y-4">
        {provider !== "gemini" && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-theme-muted uppercase tracking-wider flex items-center gap-1.5">
              <Server className="w-3 h-3" /> Server Endpoint
            </label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => onBaseUrlChange(e.target.value)}
              placeholder="e.g. http://localhost:11434"
              className="w-full bg-theme-panel border border-theme-border rounded-lg p-2.5 text-theme-text text-xs font-mono focus:border-theme-accent outline-none"
            />
          </div>
        )}

        {provider !== "ollama" && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-theme-muted uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-3 h-3" /> API Secret Token
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder={
                savedEncryptedKey
                  ? "•••••••••••••••• (Encrypted)"
                  : "Enter API key"
              }
              className="w-full bg-theme-panel border border-theme-border rounded-lg p-2.5 text-theme-text text-xs font-mono focus:border-theme-accent outline-none"
            />
          </div>
        )}
      </div>

      {/* Action Zone */}
      <div className="pt-4 border-t border-theme-border space-y-4">
        <button
          type="button"
          onClick={handleTest}
          disabled={testStatus === "testing"}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
            testStatus === "success"
              ? "bg-green-500/10 text-green-500 border border-green-500/20"
              : testStatus === "error"
                ? "bg-red-500/10 text-red-500 border border-red-500/20"
                : "bg-theme-panel border border-theme-border hover:bg-theme-accent/10"
          }`}
        >
          {testStatus === "testing" && (
            <RefreshCw className="w-3 h-3 animate-spin" />
          )}
          {testStatus === "success" && <Check className="w-3 h-3" />}
          {testStatus === "error" && <AlertCircle className="w-3 h-3" />}
          {testStatus === "testing"
            ? "Handshaking..."
            : testMessage || "Test Connection Handshake"}
        </button>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-theme-muted uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-3 h-3" /> Active Model
          </label>
          {isFetchingModels ? (
            <div className="text-xs text-theme-muted italic p-2.5 animate-pulse">
              Syncing catalog...
            </div>
          ) : availableModels.length > 0 ? (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-theme-panel border border-theme-border rounded-lg p-2.5 text-theme-text text-xs font-mono outline-none focus:border-theme-accent"
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-[10px] text-theme-muted p-2.5 border border-dashed border-theme-border rounded-lg">
              No models detected. Check your connection.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
