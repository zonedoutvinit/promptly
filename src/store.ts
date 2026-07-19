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
import { searchWeb } from "./service/webSearch";

export type SearchStatus = "idle" | "searching" | "completed" | "error";

export interface Message {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  isPinned?: boolean;
}

export type ProviderType =
  "ollama" | "lm-studio" | "openai-compatible" | "gemini";

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
  // Keyed map tracking concurrent background stream terminations cleanly
  abortControllers: Record<string, AbortController>;

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
  // Accepts an optional specific sessionId to halt background updates
  stopGeneration: (id?: string) => void;
  loadSessionsFromStorage: () => Promise<void>;
  toggleMessagePin: (index: number) => Promise<void>;
  toggleMessagePrune: (index: number) => Promise<void>;
  getContextWindowLimit: () => number;

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

  isFetchingModels: boolean;
  providerError: string | null;
  testProviderConnection: (
    provider: ProviderType,
  ) => Promise<{ success: boolean; message: string }>;

  // Search Config State
  search: {
    enabled: boolean;
    maxResults: number;
    status: SearchStatus;
  };
  // Actions
  setSearchEnabled: (enabled: boolean) => void;
  setSearchMaxResults: (count: number) => void;
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

// ================= ADVANCED TELEMETRY PAYLOAD COMPILER =================
const compileTelemetryPayload = (
  messages: ChatMessage[],
  webContext?: string,
) => {
  // 1. Unified Thinking System Framework
  // Replacing persona-specific prompts with a structural directive for the model
  const systemContextFrame = [
    {
      role: "system" as const,
      content:
        "You are an expert AI assistant. Provide precise, technical answers using clear Markdown hierarchy. Be direct, minimize conversational filler, and strictly follow all user constraints.",
    },
  ];

  // --- NEW WEB SEARCH CONTEXT PACKAGING ---
  const webSearchFrame = webContext
    ? [
        {
          role: "system" as const,
          content: webContext,
        },
      ]
    : [];

  // 2. Pinned Context De-duplication Logic (remains unchanged)
  const pinnedMessages = messages.filter(
    (msg) => msg.isPinned && !msg.isPruned,
  );
  const uniquePinnedMap = new Map<string, ChatMessage>();

  pinnedMessages.forEach((msg) => {
    // Generate a localized string footprint signature (first 50 chars normalized)
    const fingerprint = msg.content
      .slice(0, 50)
      .toLowerCase()
      .replace(/\s+/g, "")
      .trim();
    // Overwrite earlier matches to guarantee retention of freshest context versions
    uniquePinnedMap.set(fingerprint, msg);
  });

  const MAX_ALLOWED_PINS = 5;
  const compiledPinnedContext = Array.from(uniquePinnedMap.values())
    .slice(-MAX_ALLOWED_PINS)
    .map((msg) => ({
      role: "system" as const,
      content: `[STATIC ANCHOR CONTEXT - ORIGINAL ROLE: ${msg.role.toUpperCase()}]\n${msg.content}\n[END ANCHOR]`,
    }));

  // 3. Fluid Conversational Extraction (remains unchanged)
  const conversationalHistory = messages.filter(
    (msg) => !msg.isPinned && !msg.isPruned,
  );
  const explicitHistoryTurnLimit = 8;
  const MAX_CONVERSATIONAL_CHAR_LIMIT = 8000;

  const compiledHistoryContext = conversationalHistory
    .slice(-explicitHistoryTurnLimit)
    .map(({ role, content }) => {
      // Prevent giant trace logs or large copy-pastes from crashing local context budgets
      if (content.length > MAX_CONVERSATIONAL_CHAR_LIMIT) {
        const head = content.slice(0, 2500);
        const tail = content.slice(-2500);
        const managedContent = `${head}\n\n[... TELEMETRY NOTICE: Data stream center-truncated ...]\n\n${tail}`;
        return { role, content: managedContent };
      }
      return { role, content };
    });

  // 4. Dynamic Recency Behavioral Reminder
  if (compiledHistoryContext.length >= explicitHistoryTurnLimit) {
    compiledHistoryContext.splice(compiledHistoryContext.length - 1, 0, {
      role: "system" as const,
      content: `[RECALL: Continue analyzing your response with logical, step-by-step reasoning.]`,
    });
  }

  // 5. Build Unified Execution Payload Array
  // Order: System Prompt -> Web Search Context -> Pinned Messages -> Conversation History
  return [
    ...systemContextFrame,
    ...webSearchFrame,
    ...compiledPinnedContext,
    ...compiledHistoryContext,
  ];
};

