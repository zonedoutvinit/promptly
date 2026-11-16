// src/components/WelcomeModal.tsx
import React, { useState } from "react";
import { useChatStore, ProviderType } from "../store";
import {
  Cpu,
  Zap,
  HelpCircle,
  Key,
  ArrowRight,
  Check,
  Shield,
  Layers,
} from "lucide-react";

interface WelcomeModalProps {
  onComplete: () => void;
}

type OnboardingStep = "intro" | "setup" | "done";

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ onComplete }) => {
  const { updateProviderConfig } = useChatStore();

  const [currentStep, setCurrentStep] = useState<OnboardingStep>("intro");
  const [provider, setProvider] = useState<ProviderType>("ollama");
  const [baseUrl, setBaseUrl] = useState("http://localhost:11434");
  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleProviderChange = (selected: ProviderType) => {
    setProvider(selected);
    if (selected === "ollama") setBaseUrl("http://localhost:11434");
    else if (selected === "lm-studio") setBaseUrl("http://localhost:1234");
    else setBaseUrl("");
  };

  const handleCommitOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();

    if (provider === "gemini" && !apiKey.trim()) {
      alert("Please enter a valid Gemini API Key to proceed.");
      return;
    }

    setIsSaving(true);
    try {
      await updateProviderConfig(
        provider,
        { baseUrl: baseUrl.trim() },
        apiKey.trim() || undefined,
      );

      useChatStore.getState().setProvider(provider);
      localStorage.setItem("promptly_onboarding_done", "true");

      setCurrentStep("done");
    } catch (err) {
      console.error(err);
      alert("Error saving configuration setup parameters.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in select-none">
      <div className="bg-theme-bg border border-theme-border rounded-xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden text-sm transition-colors duration-200 animate-messageSlide">
        {/* ================= MODAL HEADER ================= */}
        <div className="p-4 border-b border-theme-border flex justify-between items-center bg-theme-bg shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-theme-accent fill-theme-accent/20 stroke-2" />
            <h4 className="text-theme-text font-semibold tracking-wide">
              {currentStep === "intro" && "Welcome to Promptly"}
              {currentStep === "setup" && "Connect a Model Provider"}
              {currentStep === "done" && "Setup Complete"}
            </h4>
          </div>

          {/* Progress Indicator Track */}
          <div className="flex items-center gap-1.5 px-2">
            <div
              className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${currentStep === "intro" ? "bg-theme-accent w-3" : "bg-theme-border"}`}
            />
            <div
              className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${currentStep === "setup" ? "bg-theme-accent w-3" : "bg-theme-border"}`}
            />
            <div
              className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${currentStep === "done" ? "bg-theme-accent w-3" : "bg-theme-border"}`}
            />
          </div>
        </div>

        {/* ================= MODAL MIDDLE RUNTIME CONTAINER ================= */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col justify-center">
          {/* STEP 1: WELCOME INTRO */}
          {currentStep === "intro" && (
            <div className="space-y-4 animate-chipFade">
              <div className="space-y-1">
                <h3 className="text-theme-text font-bold text-base">
                  A simple interface for your AI models
                </h3>
                <p className="text-theme-muted text-xs leading-relaxed">
                  Promptly lets you manage and chat with your preferred local
                  and cloud-based models from a single desktop environment.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex gap-3 p-2.5 rounded-xl bg-theme-panel/30 border border-theme-border/60">
                  <Shield className="w-4 h-4 text-theme-accent shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold text-xs text-theme-text">
                      Local & Cloud Integration
                    </span>
                    <p className="text-theme-muted text-[11px] leading-normal">
                      Switch between local on-device models for privacy, or use
                      cloud APIs. Your API keys are kept safely encrypted at
                      rest.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 p-2.5 rounded-xl bg-theme-panel/30 border border-theme-border/60">
                  <Layers className="w-4 h-4 text-theme-accent shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold text-xs text-theme-text">
                      Context Control
                    </span>
                    <p className="text-theme-muted text-[11px] leading-normal">
                      Keep chat histories clean and readable using tools like
                      context pinning and thread pruning.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 p-2.5 rounded-xl bg-theme-panel/30 border border-theme-border/60">
                  <HelpCircle className="w-4 h-4 text-theme-accent shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold text-xs text-theme-text">
                      Smart Suggestions
                    </span>
                    <p className="text-theme-muted text-[11px] leading-normal">
                      Get dynamic follow-up prompts tailored to your current
                      conversation context to help keep things moving.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: ENGINE HARDWARE PROVISIONING */}
          {currentStep === "setup" && (
            <form
              onSubmit={handleCommitOnboarding}
              className="space-y-4 w-full animate-chipFade"
            >
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-theme-muted uppercase tracking-wider flex items-center">
                  Select a starting provider
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleProviderChange("ollama")}
                    className={`p-3 border rounded-xl text-left transition-all cursor-pointer active:scale-[0.98] flex flex-col justify-between ${
                      provider === "ollama"
                        ? "bg-theme-panel border-theme-accent text-theme-accent"
                        : "bg-theme-panel/40 border-theme-border/60 text-theme-muted hover:border-theme-border hover:text-theme-text"
                    }`}
                  >
                    <div>
                      <div className="flex gap-1">
                        <Cpu className="w-4 h-4 stroke-2" />
                        <span className="font-semibold text-xs block text-theme-text">
                          Ollama / LM Studio
                        </span>
                      </div>
                      <span className="text-[10px] text-theme-muted block mt-0.5 leading-tight">
                        Run models locally. Please make sure your local server
                        port is active.
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleProviderChange("gemini")}
                    className={`p-3 border rounded-xl text-left transition-all cursor-pointer active:scale-[0.98] flex flex-col justify-between ${
                      provider === "gemini"
                        ? "bg-theme-panel border-theme-accent text-theme-accent"
                        : "bg-theme-panel/40 border-theme-border/60 text-theme-muted hover:border-theme-border hover:text-theme-text"
                    }`}
                  >
                    <div>
                      <div className="flex gap-1">
                        <Key className="w-4 h-4 stroke-2" />
                        <span className="font-semibold text-xs block text-theme-text">
                          Google Gemini AI
                        </span>
                      </div>
                      <span className="text-[10px] text-theme-muted block mt-0.5 leading-tight">
                        Connect via the cloud. Requires your personal API key.
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {provider !== "gemini" ? (
                <div className="space-y-1.5 animate-chipFade">
                  <label className="text-[11px] font-bold text-theme-muted uppercase tracking-wider flex items-center">
                    Server Endpoint URL
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
              ) : (
                <div className="space-y-1.5 animate-chipFade">
                  <label className="text-[11px] font-bold text-theme-muted uppercase tracking-wider flex items-center gap-1.5">
                    <span>Gemini API Key</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your AIzaSy API key"
                    className="w-full bg-theme-panel border border-theme-border rounded-lg p-2.5 text-theme-text focus:outline-none focus:border-theme-accent/60 text-xs font-mono placeholder:text-theme-muted"
                  />
                </div>
              )}

              {/* Invisible anchor to simulate native form submit execution */}
              <button
                type="submit"
                id="onboarding-hidden-submit"
                className="hidden"
              />
            </form>
          )}

          {/* STEP 3: WORKSPACE DEPLOYED */}
          {currentStep === "done" && (
            <div className="text-center space-y-3 py-4 animate-chipFade">
              <div className="w-12 h-12 bg-theme-panel border border-theme-accent/40 rounded-xl flex items-center justify-center mx-auto shadow-sm">
                <Check className="w-5 h-5 text-theme-accent stroke-[2.5]" />
              </div>
              <div className="space-y-1">
                <span className="text-theme-text font-bold text-base block">
                  All set!
                </span>
                <p className="text-theme-muted text-xs max-w-xs mx-auto leading-normal">
                  Your base settings have been saved. You can always change
                  these later in your app settings panel.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ================= MODAL FOOTER ACTION CONTROLS ================= */}
        <div className="p-4 border-t border-theme-border bg-theme-panel/10 flex justify-between items-center shrink-0">
          <div>
            {currentStep === "setup" && (
              <button
                type="button"
                onClick={() => setCurrentStep("intro")}
                className="px-4 py-1.5 bg-theme-panel hover:bg-theme-panel/80 text-theme-text border border-theme-border rounded-xl transition-colors cursor-pointer text-xs"
              >
                Back
              </button>
            )}
          </div>

          <div className="flex gap-3">
            {currentStep === "intro" && (
              <button
                type="button"
                onClick={() => setCurrentStep("setup")}
                className="px-4 py-1.5 bg-theme-accent hover:bg-theme-accent-hover text-theme-bg rounded-xl transition-colors cursor-pointer font-medium text-xs flex items-center gap-1.5 shadow-sm"
              >
                <span>Get Started</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-2" />
              </button>
            )}

            {currentStep === "setup" && (
              <button
                type="button"
                disabled={isSaving}
                onClick={() =>
                  document.getElementById("onboarding-hidden-submit")?.click()
                }
                className="px-4 py-1.5 bg-theme-accent hover:bg-theme-accent-hover text-theme-bg rounded-xl transition-colors cursor-pointer font-medium text-xs flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
              >
                <span>{isSaving ? "Saving..." : "Save Settings"}</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-2" />
              </button>
            )}

            {currentStep === "done" && (
              <button
                type="button"
                onClick={onComplete}
                className="px-5 py-1.5 bg-theme-accent hover:bg-theme-accent-hover text-theme-bg rounded-xl transition-colors cursor-pointer font-medium text-xs shadow-sm"
              >
                Open Workspace
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
