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

export interface EngineSettings {
  baseUrl: string;
  provider: "ollama" | "lm-studio" | "openai-compatible";
  encryptedApiKey?: string;
}

interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  model: string;
  availableModels: string[];
  settings: EngineSettings;

  fetchModels: () => Promise<void>;
  setModel: (model: string) => void;
  updateSettings: (
    newSettings: EngineSettings,
    rawKey?: string,
  ) => Promise<void>;

  createNewSession: () => void;
  selectSession: (id: string) => void;
  deleteSession: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  loadSessionsFromStorage: () => Promise<void>;
}

const DEFAULT_SETTINGS: EngineSettings = {
  baseUrl: "http://localhost:11434",
  provider: "ollama",
  encryptedApiKey: "",
};

// Retrieve bootstrap settings from LocalStorage safely
const getInitialSettings = (): EngineSettings => {
  const local = localStorage.getItem("promptly_engine_settings");
  if (!local) return DEFAULT_SETTINGS;
  try {
    return JSON.parse(local);
  } catch {
    return DEFAULT_SETTINGS;
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

  updateSettings: async (newSettings: EngineSettings, rawKey?: string) => {
    let encryptedApiKey = newSettings.encryptedApiKey || "";

    // If a new raw string key was updated explicitly inside the UI form, encrypt it
    if (rawKey !== undefined) {
      encryptedApiKey = rawKey ? await encryptKey(rawKey) : "";
    }

    const updatedSettings = { ...newSettings, encryptedApiKey };
    localStorage.setItem(
      "promptly_engine_settings",
      JSON.stringify(updatedSettings),
    );
    set({ settings: updatedSettings, availableModels: [], model: "" });

    // Flush and pull fresh engine rosters based on new configurations
    await get().fetchModels();
  },

  fetchModels: async () => {
    const { settings } = get();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (settings.encryptedApiKey) {
      const activeKey = await decryptKey(settings.encryptedApiKey);
      if (activeKey) headers["Authorization"] = `Bearer ${activeKey}`;
    }

    try {
      // Ollama Tag Route Engine Check
      if (settings.provider === "ollama") {
        const response = await fetch(`${settings.baseUrl}/api/tags`, {
          headers,
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        const models = data.models.map((m: any) => m.name);
        set({ availableModels: models });
      } else {
        // Standard OpenAI compliance endpoints (LM Studio, Local AI, Open-Router)
        const response = await fetch(`${settings.baseUrl}/v1/models`, {
          headers,
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        const models = data.data.map((m: any) => m.id);
        set({ availableModels: models });
      }

      const models = get().availableModels;
      if (models.length > 0 && !get().model) {
        set({ model: models[0] });
      }
    } catch (err) {
      console.error(
        "Could not fetch models for current provider settings configuration.",
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
    set({ currentSessionId: null, messages: [], isLoading: false });
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

  sendMessage: async (content: string) => {
    const { model, messages, isLoading, currentSessionId, settings } = get();
    if (!model || isLoading || !content.trim()) return;

    let sessionId = currentSessionId || crypto.randomUUID();
    const isBrandNewSession = !currentSessionId;

    const newUserMessage: ChatMessage = {
      role: "user",
      content,
      timestamp: Date.now(),
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
        { role: "assistant", content: "", timestamp: Date.now() },
      ],
      updatedAt: Date.now(),
    };

    set({
      currentSessionId: sessionId,
      messages: transientSessionRecord.messages,
      isLoading: true,
    });

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (settings.encryptedApiKey) {
        const activeKey = await decryptKey(settings.encryptedApiKey);
        if (activeKey) headers["Authorization"] = `Bearer ${activeKey}`;
      }

      const isOllama = settings.provider === "ollama";
      const targetUrl = isOllama
        ? `${settings.baseUrl}/api/chat`
        : `${settings.baseUrl}/v1/chat/completions`;

      const standardPayload = isOllama
        ? {
            model,
            messages: updatedMessagesWithUser.map(({ role, content }) => ({
              role,
              content,
            })),
            stream: true,
          }
        : {
            model,
            messages: updatedMessagesWithUser.map(({ role, content }) => ({
              role,
              content,
            })),
            stream: true,
          };

      const response = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(standardPayload),
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
              // Extract data from classic OpenAI Event Streams ("data: {...}")
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
                  role: "assistant",
                  content: assistantTextAccumulator,
                  timestamp: Date.now(),
                };
              }
              return { messages: currentHistory };
            });
          } catch (e) {}
        }
      }

      set({ isLoading: false });
      const finalSessionRecord: ChatSession = {
        id: sessionId,
        title: initialTitle,
        model,
        messages: get().messages,
        updatedAt: Date.now(),
      };

      await saveSession(finalSessionRecord);
      await get().loadSessionsFromStorage();
    } catch (error) {
      console.error("Local inference execution failed:", error);
      set({ isLoading: false });
    }
  },
}));