interface StreamingConfig {
  sessionId: string;
  historyForTelemetry: ChatMessage[];
  controller: AbortController;
  get: () => any;
  set: (fn: (state: any) => any) => void;
  overrides?: Record<string, any>;
  webContext?: string;
}

const executeStreamingInference = async ({
  sessionId,
  historyForTelemetry,
  controller,
  get,
  set,
  overrides,
  webContext,
}: StreamingConfig) => {
  const { model, settings } = get();
  const provider = settings.currentProvider;
  const config = settings.providers[provider];

  try {
    // 1. Setup Request Authorization & Routing
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (config.encryptedApiKey) {
      const activeKey = await decryptKey(config.encryptedApiKey);
      if (activeKey) headers["Authorization"] = `Bearer ${activeKey}`;
    }

    const isOllama = provider === "ollama";
    const isGemini = provider === "gemini";
    const targetUrl = isOllama
      ? `${config.baseUrl}/api/chat`
      : isGemini
        ? "https://generativelanguage.googleapis.com/v1beta/openai/v1/chat/completions"
        : `${config.baseUrl}/v1/chat/completions`;

    // 2. Assemble Provider-Specific Payloads
    const payload: Record<string, any> = {
      model,
      messages: compileTelemetryPayload(historyForTelemetry, webContext),
      stream: true,
    };

    if (overrides) {
      if (isOllama) {
        payload.options = {
          temperature: overrides.temperature,
          top_p: overrides.topP,
          frequency_penalty: overrides.frequencyPenalty,
          presence_penalty: overrides.presencePenalty,
        };
      } else {
        payload.temperature = overrides.temperature;
        payload.top_p = overrides.topP;
        if (!isGemini) {
          payload.frequency_penalty = overrides.frequencyPenalty;
          payload.presence_penalty = overrides.presencePenalty;
        }
      }
    }

    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok || !response.body)
      throw new Error("Engine generation failure");

    // 3. Process Stream Reader Loop
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let textAccumulator = "";
    let thinkingAccumulator = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value, { stream: true }).split("\n");

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          let hasUpdate = false;
          if (isOllama) {
            const parsed = JSON.parse(trimmed);
            if (parsed.message?.content) {
              textAccumulator += parsed.message.content;
              hasUpdate = true;
            }
            if (parsed.message?.thinking) {
              thinkingAccumulator += parsed.message.thinking;
              hasUpdate = true;
            }
            if (!hasUpdate) continue;
          } else {
            if (!trimmed.startsWith("data: ")) continue;
            const rawJson = trimmed.replace(/^data:\s*/, "");
            if (rawJson === "[DONE]") continue;

            const contentChunk =
              JSON.parse(rawJson).choices?.[0]?.delta?.content;
            if (contentChunk) textAccumulator += contentChunk;
          }

          // Centralized reactive state projection
          set((state) => {
            const updatedSessions = state.sessions.map((s: ChatSession) => {
              if (s.id !== sessionId) return s;
              const history = [...s.messages];
              if (history.length > 0) {
                history[history.length - 1] = {
                  ...history[history.length - 1],
                  content: textAccumulator,
                  thinking: thinkingAccumulator,
                  timestamp: Date.now(),
                  isPinned: false,
                  isPruned: false,
                };
              }
              return { ...s, messages: history, updatedAt: Date.now() };
            });

            return {
              sessions: updatedSessions,
              messages:
                state.currentSessionId === sessionId
                  ? updatedSessions.find((s: ChatSession) => s.id === sessionId)
                      ?.messages || state.messages
                  : state.messages,
            };
          });
        } catch {
          /* Silent resilience for partial chunks */
        }
      }
    }

    // 4. Persistence Termination Sync
    const matchedSession = get().sessions.find(
      (s: ChatSession) => s.id === sessionId,
    );
    if (matchedSession) {
      await saveSession({ ...matchedSession, updatedAt: Date.now() });
      await get().loadSessionsFromStorage();
    }
  } catch (error: any) {
    console.log(
      error.name === "AbortError"
        ? "Stream connection client terminated."
        : `Pipeline failure: ${error}`,
    );
  } finally {
    // 5. Atomic Global Cleanup Guarantee
    set((state) => {
      const controllers = { ...state.abortControllers };
      delete controllers[sessionId];
      return {
        abortControllers: controllers,
        ...(state.currentSessionId === sessionId ? { isLoading: false } : {}),
      };
    });
  }
};

