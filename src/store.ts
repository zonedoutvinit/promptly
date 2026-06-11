// src/store.ts
import { create } from "zustand";
import {
  getAllSessions,
  saveSession,
  deleteSessionFromDB,
  ChatSession,
  ChatMessage,
} from "./utils/db";
import { decryptKey, encryptKey } from "./utils/crypto";

export type ProviderType =
  | "ollama"
  | "lm-studio"
  | "openai-compatible"
  | "gemini";

export interface ProviderConfig {
  baseUrl: string;
  encryptedApiKey?: string;
}

export interface EngineSettings {
  currentProvider: ProviderType;
  providers: Record<ProviderType, ProviderConfig>;
}

export interface SystemProfile {
  id: string;
  label: string;
  icon: string; // Stored as a generic literal matching key mapping dictionaries
  prompt: string;
  isSystemDefault?: boolean;
}

interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  model: string;
  availableModels: string[];
  settings: EngineSettings;
  theme: string;
  customPersonas: SystemProfile[];
  abortController: AbortController | null;

  fetchModels: () => Promise<void>;
  setModel: (model: string) => void;
  setTheme: (theme: string) => void;

  // 🔄 Multi-Provider Real-time Orchestration
  setProvider: (provider: ProviderType) => Promise<void>;
  updateProviderConfig: (
    provider: ProviderType,
    config: Partial<ProviderConfig>,
    rawKey?: string,
  ) => Promise<void>;

  // 🎭 Persona Management Operations
  addPersona: (persona: Omit<SystemProfile, "id">) => void;
  updatePersona: (id: string, updated: Partial<SystemProfile>) => void;
  deletePersona: (id: string) => void;

  createNewSession: () => void;
  selectSession: (id: string) => void;
  deleteSession: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => void;
  loadSessionsFromStorage: () => Promise<void>;
  toggleMessagePin: (index: number) => Promise<void>;
  toggleMessagePrune: (index: number) => Promise<void>;

  onUpdateUserMessage: (index: number, newContent: string) => Promise<void>;
  onRegenerateFromCheckpoint: (
    index: number,
    overrides: {
      temperature: number;
      topP: number;
      frequencyPenalty: number;
      presencePenalty: number;
    },
  ) => Promise<void>;
}

const DEFAULT_SETTINGS: EngineSettings = {
  currentProvider: "ollama",
  providers: {
    ollama: { baseUrl: "http://localhost:11434", encryptedApiKey: "" },
    "lm-studio": { baseUrl: "http://localhost:1234", encryptedApiKey: "" },
    "openai-compatible": { baseUrl: "", encryptedApiKey: "" },
    gemini: { baseUrl: "", encryptedApiKey: "" },
  },
};

const DEFAULT_PERSONAS: SystemProfile[] = [
  {
    id: "default-assistant",
    label: "General Assistant",
    icon: "Sparkles",
    prompt:
      "You are a helpful, precise AI assistant. Provide direct, optimal answers with clear structural markdown hierarchy.",
    isSystemDefault: true,
  },
  {
    id: "default-writer",
    label: "Creative Writer",
    icon: "PenTool",
    prompt:
      "You are an expert editor and creative writer. Focus on comprehensive prose generation, fluid articulation, and synthesis, adjusting tone dynamically based on context.",
    isSystemDefault: true,
  },
  {
    id: "default-developer",
    label: "Software Engineer",
    icon: "Code",
    prompt:
      "You are an expert software engineer. Provide optimal, clean code implementations matching industrial best practices. Prioritize execution speed, memory safety, and include minimal explanation prose.",
    isSystemDefault: true,
  },
  {
    id: "default-thinker",
    label: "Analytical Reasoning",
    icon: "BrainCircuit",
    prompt:
      "You are a rigorous analytical thinker. Break down problems step-by-step, cross-examining edge cases and logical deductions thoroughly before arriving at conclusions.",
    isSystemDefault: true,
  },
];