const formatSearchResults = (
  results: Array<{ title: string; snippet: string; url: string }>,
): string => {
  let contextString = "You have access to recent web search results.\n";
  contextString += "Use them only if they help answer the user's request.\n";
  contextString +=
    "If they conflict with your internal knowledge, mention the uncertainty.\n\n";
  contextString += "Web Search Results\n\n";

  results.forEach((res, index) => {
    contextString += `Result ${index + 1}\n\n`;
    contextString += `Title: ${res.title}\n`;
    contextString += `Summary: ${res.snippet}\n`;
    contextString += `URL: ${res.url}\n`;
    if (index < results.length - 1) {
      contextString += "\n-------------------\n\n";
    }
  });

  return contextString;
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
  abortControllers: {},
  isFetchingModels: false,
  providerError: null,

  search: {
    enabled: false,
    maxResults: 3,
    status: "idle",
  },

  setSearchEnabled: (enabled) =>
    set((state) => ({ search: { ...state.search, enabled } })),

  setSearchMaxResults: (maxResults) =>
    set((state) => ({ search: { ...state.search, maxResults } })),

  stopGeneration: (id?: string) => {
    const { abortControllers, currentSessionId, sessions } = get();
    const targetId = id || currentSessionId;
    if (!targetId) return;

    const controller = abortControllers[targetId];
    if (controller) {
      controller.abort();

      const match = sessions.find((s) => s.id === targetId);
      const activeTitle = match?.title || "Active Discussion";

      const finalSessionRecord: ChatSession = {
        id: targetId,
        title: activeTitle,
        model: match?.model || get().model,
        messages: match?.messages || [],
        updatedAt: Date.now(),
      };

      saveSession(finalSessionRecord).then(() =>
        get().loadSessionsFromStorage(),
      );

      set((state) => {
        const newControllers = { ...state.abortControllers };
        delete newControllers[targetId];

        return {
          abortControllers: newControllers,
          // Only switch off loading indicator if we stopped the chat the user is actively viewing
          ...(state.currentSessionId === targetId ? { isLoading: false } : {}),
        };
      });
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

    // Clear error and reset selections cleanly
    set({
      settings: updatedSettings,
      availableModels: [],
      model: "",
      providerError: null,
    });

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

  // Add a helper selector or compute it inside your store state
  getContextWindowLimit: (): number => {
    const { model, settings } = get();

    // 1. Normalize the model string for foolproof matching
    const modelKey = (model || "").toLowerCase();
    const provider = (settings?.currentProvider || "").toLowerCase();

    // 2. Premium Cloud Provider Overrides
    if (provider === "gemini") {
      if (modelKey.includes("pro")) return 2097152; // Gemini Pro supports 2M tokens
      return 1048576; // Gemini Flash standard fallback (1M tokens)
    }
    if (provider === "openai") {
      if (modelKey.includes("gpt-4o")) return 128000;
      return 16384;
    }

    // 3. Explicit Context Window Token Overrides (Check these first!)
    if (modelKey.includes("128k")) return 128000;
    if (modelKey.includes("64k")) return 64000;
    if (modelKey.includes("32k")) return 32768;
    if (modelKey.includes("16k")) return 16384;
    if (modelKey.includes("8k")) return 8192;

    // 4. Fallback Base Architectures (Mapping parameter sizes to their default contexts)
    if (modelKey.includes("phi3") || modelKey.includes("phi-3")) {
      if (modelKey.includes("128k")) return 128000;
      return 4096; // Standard Phi-3 mini baseline
    }

    // Llama 3 / 3.1 baselines
    if (modelKey.includes("llama3") || modelKey.includes("llama-3")) {
      return 8192; // Default Llama 3 native token window cap
    }

    // Small/Tiny SLMs (Gemma 2B, Qwen 1.5B, DeepSeek 1.5B, etc.)
    if (
      modelKey.includes("1.5b") ||
      modelKey.includes("2b") ||
      modelKey.includes("gemma") ||
      modelKey.includes("qwen")
    ) {
      // Modern small models typically launch with 8k contexts natively now
      return 8192;
    }

    // 5. Ultimate baseline fallback if no keywords are matched
    return 4096;
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

    // 1. Guard clause: Don't fetch if URL is missing for non-Gemini providers
    if (
      provider !== "gemini" &&
      (!activeProviderConfig?.baseUrl ||
        activeProviderConfig.baseUrl.trim() === "")
    ) {
      set({
        availableModels: [],
        providerError: "Base URL is required for this provider.",
      });
      return;
    }

    set({ isFetchingModels: true, providerError: null });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    try {
      // ... (Your decryption logic remains the same)
      if (activeProviderConfig?.encryptedApiKey) {
        const activeKey = await decryptKey(
          activeProviderConfig.encryptedApiKey,
        );
        if (activeKey) headers["Authorization"] = `Bearer ${activeKey}`;
      }

      let targetUrl =
        provider === "gemini"
          ? "https://generativelanguage.googleapis.com/v1beta/openai/v1/models"
          : `${activeProviderConfig.baseUrl}/v1/models`;

      if (provider === "ollama")
        targetUrl = `${activeProviderConfig.baseUrl}/api/tags`;

      // 2. Fetch with validation
      const response = await fetch(targetUrl, { headers });

      // Check if the response is actually JSON before parsing
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(
          `Server returned non-JSON response (Status: ${response.status}). Check if the URL is correct.`,
        );
      }

      if (!response.ok) {
        throw new Error(
          `HTTP Error ${response.status}: Failed to reach provider.`,
        );
      }

      const data = await response.json();

      // 3. Normalize models based on provider structure
      let models: string[] = [];
      if (provider === "ollama") {
        models = data.models.map((m: any) => m.name);
      } else {
        // Handles OpenAI compatible and Gemini
        models = data.data.map((m: any) => m.id);
      }

      set({ availableModels: models });

      // Auto-select first model if none selected
      if (
        models.length > 0 &&
        (!get().model || !models.includes(get().model))
      ) {
        set({ model: models[0] });
      }
    } catch (err: any) {
      console.error("Could not fetch models:", err);
      set({
        availableModels: [],
        providerError: err.message || "Connection failed. Verify host address.",
      });
    } finally {
      set({ isFetchingModels: false });
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

  testProviderConnection: async (provider: ProviderType) => {
    const { settings } = get();
    const config = settings.providers[provider];

    if (!config) return { success: false, message: "Configuration not found." };

    // 1. URL Validation Guard
    if (
      provider !== "gemini" &&
      (!config.baseUrl || config.baseUrl.trim() === "")
    ) {
      return { success: false, message: "Base URL is required." };
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (config.encryptedApiKey) {
        const key = await decryptKey(config.encryptedApiKey);
        if (key) headers["Authorization"] = `Bearer ${key}`;
      }

      const url =
        provider === "ollama"
          ? `${config.baseUrl}/api/tags`
          : provider === "gemini"
            ? "https://generativelanguage.googleapis.com/v1beta/openai/v1/models"
            : `${config.baseUrl}/v1/models`;

      const res = await fetch(url, { method: "GET", headers });

      // 2. Validate Response Content Type (The critical fix)
      const contentType = res.headers.get("content-type");
      if (!res.ok) {
        return {
          success: false,
          message: `HTTP ${res.status}: Could not connect to ${provider}.`,
        };
      }

      if (!contentType || !contentType.includes("application/json")) {
        return {
          success: false,
          message:
            "Connection reached, but the server returned an invalid format (not JSON). Check your Base URL.",
        };
      }

      // 3. Final verification: Ensure the JSON actually contains models
      const data = await res.json();
      const hasModels = provider === "ollama" ? !!data.models : !!data.data;

      if (!hasModels) {
        return {
          success: false,
          message:
            "Connection successful, but no models found at this endpoint.",
        };
      }

      return { success: true, message: "Handshake verified successfully." };
    } catch (e: any) {
      console.error("Test connection error:", e);
      return {
        success: false,
        message:
          e.message === "Failed to fetch"
            ? "Network error: Verify the server is running and CORS is enabled."
            : e.message,
      };
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
    });
  },

  selectSession: (id: string) => {
    const target = get().sessions.find((s) => s.id === id);
    if (target) {
      set({
        currentSessionId: id,
        messages: target.messages,
        model: target.model || get().model || get().availableModels[0],
        // Evaluate loading indicator dynamically relative to this session's background status
        isLoading: !!get().abortControllers[id],
      });
    }
  },

  deleteSession: async (id: string) => {
    await deleteSessionFromDB(id);
    await get().loadSessionsFromStorage();
    if (get().currentSessionId === id) {
      set(() => ({
        currentSessionId: null,
        messages: [],
        search: {
          enabled: false,
          maxResults: 3,
          status: "idle",
        },
      }));
    }
  },

  toggleMessagePin: async (index: number) => {
    const { messages, currentSessionId, sessions } = get();
    if (!currentSessionId) return;

    const targetHistory = [...messages];
    if (!targetHistory[index]) return;

    const isAttemptingToPin = !targetHistory[index].isPinned;

    if (isAttemptingToPin) {
      // Count current unique active pins in this session
      const activePins = targetHistory.filter(
        (msg) => msg.isPinned && !msg.isPruned,
      );
      const uniquePinSignatures = new Set(
        activePins.map((msg) =>
          msg.content.slice(0, 50).toLowerCase().replace(/\s+/g, "").trim(),
        ),
      );

      if (uniquePinSignatures.size >= 5) {
        // You can substitute this with a custom toast component event trigger if your UI uses one
        alert(
          "Context Budget Limit: You can only pin up to 5 unique anchor contexts per session to prevent engine memory issues.",
        );
        return;
      }
    }

    // Decoupled: Atomically toggle ONLY this specific message target
    targetHistory[index] = {
      ...targetHistory[index],
      isPinned: isAttemptingToPin,
    };

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
    if (!targetHistory[index]) return;

    targetHistory[index] = {
      ...targetHistory[index],
      isPruned: !targetHistory[index].isPruned,
    };

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
    const { model, messages, isLoading, currentSessionId, search } = get();
    if (!model || isLoading || !content.trim()) return;

    const sessionId = currentSessionId || crypto.randomUUID();
    const controller = new AbortController();

    const updatedMessagesWithUser: ChatMessage[] = [
      ...messages,
      {
        role: "user",
        content,
        timestamp: Date.now(),
        isPinned: false,
        isPruned: false,
      },
    ];

    const initialTitle = !currentSessionId
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
          thinking: "",
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

    set((state) => ({
      currentSessionId: sessionId,
      messages: transientSessionRecord.messages,
      isLoading: true,
      abortControllers: { ...state.abortControllers, [sessionId]: controller },
    }));

    // --- NEW WEB SEARCH INTERCEPTION ---
    let injectedWebContext: string | undefined = undefined;

    if (search?.enabled) {
      set((state) => ({ search: { ...state.search, status: "searching" } }));

      try {
        // Import searchWeb service at the top of your file
        const results = await searchWeb(content, search.maxResults);

        if (results && results.length > 0) {
          injectedWebContext = formatSearchResults(results);
          set((state) => ({
            search: { ...state.search, status: "completed" },
          }));
        } else {
          set((state) => ({ search: { ...state.search, status: "idle" } }));
        }
      } catch (searchError) {
        // Soft fail: log error but guarantee prompt inference remains unblocked
        console.error(
          "Context Injection RAG failed, proceeding gracefully:",
          searchError,
        );
        set((state) => ({ search: { ...state.search, status: "error" } }));
      }
    }

    // Hand off execution cleanly, adding webContext to the parameters
    await executeStreamingInference({
      sessionId,
      historyForTelemetry: updatedMessagesWithUser,
      controller,
      get,
      set,
      webContext: injectedWebContext,
    });
  },

  onUpdateUserMessage: async (index: number, newContent: string) => {
    const { model, messages, isLoading, currentSessionId } = get();
    if (isLoading || !newContent.trim() || !currentSessionId) return;

    // 1. Guard rails: Ensure we are safely targeting a user message
    const targetUserIdx = messages[index].role === "user" ? index : index - 1;
    if (targetUserIdx < 0 || messages[targetUserIdx].role !== "user") return;

    const controller = new AbortController();
    const sessionId = currentSessionId;

    // 2. Truncate history *before* the edited message, then append the replacement content
    const cleanHistory = messages.slice(0, targetUserIdx);
    const newUserMessage: ChatMessage = {
      role: "user",
      content: newContent,
      timestamp: Date.now(),
      isPinned: false,
      isPruned: false,
    };
    const updatedMessagesWithUser = [...cleanHistory, newUserMessage];

    const transientSessionRecord: ChatSession = {
      id: sessionId,
      title:
        get().sessions.find((s) => s.id === sessionId)?.title ||
        "Active Discussion",
      model,
      messages: [
        ...updatedMessagesWithUser,
        {
          role: "assistant",
          content: "",
          thinking: "",
          timestamp: Date.now(),
          isPinned: false,
          isPruned: false,
        },
      ],
      updatedAt: Date.now(),
    };

    // 3. Perform I/O operations *before* switching state to eliminate layout flashing
    await saveSession(transientSessionRecord);
    await get().loadSessionsFromStorage();

    set((state) => {
      const updatedSessions = state.sessions.map((s) =>
        s.id === sessionId ? transientSessionRecord : s,
      );
      return {
        messages: transientSessionRecord.messages,
        sessions: updatedSessions,
        isLoading: true,
        abortControllers: {
          ...state.abortControllers,
          [sessionId]: controller,
        },
      };
    });

    // 4. Hand off directly to our core streaming orchestration pipeline
    await executeStreamingInference({
      sessionId,
      historyForTelemetry: updatedMessagesWithUser,
      controller,
      get,
      set,
    });
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
    const { model, messages, isLoading, currentSessionId } = get();
    if (!model || isLoading || !currentSessionId) return;

    const targetUserIdx = messages[index].role === "user" ? index : index - 1;
    if (targetUserIdx < 0 || messages[targetUserIdx].role !== "user") return;

    // Truncate the thread history right after the user's setup prompt
    const controller = new AbortController();
    const cleanHistory = messages.slice(0, targetUserIdx + 1);

    // Explicit closure lock for background checkpoint loop
    const sessionId = currentSessionId;

    const streamingHistory: ChatMessage[] = [
      ...cleanHistory,
      {
        role: "assistant",
        content: "",
        thinking: "",
        timestamp: Date.now(),
        isPinned: false,
        isPruned: false,
        ...overrides,
      },
    ];

    set((state) => {
      const updatedSessions = state.sessions.map((s) =>
        s.id === sessionId
          ? { ...s, messages: streamingHistory, updatedAt: Date.now() }
          : s,
      );
      return {
        messages: streamingHistory,
        sessions: updatedSessions,
        isLoading: true,
        abortControllers: {
          ...state.abortControllers,
          [sessionId]: controller,
        },
      };
    });

    // Hand off execution cleanly with structural configurations overrides
    await executeStreamingInference({
      sessionId,
      historyForTelemetry: cleanHistory,
      controller,
      get,
      set,
      overrides,
    });
  },
}));