const getInitialSettings = (): EngineSettings => {
  const local = localStorage.getItem("promptly_engine_settings");
  if (!local) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(local);
    // Backward compatibility layer check in case legacy flat structures exist
    if (!parsed.providers) {
      return {
        currentProvider: parsed.provider || "ollama",
        providers: {
          ollama: {
            baseUrl:
              parsed.provider === "ollama"
                ? parsed.baseUrl
                : "http://localhost:11434",
            encryptedApiKey:
              parsed.provider === "ollama" ? parsed.encryptedApiKey : "",
          },
          "lm-studio": {
            baseUrl:
              parsed.provider === "lm-studio"
                ? parsed.baseUrl
                : "http://localhost:1234",
            encryptedApiKey:
              parsed.provider === "lm-studio" ? parsed.encryptedApiKey : "",
          },
          "openai-compatible": {
            baseUrl:
              parsed.provider === "openai-compatible" ? parsed.baseUrl : "",
            encryptedApiKey:
              parsed.provider === "openai-compatible"
                ? parsed.encryptedApiKey
                : "",
          },
          gemini: {
            baseUrl: parsed.provider === "gemini" ? parsed.baseUrl : "",
            encryptedApiKey:
              parsed.provider === "gemini" ? parsed.encryptedApiKey : "",
          },
        },
      };
    }
    return parsed;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const getInitialTheme = (): string => {
  const savedTheme = localStorage.getItem("promptly-theme") || "zinc-dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  return savedTheme;
};

const getInitialPersonas = (): SystemProfile[] => {
  const local = localStorage.getItem("promptly_custom_personas");
  if (!local) return DEFAULT_PERSONAS;
  try {
    const parsed = JSON.parse(local);
    return parsed.length > 0 ? parsed : DEFAULT_PERSONAS;
  } catch {
    return DEFAULT_PERSONAS;
  }
};

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  isLoading: false,
  model: "",
  availableModels: [],
  settings: getInitialSettings(),
  theme: getInitialTheme(),
  customPersonas: getInitialPersonas(),
  abortController: null,

  stopGeneration: () => {
    const {
      abortController,
      currentSessionId,
      model,
      messages,
      sessions,
      loadSessionsFromStorage,
    } = get();
    if (abortController) {
      abortController.abort();

      if (currentSessionId) {
        const match = sessions.find((s) => s.id === currentSessionId);
        const activeTitle = match?.title || "Active Discussion";
        const finalSessionRecord: ChatSession = {
          id: currentSessionId,
          title: activeTitle,
          model,
          messages: messages,
          updatedAt: Date.now(),
        };
        saveSession(finalSessionRecord).then(() => loadSessionsFromStorage());
      }

      set({ abortController: null, isLoading: false });
    }
  },

  setTheme: (theme: string) => {
    localStorage.setItem("promptly-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  },

  // Header Fast-Switch Pipeline Trigger
  setProvider: async (provider: ProviderType) => {
    const currentSettings = get().settings;
    const updatedSettings = {
      ...currentSettings,
      currentProvider: provider,
    };

    localStorage.setItem(
      "promptly_engine_settings",
      JSON.stringify(updatedSettings),
    );
    set({ settings: updatedSettings, availableModels: [], model: "" });

    await get().fetchModels();
  },

  // Individual Parameter Mapping (Called by your settings save configurations)
  updateProviderConfig: async (
    provider: ProviderType,
    config: Partial<ProviderConfig>,
    rawKey?: string,
  ) => {
    const currentSettings = get().settings;
    let encryptedApiKey =
      config.encryptedApiKey ||
      currentSettings.providers[provider].encryptedApiKey ||
      "";

    if (rawKey !== undefined) {
      encryptedApiKey = rawKey ? await encryptKey(rawKey) : "";
    }

    const updatedSettings = {
      ...currentSettings,
      providers: {
        ...currentSettings.providers,
        [provider]: {
          ...currentSettings.providers[provider],
          ...config,
          encryptedApiKey,
        },
      },
    };

    localStorage.setItem(
      "promptly_engine_settings",
      JSON.stringify(updatedSettings),
    );
    set({ settings: updatedSettings });

    if (currentSettings.currentProvider === provider) {
      set({ availableModels: [], model: "" });
      await get().fetchModels();
    }
  },

  addPersona: (persona) => {
    const newPersona: SystemProfile = {
      ...persona,
      id: `custom-${crypto.randomUUID()}`,
    };
    const updated = [...get().customPersonas, newPersona];
    localStorage.setItem("promptly_custom_personas", JSON.stringify(updated));
    set({ customPersonas: updated });
  },

  updatePersona: (id, updatedFields) => {
    const updated = get().customPersonas.map((p) =>
      p.id === id ? { ...p, ...updatedFields } : p,
    );
    localStorage.setItem("promptly_custom_personas", JSON.stringify(updated));
    set({ customPersonas: updated });
  },

  deletePersona: (id) => {
    const updated = get().customPersonas.filter((p) => p.id !== id);
    localStorage.setItem("promptly_custom_personas", JSON.stringify(updated));
    set({ customPersonas: updated });
  },

  fetchModels: async () => {
    const { settings } = get();
    const provider = settings.currentProvider;
    const activeProviderConfig = settings.providers[provider];

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    let targetUrl =
      provider === "gemini"
        ? "https://generativelanguage.googleapis.com/v1beta/openai/v1/models"
        : `${activeProviderConfig.baseUrl}/v1/models`;

    if (activeProviderConfig.encryptedApiKey) {
      const activeKey = await decryptKey(activeProviderConfig.encryptedApiKey);
      if (activeKey) {
        headers["Authorization"] = `Bearer ${activeKey}`;
      }
    }

    try {
      if (provider === "ollama") {
        targetUrl = `${activeProviderConfig.baseUrl}/api/tags`;
        const response = await fetch(targetUrl, { headers });
        if (!response.ok) throw new Error();
        const data = await response.json();
        const models = data.models.map((m: any) => m.name);
        set({ availableModels: models });
      } else if (provider === "gemini") {
        const targetGeminiModels = ["gemini-2.5-flash", "gemini-2.5-pro"];
        try {
          const response = await fetch(targetUrl, { headers });
          if (!response.ok) throw new Error();
          const data = await response.json();
          const fetchedModels = data.data.map((m: any) => m.id);
          const filtered = targetGeminiModels.filter((m) =>
            fetchedModels.includes(m),
          );

          set({
            availableModels:
              filtered.length > 0 ? filtered : targetGeminiModels,
          });
        } catch {
          set({ availableModels: targetGeminiModels });
        }
      } else {
        const response = await fetch(targetUrl, { headers });
        if (!response.ok) throw new Error();
        const data = await response.json();
        const models = data.data.map((m: any) => m.id);
        set({ availableModels: models });
      }

      const models = get().availableModels;
      if (
        models.length > 0 &&
        (!get().model || !models.includes(get().model))
      ) {
        set({ model: models[0] });
      }
    } catch (err) {
      console.error(
        "Could not fetch models for current provider settings.",
        err,
      );
      set({ availableModels: [] });
    }
  },

  setModel: (model: string) => {
    set({ model });
    const { currentSessionId, sessions } = get();
    if (currentSessionId) {
      const currentSession = sessions.find((s) => s.id === currentSessionId);
      if (currentSession) {
        const updated = { ...currentSession, model, updatedAt: Date.now() };
        saveSession(updated).then(() => get().loadSessionsFromStorage());
      }
    }
  },

  loadSessionsFromStorage: async () => {
    const sessions = await getAllSessions();
    set({ sessions });
  },

  createNewSession: () => {
    set({
      currentSessionId: null,
      messages: [],
      isLoading: false,
      abortController: null,
    });
  },

  selectSession: (id: string) => {
    const target = get().sessions.find((s) => s.id === id);
    if (target) {
      set({
        currentSessionId: id,
        messages: target.messages,
        model: target.model || get().model || get().availableModels[0],
      });
    }
  },

  deleteSession: async (id: string) => {
    await deleteSessionFromDB(id);
    await get().loadSessionsFromStorage();
    if (get().currentSessionId === id) {
      set({ currentSessionId: null, messages: [] });
    }
  },

  toggleMessagePin: async (index: number) => {
    const { messages, currentSessionId, sessions } = get();
    if (!currentSessionId) return;

    const targetHistory = [...messages];
    const targetMessage = targetHistory[index];
    if (!targetMessage) return;

    const newPinState = !targetMessage.isPinned;
    const updateIndices: number[] = [index];

    if (
      targetMessage.role === "user" &&
      targetHistory[index + 1]?.role === "assistant"
    ) {
      updateIndices.push(index + 1);
    } else if (
      targetMessage.role === "assistant" &&
      targetHistory[index - 1]?.role === "user"
    ) {
      updateIndices.push(index - 1);
    }

    updateIndices.forEach((i) => {
      if (targetHistory[i]) {
        targetHistory[i] = { ...targetHistory[i], isPinned: newPinState };
      }
    });

    set({ messages: targetHistory });
    const match = sessions.find((s) => s.id === currentSessionId);
    if (match) {
      const updatedSession = {
        ...match,
        messages: targetHistory,
        updatedAt: Date.now(),
      };
      await saveSession(updatedSession);
      await get().loadSessionsFromStorage();
    }
  },

  toggleMessagePrune: async (index: number) => {
    const { messages, currentSessionId, sessions } = get();
    if (!currentSessionId) return;

    const targetHistory = [...messages];
    const targetMessage = targetHistory[index];
    if (!targetMessage) return;

    const newPruneState = !targetMessage.isPruned;
    const updateIndices: number[] = [index];

    if (
      targetMessage.role === "user" &&
      targetHistory[index + 1]?.role === "assistant"
    ) {
      updateIndices.push(index + 1);
    } else if (
      targetMessage.role === "assistant" &&
      targetHistory[index - 1]?.role === "user"
    ) {
      updateIndices.push(index - 1);
    }

    updateIndices.forEach((i) => {
      if (targetHistory[i]) {
        targetHistory[i] = { ...targetHistory[i], isPruned: newPruneState };
      }
    });

    set({ messages: targetHistory });
    const match = sessions.find((s) => s.id === currentSessionId);
    if (match) {
      const updatedSession = {
        ...match,
        messages: targetHistory,
        updatedAt: Date.now(),
      };
      await saveSession(updatedSession);
      await get().loadSessionsFromStorage();
    }
  },

  sendMessage: async (content: string) => {
    const { model, messages, isLoading, currentSessionId, settings } = get();
    if (!model || isLoading || !content.trim()) return;

    const provider = settings.currentProvider;
    const activeProviderConfig = settings.providers[provider];

    let sessionId = currentSessionId || crypto.randomUUID();
    const isBrandNewSession = !currentSessionId;
    const controller = new AbortController();

    const newUserMessage: ChatMessage = {
      role: "user",
      content,
      timestamp: Date.now(),
      isPinned: false,
      isPruned: false,
    };
    const updatedMessagesWithUser = [...messages, newUserMessage];

    const initialTitle = isBrandNewSession
      ? content.length > 26
        ? `${content.slice(0, 24)}...`
        : content
      : get().sessions.find((s) => s.id === sessionId)?.title ||
        "Active Discussion";

    const transientSessionRecord: ChatSession = {
      id: sessionId,
      title: initialTitle,
      model,
      messages: [
        ...updatedMessagesWithUser,
        {
          role: "assistant",
          content: "",
          timestamp: Date.now(),
          isPinned: false,
          isPruned: false,
        },
      ],
      updatedAt: Date.now(),
    };

    // STABILITY ENHANCEMENT: Commit session shell atomic write before execution pipeline starts
    await saveSession(transientSessionRecord);
    await get().loadSessionsFromStorage();

    set({
      currentSessionId: sessionId,
      messages: transientSessionRecord.messages,
      isLoading: true,
      abortController: controller,
    });

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (activeProviderConfig.encryptedApiKey) {
        const activeKey = await decryptKey(
          activeProviderConfig.encryptedApiKey,
        );
        if (activeKey) headers["Authorization"] = `Bearer ${activeKey}`;
      }

      const isOllama = provider === "ollama";
      const isGemini = provider === "gemini";

      const targetUrl = isOllama
        ? `${activeProviderConfig.baseUrl}/api/chat`
        : isGemini
          ? "https://generativelanguage.googleapis.com/v1beta/openai/v1/chat/completions"
          : `${activeProviderConfig.baseUrl}/v1/chat/completions`;

      const compiledActiveContext = updatedMessagesWithUser
        .filter((msg) => !msg.isPruned)
        .map(({ role, content }) => ({ role, content }));

      const standardPayload = {
        model,
        messages: compiledActiveContext,
        stream: true,
      };

      const response = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(standardPayload),
        signal: controller.signal,
      });

      if (!response.ok || !response.body)
        throw new Error("Engine generation failure");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantTextAccumulator = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        const lines = chunkText.split("\n");

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          try {
            if (isOllama) {
              const parsedChunk = JSON.parse(trimmedLine);
              if (parsedChunk.message?.content) {
                assistantTextAccumulator += parsedChunk.message.content;
              }
            } else {
              if (trimmedLine.startsWith("data: ")) {
                const rawJson = trimmedLine.replace(/^data:\s*/, "");
                if (rawJson === "[DONE]") continue;

                const parsedChunk = JSON.parse(rawJson);
                const contentChunk = parsedChunk.choices?.[0]?.delta?.content;
                if (contentChunk) {
                  assistantTextAccumulator += contentChunk;
                }
              }
            }

            set((state) => {
              const currentHistory = [...state.messages];
              if (currentHistory.length > 0) {
                currentHistory[currentHistory.length - 1] = {
                  ...currentHistory[currentHistory.length - 1],
                  content: assistantTextAccumulator,
                  timestamp: Date.now(),
                };
              }
              return { messages: currentHistory };
            });
          } catch (e) {}
        }
      }

      set({ isLoading: false, abortController: null });

      const finalSessionRecord: ChatSession = {
        id: sessionId,
        title: initialTitle,
        model,
        messages: get().messages,
        updatedAt: Date.now(),
      };

      await saveSession(finalSessionRecord);
      await get().loadSessionsFromStorage();
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("Streaming request gracefully severed by the client.");
      } else {
        console.error("Inference execution failed:", error);
        set({ isLoading: false, abortController: null });
      }
    }
  },

  onUpdateUserMessage: async (index: number, newContent: string) => {
    const { messages, isLoading } = get();
    if (isLoading || !newContent.trim()) return;

    // Truncate the history right up to the user message being edited
    const cleanHistory = messages.slice(0, index);

    // Execute using the existing message pipeline
    set({ messages: cleanHistory });
    await get().sendMessage(newContent);
  },

  onRegenerateFromCheckpoint: async (
    index: number,
    overrides: {
      temperature: number;
      topP: number;
      frequencyPenalty: number;
      presencePenalty: number;
    },
  ) => {
    const { model, messages, isLoading, currentSessionId, settings } = get();
    if (!model || isLoading || !currentSessionId) return;

    const provider = settings.currentProvider;
    const activeProviderConfig = settings.providers[provider];

    const targetUserIdx = messages[index].role === "user" ? index : index - 1;
    if (targetUserIdx < 0 || messages[targetUserIdx].role !== "user") return;

    // Truncate the thread history right after the user's setup prompt
    const controller = new AbortController();
    const cleanHistory = messages.slice(0, targetUserIdx + 1);
    const compiledActiveContext = cleanHistory
      .filter((msg) => !msg.isPruned)
      .map(({ role, content }) => ({ role, content }));

    // Append an empty placeholder assistant message frame for streaming
    const streamingHistory: ChatMessage[] = [
      ...cleanHistory,
      {
        role: "assistant" as const,
        content: "",
        timestamp: Date.now(),
        isPinned: false,
        isPruned: false,
        ...overrides,
      },
    ];

    set({
      messages: streamingHistory,
      isLoading: true,
      abortController: controller,
    });

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (activeProviderConfig.encryptedApiKey) {
        const activeKey = await decryptKey(
          activeProviderConfig.encryptedApiKey,
        );
        if (activeKey) headers["Authorization"] = `Bearer ${activeKey}`;
      }

      const isOllama = provider === "ollama";
      const isGemini = provider === "gemini";

      const targetUrl = isOllama
        ? `${activeProviderConfig.baseUrl}/api/chat`
        : isGemini
          ? "https://generativelanguage.googleapis.com/v1beta/openai/v1/chat/completions"
          : `${activeProviderConfig.baseUrl}/v1/chat/completions`;

      const standardPayload: Record<string, any> = {
        model,
        messages: compiledActiveContext,
        stream: true,
      };

      if (isOllama) {
        standardPayload.options = {
          temperature: overrides.temperature,
          top_p: overrides.topP,
          frequency_penalty: overrides.frequencyPenalty,
          presence_penalty: overrides.presencePenalty,
        };
      } else if (isGemini) {
        standardPayload.temperature = overrides.temperature;
        standardPayload.top_p = overrides.topP;
      } else {
        standardPayload.temperature = overrides.temperature;
        standardPayload.top_p = overrides.topP;
        standardPayload.frequency_penalty = overrides.frequencyPenalty;
        standardPayload.presence_penalty = overrides.presencePenalty;
      }

      const response = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(standardPayload),
        signal: controller.signal,
      });

      if (!response.ok || !response.body)
        throw new Error("Checkpoint regeneration error");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantTextAccumulator = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        const lines = chunkText.split("\n");

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          try {
            if (isOllama) {
              const parsedChunk = JSON.parse(trimmedLine);
              if (parsedChunk.message?.content) {
                assistantTextAccumulator += parsedChunk.message.content;
              }
            } else {
              if (trimmedLine.startsWith("data: ")) {
                const rawJson = trimmedLine.replace(/^data:\s*/, "");
                if (rawJson === "[DONE]") continue;

                const parsedChunk = JSON.parse(rawJson);
                const contentChunk = parsedChunk.choices?.[0]?.delta?.content;
                if (contentChunk) {
                  assistantTextAccumulator += contentChunk;
                }
              }
            }

            set((state) => {
              const currentHistory = [...state.messages];
              if (currentHistory.length > 0) {
                currentHistory[currentHistory.length - 1] = {
                  ...currentHistory[currentHistory.length - 1],
                  content: assistantTextAccumulator,
                  timestamp: Date.now(),
                };
              }
              return { messages: currentHistory };
            });
          } catch (e) {}
        }
      }

      set({ isLoading: false, abortController: null });

      const sessionMatch = get().sessions.find(
        (s) => s.id === currentSessionId,
      );
      if (sessionMatch) {
        const finalSessionRecord = {
          ...sessionMatch,
          messages: get().messages,
          updatedAt: Date.now(),
        };
        await saveSession(finalSessionRecord);
        await get().loadSessionsFromStorage();
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("Checkpoint regeneration loop gracefully halted.");
      } else {
        console.error("Context regeneration failed:", error);
        set({ isLoading: false, abortController: null });
      }
    }
  },
}));
