// src/store.ts
import { create } from "zustand";
import {
  formatRetrievedContext,
  indexRagDocument,
  retrieveRelevantChunks,
} from "./rag/retriever";
import { searchWeb } from "./service/webSearch";
import { decryptKey, encryptKey } from "./utils/crypto";
import {
  deleteArtifactFromDB,
  deleteRagDocumentFromDB,
  deleteSessionFromDB,
  getAllSessions,
  getArtifactsBySession,
  getRagDocumentsForContext,
  saveArtifact,
  saveSession,
} from "./utils/db";
import { stripHallucinatedArtifactTags } from "./utils/streamSanitizers";
import {
  ArtifactVersion,
  ChatMessage,
  ChatSession,
  EngineSettings,
  HighlightedCitation,
  ProviderConfig,
  ProviderType,
  RagCitation,
  SearchStatus,
  SelectionRange,
  StreamingConfig,
  SystemProfile,
  WorkspaceArtifact,
  WorkspaceLanguage,
  WorkspacePayloadContext,
} from "./types";

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

  workspaceEnabled: boolean;
  artifacts: WorkspaceArtifact[];
  activeArtifactId: string | null;
  activeWorkspaceSelection: SelectionRange | null;

  setWorkspaceEnabled: (enabled: boolean) => void;
  setActiveArtifact: (id: string | null) => void;
  setActiveWorkspaceSelection: (selection: SelectionRange | null) => void;
  loadArtifactsForSession: (sessionId: string) => Promise<void>;
  createWorkspaceArtifact: (
    title?: string,
    language?: string,
    content?: string,
    source?: "user" | "assistant" | "preprocess",
  ) => Promise<WorkspaceArtifact | null>;
  updateWorkspaceArtifact: (updated: WorkspaceArtifact) => Promise<void>;
  deleteWorkspaceArtifact: (id: string) => Promise<void>;
  buildWorkspacePromptContext: (userPrompt: string) => {
    systemDirective: string | undefined;
    enrichedUserPrompt: string;
  };
  applyModelWorkspaceOutput: (
    rawAssistantText: string,
    userPrompt?: string,
  ) => Promise<{
    cleanedChatText: string;
    appliedCount: number;
    failedPatches: number;
  }>;
  highlightedCitation: HighlightedCitation | null;
  clearHighlightedCitation: () => void;
  openRagCitationInCanvas: (
    citationIndex: number,
    messageIndex?: number,
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

// ================= ADVANCED TELEMETRY PAYLOAD COMPILER =================
const DEFAULT_SYSTEM_PROMPT =
  "You are an expert AI assistant. Provide precise, technical answers using clear Markdown hierarchy. Be direct, minimize conversational filler, and strictly follow all user constraints.";

const compileTelemetryPayload = (
  messages: ChatMessage[],
  webContext?: string,
  workspaceContext?: WorkspacePayloadContext,
) => {
  const isWorkspaceActive = Boolean(workspaceContext?.enabled);

  // 1. Replace default system prompt when Workspace Mode is active
  const systemContent = isWorkspaceActive
    ? workspaceContext?.systemDirective || DEFAULT_SYSTEM_PROMPT
    : DEFAULT_SYSTEM_PROMPT;

  const systemContextFrame = [
    {
      role: "system" as const,
      content: systemContent,
    },
  ];

  // 2. Web Search Context Packaging
  const webSearchFrame = webContext
    ? [
        {
          role: "system" as const,
          content: webContext,
        },
      ]
    : [];

  // 3. Pinned Context De-duplication Logic
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

  // 4. Fluid Conversational Extraction
  const conversationalHistory = messages.filter(
    (msg) => !msg.isPinned && !msg.isPruned,
  );
  const explicitHistoryTurnLimit = 8;
  const MAX_CONVERSATIONAL_CHAR_LIMIT = 8000;

  const compiledHistoryContext = conversationalHistory
    .slice(-explicitHistoryTurnLimit)
    .map(({ role, content }, index, arr) => {
      let preparedContent = content;

      if (preparedContent.length > MAX_CONVERSATIONAL_CHAR_LIMIT) {
        const head = preparedContent.slice(0, 2500);
        const tail = preparedContent.slice(-2500);
        preparedContent = `${head}\n\n[... TELEMETRY NOTICE: Data stream center-truncated ...]\n\n${tail}`;
      }

      // Enrich ONLY the latest user message with active workspace file/selection context
      const isLastMessage = index === arr.length - 1;
      if (isWorkspaceActive && isLastMessage && role === "user") {
        const file = workspaceContext?.activeFile;
        if (file) {
          const selectionPart = workspaceContext?.selection
            ? `\n[USER SELECTED LINES ${workspaceContext.selection.startLine}-${workspaceContext.selection.endLine}]:\n\`\`\`${file.language}\n${workspaceContext.selection.selectedText}\n\`\`\`\n`
            : "";

          preparedContent = `[ACTIVE WORKSPACE FILE: "${file.title}" | Language: ${file.language}]\n\`\`\`${file.language}\n${file.content}\n\`\`\`${selectionPart}\nUser Request: ${preparedContent}`;
        } else {
          preparedContent = `[WORKSPACE MODE: No active file open yet. Create one with <artifact_create>.]\n\nUser Request: ${preparedContent}`;
        }
      }

      return { role, content: preparedContent };
    });

  // 5. Dynamic Recency Behavioral Reminder (skip in Workspace Mode so XML formatting isn't distracted)
  if (
    !isWorkspaceActive &&
    compiledHistoryContext.length >= explicitHistoryTurnLimit
  ) {
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

// Helper to build WorkspacePayloadContext from store state
const getWorkspacePayloadContext = (
  get: () => any,
): WorkspacePayloadContext => {
  const state = get();
  const enabled = Boolean(state.workspaceEnabled);
  if (!enabled) {
    return { enabled: false };
  }

  const artifacts: WorkspaceArtifact[] = state.artifacts || [];
  const activeArtifact =
    artifacts.find((a) => a.id === state.activeArtifactId) ||
    artifacts[0] ||
    null;

  return {
    enabled: true,
    systemDirective: WORKSPACE_SYSTEM_DIRECTIVE,
    activeFile: activeArtifact
      ? {
          title: activeArtifact.title,
          language: activeArtifact.language,
          content: activeArtifact.content,
        }
      : null,
    selection: state.activeWorkspaceSelection || null,
  };
};

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

  let wasAborted = false;

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

    // 2. Assemble Provider-Specific Payloads (with Workspace Context)
    const workspaceContext = getWorkspacePayloadContext(get);

    const payload: Record<string, any> = {
      model,
      messages: compileTelemetryPayload(
        historyForTelemetry,
        webContext,
        workspaceContext,
      ),
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
            if (contentChunk) {
              textAccumulator += contentChunk;
              hasUpdate = true;
            }
            if (!hasUpdate) continue;
          }

          // Centralized reactive state projection
          set((state) => {
            const updatedSessions = state.sessions.map((s: ChatSession) => {
              if (s.id !== sessionId) return s;
              const history = [...s.messages];
              if (history.length > 0) {
                const existingLast = history[history.length - 1];
                history[history.length - 1] = {
                  ...existingLast,
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

    // 4. Post-Stream Workspace Artifact / Patch Application
    let finalAssistantContent = textAccumulator;
    let artifactSummary: string | undefined;

    const latestUserPrompt =
      [...historyForTelemetry].reverse().find((m) => m.role === "user")
        ?.content || "";

    if (
      workspaceContext.enabled &&
      typeof get().applyModelWorkspaceOutput === "function" &&
      textAccumulator.trim()
    ) {
      const { cleanedChatText, appliedCount, failedPatches } =
        await get().applyModelWorkspaceOutput(
          textAccumulator,
          latestUserPrompt,
        );

      if (appliedCount > 0 || failedPatches > 0) {
        finalAssistantContent = cleanedChatText;

        const currentArtifacts = get().artifacts;
        const latestActive =
          currentArtifacts.find(
            (a: WorkspaceArtifact) => a.id === get().activeArtifactId,
          ) || currentArtifacts[currentArtifacts.length - 1];

        // Immediately sync artifacts & activeArtifactId so Canvas holds the committed item
        if (appliedCount > 0 && latestActive) {
          set((state) => ({
            artifacts:
              state.artifacts.length > 0 ? state.artifacts : currentArtifacts,
            activeArtifactId: latestActive.id,
            workspaceEnabled: true,
          }));
        }

        if (appliedCount > 0 && failedPatches === 0) {
          artifactSummary = latestActive
            ? `${latestActive.title} (v${latestActive.currentVersion})`
            : `Applied ${appliedCount} workspace update(s)`;
        } else if (appliedCount > 0 && failedPatches > 0) {
          artifactSummary = `${appliedCount} applied, ${failedPatches} search mismatch`;
        } else {
          artifactSummary = `Patch search didn't match file`;
        }
      }
    }

    // 5. Persistence Termination Sync
    const matchedSession = get().sessions.find(
      (s: ChatSession) => s.id === sessionId,
    );

    if (matchedSession) {
      const finalizedMessages = [...matchedSession.messages];
      if (finalizedMessages.length > 0) {
        const previousAssistant =
          finalizedMessages[finalizedMessages.length - 1];
        finalizedMessages[finalizedMessages.length - 1] = {
          ...previousAssistant,
          content: finalAssistantContent,
          thinking: thinkingAccumulator,
          citations: previousAssistant.citations,
          ...(artifactSummary ? { artifactSummary } : {}),
          timestamp: Date.now(),
        };
      }

      const finalSessionRecord: ChatSession = {
        ...matchedSession,
        messages: finalizedMessages,
        updatedAt: Date.now(),
      };

      const preservedArtifacts = get().artifacts;
      const preservedActiveId = get().activeArtifactId;

      await saveSession(finalSessionRecord);
      await get().loadSessionsFromStorage();

      set((state) => ({
        messages:
          state.currentSessionId === sessionId
            ? finalizedMessages
            : state.messages,
        artifacts:
          state.artifacts.length > 0 ? state.artifacts : preservedArtifacts,
        activeArtifactId: state.activeArtifactId ?? preservedActiveId,
      }));
    }
  } catch (error: any) {
    if (error?.name === "AbortError") {
      wasAborted = true;
      console.log("Stream connection client terminated.");
    } else {
      console.log(`Pipeline failure: ${error}`);
    }
  } finally {
    // 6. Atomic Global Cleanup Guarantee
    set((state) => {
      const controllers = { ...state.abortControllers };
      delete controllers[sessionId];
      return {
        abortControllers: controllers,
        ...(state.currentSessionId === sessionId ? { isLoading: false } : {}),
      };
    });
    void wasAborted;
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

const WORKSPACE_SYSTEM_DIRECTIVE = `You are in Workspace Mode. Put file code/text inside XML tags, and put only a 1-sentence note outside.

To create a new file, follow this exact format:
<artifact_create title="example.py" language="python">
def greet(name: str) -> str:
    return f"Hello, {name}"
</artifact_create>
Created example.py with a greeting helper.

To edit the active file, output only exact search/replace patches:
<artifact_patch>
<search>
def greet(name: str) -> str:
    return f"Hello, {name}"
</search>
<replace>
def greet(name: str, excited: bool = False) -> str:
    suffix = "!" if excited else ""
    return f"Hello, {name}{suffix}"
</replace>
</artifact_patch>
Updated greet to support an optional exclamation mark.`;

// Helper: Match <search> block with exact match first, then whitespace-normalized fallback
function applySearchReplacePatch(
  sourceContent: string,
  searchBlock: string,
  replaceBlock: string,
): { nextContent: string; matched: boolean } {
  const normalizedSearch = searchBlock.replace(/\r\n/g, "\n");
  const normalizedReplace = replaceBlock.replace(/\r\n/g, "\n");
  const normalizedSource = sourceContent.replace(/\r\n/g, "\n");

  // Pass 1: Exact match
  if (normalizedSource.includes(normalizedSearch)) {
    return {
      nextContent: normalizedSource.replace(
        normalizedSearch,
        normalizedReplace,
      ),
      matched: true,
    };
  }

  // Pass 2: Line-trimmed match (helps 2B models with minor indentation/trailing space drift)
  const searchLines = normalizedSearch.split("\n");
  const sourceLines = normalizedSource.split("\n");
  const replaceLines = normalizedReplace.split("\n");

  if (searchLines.length > 0 && searchLines.every((l) => l.trim() === "")) {
    return { nextContent: sourceContent, matched: false };
  }

  for (
    let startIdx = 0;
    startIdx <= sourceLines.length - searchLines.length;
    startIdx++
  ) {
    let allMatch = true;
    for (let offset = 0; offset < searchLines.length; offset++) {
      if (
        sourceLines[startIdx + offset].trim() !== searchLines[offset].trim()
      ) {
        allMatch = false;
        break;
      }
    }

    if (allMatch) {
      // Preserve base indentation of first matched line if replace starts cleanly
      const baseIndent = sourceLines[startIdx].match(/^\s*/)?.[0] || "";
      const adjustedReplace = replaceLines.map((line, idx) => {
        if (idx === 0 && !/^\s/.test(line) && baseIndent) {
          return baseIndent + line;
        }
        return line;
      });

      const updatedLines = [
        ...sourceLines.slice(0, startIdx),
        ...adjustedReplace,
        ...sourceLines.slice(startIdx + searchLines.length),
      ];

      return {
        nextContent: updatedLines.join("\n"),
        matched: true,
      };
    }
  }

  return { nextContent: sourceContent, matched: false };
}

export const normalizeWorkspaceLanguage = (
  lang?: string,
): WorkspaceLanguage => {
  switch ((lang || "").trim().toLowerCase()) {
    case "python":
    case "py":
      return "python";
    case "typescript":
    case "ts":
      return "typescript";
    case "tsx":
      return "tsx";
    case "javascript":
    case "js":
      return "javascript";
    case "jsx":
      return "jsx";
    case "html":
      return "html";
    case "css":
      return "css";
    case "json":
      return "json";
    case "sql":
      return "sql";
    case "bash":
    case "sh":
    case "shell":
      return "bash";
    case "rust":
    case "rs":
      return "rust";
    case "go":
      return "go";
    default:
      return "markdown";
  }
};

const getExtensionForLanguage = (lang: string): string => {
  switch (lang.toLowerCase()) {
    case "python":
    case "py":
      return "py";
    case "typescript":
    case "ts":
      return "ts";
    case "tsx":
      return "tsx";
    case "javascript":
    case "js":
      return "js";
    case "jsx":
      return "jsx";
    case "html":
      return "html";
    case "css":
      return "css";
    case "json":
      return "json";
    case "sql":
      return "sql";
    case "bash":
    case "sh":
    case "shell":
      return "sh";
    case "rust":
    case "rs":
      return "rs";
    case "go":
      return "go";
    default:
      return "md";
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
  abortControllers: {},
  isFetchingModels: false,
  providerError: null,
  highlightedCitation: null,
  clearHighlightedCitation: () => set({ highlightedCitation: null }),

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

    // 1. Decrypt API Key if present
    const rawApiKey = activeProviderConfig?.encryptedApiKey
      ? await decryptKey(activeProviderConfig.encryptedApiKey)
      : "";

    // 2. Provider-specific validation guards
    if (provider === "gemini" && (!rawApiKey || rawApiKey.trim() === "")) {
      set({
        availableModels: [],
        providerError: "API key is required for Google Gemini.",
        isFetchingModels: false,
      });
      return;
    }

    if (
      provider !== "gemini" &&
      (!activeProviderConfig?.baseUrl ||
        activeProviderConfig.baseUrl.trim() === "")
    ) {
      set({
        availableModels: [],
        providerError: "Base URL is required for this provider.",
        isFetchingModels: false,
      });
      return;
    }

    set({ isFetchingModels: true, providerError: null });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    try {
      let targetUrl = "";

      if (provider === "gemini") {
        targetUrl = "https://generativelanguage.googleapis.com/v1beta/models";
        headers["x-goog-api-key"] = rawApiKey;
      } else if (provider === "ollama") {
        // Ollama does not need Bearer auth headers by default
        targetUrl = `${activeProviderConfig.baseUrl.replace(/\/$/, "")}/api/tags`;
      } else {
        // Standard OpenAI-compatible endpoints
        if (rawApiKey) {
          headers["Authorization"] = `Bearer ${rawApiKey}`;
        }
        targetUrl = `${activeProviderConfig.baseUrl.replace(/\/$/, "")}/v1/models`;
      }

      const response = await fetch(targetUrl, { headers });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(
          `Server returned non-JSON response (Status: ${response.status}). Check if your Base URL is correct.`,
        );
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(
          errorBody.error?.message ||
            `HTTP Error ${response.status}: Failed to reach provider endpoint.`,
        );
      }

      const data = await response.json();

      let models: string[] = [];
      if (provider === "ollama") {
        models = data.models?.map((m: any) => m.name) || [];
      } else {
        const rawList = Array.isArray(data.data)
          ? data.data
          : Array.isArray(data.models)
            ? data.models
            : [];

        models = rawList
          .map((m: any) => {
            const rawId = m.id || m.name || "";
            return rawId.replace(/^models\//, "");
          })
          .filter((id: string) => {
            if (!id) return false;

            if (provider === "gemini") {
              const lower = id.toLowerCase();
              const isNonLLM =
                lower.includes("embedding") ||
                lower.includes("imagen") ||
                lower.includes("image") ||
                lower.includes("robotics") ||
                lower.includes("computer-use") ||
                lower.includes("live") ||
                lower.includes("streaming") ||
                lower.includes("translate") ||
                lower.includes("tts") ||
                lower.includes("whisper") ||
                lower.includes("audio") ||
                lower.includes("aqa") ||
                lower.includes("veo");

              const isLLM =
                lower.startsWith("gemini") || lower.startsWith("gemma");

              return isLLM && !isNonLLM;
            }

            return true;
          });
      }

      set({ availableModels: models });

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

    const rawKey = config.encryptedApiKey
      ? await decryptKey(config.encryptedApiKey)
      : "";

    if (provider === "gemini" && (!rawKey || rawKey.trim() === "")) {
      return {
        success: false,
        message: "API key is required for Google Gemini.",
      };
    }

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

      let url = "";
      if (provider === "gemini") {
        url = "https://generativelanguage.googleapis.com/v1beta/models";
        headers["x-goog-api-key"] = rawKey;
      } else if (provider === "ollama") {
        url = `${config.baseUrl.replace(/\/$/, "")}/api/tags`;
      } else {
        if (rawKey) headers["Authorization"] = `Bearer ${rawKey}`;
        url = `${config.baseUrl.replace(/\/$/, "")}/v1/models`;
      }

      const res = await fetch(url, { method: "GET", headers });

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
            "Connection reached, but server returned an invalid format (not JSON).",
        };
      }

      const data = await res.json();
      const hasModels =
        provider === "ollama" ? !!data.models : !!data.data || !!data.models;

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
            ? "Network error: Verify Ollama is running and CORS is enabled."
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
      // If the session has a model saved, use it; otherwise fallback safely
      const sessionModel =
        target.model || get().model || get().availableModels[0];
      set({
        currentSessionId: id,
        messages: target.messages,
        model: sessionModel,
        isLoading: !!get().abortControllers[id],
        // Close Canvas by default when switching to a session; user can reopen via toggle or file badge
        workspaceEnabled: false,
        artifacts: [],
        activeArtifactId: null,
        activeWorkspaceSelection: null,
      });

      // Preload that session's artifacts in the background so they're ready if opened
      if (typeof get().loadArtifactsForSession === "function") {
        void get().loadArtifactsForSession(id);
      }
    }
  },

  deleteSession: async (id: string) => {
    // 1. Delete all workspace artifacts tied to this session from IndexedDB
    const sessionArtifacts =
      get().currentSessionId === id
        ? get().artifacts
        : typeof getArtifactsBySession === "function"
          ? await getArtifactsBySession(id)
          : [];

    if (
      sessionArtifacts.length > 0 &&
      typeof deleteArtifactFromDB === "function"
    ) {
      await Promise.all(
        sessionArtifacts.map((artifact: WorkspaceArtifact) =>
          deleteArtifactFromDB(artifact.id),
        ),
      );
    }

    // 2. Delete the chat session itself and refresh the sidebar list
    await deleteSessionFromDB(id);
    await get().loadSessionsFromStorage();

    // 3. Reset active session & Canvas state if the deleted session was open
    if (get().currentSessionId === id) {
      set(() => ({
        currentSessionId: null,
        messages: [],
        workspaceEnabled: false,
        artifacts: [],
        activeArtifactId: null,
        activeWorkspaceSelection: null,
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

    // --- WEB SEARCH + LOCAL RAG INTERCEPTION ---
    let injectedWebContext: string | undefined = undefined;
    let injectedRagContext: string | undefined = undefined;
    let ragCitations: RagCitation[] = [];

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

    try {
      const [matchedChunks, contextDocs] = await Promise.all([
        retrieveRelevantChunks(content, {
          sessionId,
          topK: 4,
        }),
        getRagDocumentsForContext(sessionId),
      ]);

      if (matchedChunks.length > 0) {
        const docArtifactMap = new Map(
          contextDocs.map((d) => [d.id, d.artifactId]),
        );

        injectedRagContext = formatRetrievedContext(matchedChunks);
        ragCitations = matchedChunks.map((m) => ({
          citationIndex: m.citationIndex,
          docId: m.chunk.docId,
          artifactId: docArtifactMap.get(m.chunk.docId),
          title: m.chunk.title,
          chunkIndex: m.chunk.chunkIndex,
          text: m.chunk.text,
          score: m.score,
        }));
      }
    } catch (ragError) {
      console.error(
        "Local RAG retrieval failed, proceeding gracefully:",
        ragError,
      );
    }

    const assistantPlaceholder: ChatMessage = {
      role: "assistant",
      content: "",
      thinking: "",
      timestamp: Date.now(),
      isPinned: false,
      isPruned: false,
      citations: ragCitations.length > 0 ? ragCitations : undefined,
    };

    const transientSessionRecord: ChatSession = {
      id: sessionId,
      title: initialTitle,
      model,
      messages: [...updatedMessagesWithUser, assistantPlaceholder],
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

    const combinedContext =
      [injectedRagContext, injectedWebContext]
        .filter(Boolean)
        .join("\n\n---\n\n") || undefined;

    try {
      await executeStreamingInference({
        sessionId,
        historyForTelemetry: updatedMessagesWithUser,
        controller,
        get,
        set,
        webContext: combinedContext,
      });
    } catch (inferenceError) {
      console.error("Streaming inference execution error:", inferenceError);
    } finally {
      set((state) => ({
        search: { ...state.search, status: "idle" },
      }));
    }
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

  workspaceEnabled: false,
  artifacts: [],
  activeArtifactId: null,
  activeWorkspaceSelection: null,

  setWorkspaceEnabled: (enabled) => set({ workspaceEnabled: enabled }),

  setActiveArtifact: (id) =>
    set({ activeArtifactId: id, activeWorkspaceSelection: null }),

  setActiveWorkspaceSelection: (selection) =>
    set({ activeWorkspaceSelection: selection }),

  loadArtifactsForSession: async (sessionId: string) => {
    const items = await getArtifactsBySession(sessionId);
    set((state) => ({
      artifacts: items,
      activeArtifactId:
        state.activeArtifactId &&
        items.some((a) => a.id === state.activeArtifactId)
          ? state.activeArtifactId
          : items[items.length - 1]?.id || null,
    }));
  },

  createWorkspaceArtifact: async (
    title = "untitled.md",
    language = "markdown",
    content = "",
    source = "user",
  ) => {
    let sessionId = get().currentSessionId;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      const newSession: ChatSession = {
        id: sessionId,
        title: title,
        model: get().model || "",
        messages: [],
        updatedAt: Date.now(),
      };
      await saveSession(newSession);
      await get().loadSessionsFromStorage();
      set({ currentSessionId: sessionId });
    }

    const now = Date.now();
    const initialVersion: ArtifactVersion = {
      version: 1,
      content,
      timestamp: now,
      source,
      summary: source === "user" ? "Created file" : "Generated by model",
    };

    const artifact: WorkspaceArtifact = {
      id: crypto.randomUUID(),
      sessionId,
      title,
      language,
      type: "editor",
      content,
      versions: [initialVersion],
      currentVersion: 1,
      updatedAt: now,
    };

    await saveArtifact(artifact);
    set((state) => ({
      artifacts: [...state.artifacts, artifact],
      activeArtifactId: artifact.id,
      workspaceEnabled: true,
    }));

    if (content.trim()) {
      void indexRagDocument({
        id: `artifact-${artifact.id}`,
        sessionId,
        scope: "session",
        title: artifact.title,
        sourceKind: source === "preprocess" ? "file" : "canvas",
        content: artifact.content,
        artifactId: artifact.id,
      }).catch((err) => console.error("RAG artifact index failed:", err));
    }

    return artifact;
  },

  updateWorkspaceArtifact: async (updated: WorkspaceArtifact) => {
    await saveArtifact(updated);
    set((state) => ({
      artifacts: state.artifacts.map((a) =>
        a.id === updated.id ? updated : a,
      ),
    }));

    if (updated.content.trim()) {
      void indexRagDocument({
        id: `artifact-${updated.id}`,
        sessionId: updated.sessionId,
        scope: "session",
        title: updated.title,
        sourceKind: "canvas",
        content: updated.content,
        artifactId: updated.id,
      }).catch((err) => console.error("RAG artifact re-index failed:", err));
    } else {
      void deleteRagDocumentFromDB(`artifact-${updated.id}`).catch(() => {});
    }
  },

  deleteWorkspaceArtifact: async (id: string) => {
    await deleteArtifactFromDB(id);
    await deleteRagDocumentFromDB(`artifact-${id}`).catch(() => {});
    set((state) => {
      const remaining = state.artifacts.filter((a) => a.id !== id);
      return {
        artifacts: remaining,
        activeArtifactId:
          state.activeArtifactId === id
            ? remaining[remaining.length - 1]?.id || null
            : state.activeArtifactId,
      };
    });
  },

  buildWorkspacePromptContext: (userPrompt: string) => {
    const {
      workspaceEnabled,
      artifacts,
      activeArtifactId,
      activeWorkspaceSelection,
    } = get();
    if (!workspaceEnabled) {
      return { systemDirective: undefined, enrichedUserPrompt: userPrompt };
    }

    const activeArtifact =
      artifacts.find((a) => a.id === activeArtifactId) || artifacts[0] || null;

    if (!activeArtifact) {
      return {
        systemDirective: WORKSPACE_SYSTEM_DIRECTIVE,
        enrichedUserPrompt: `[WORKSPACE MODE: No active file open yet. Create one with <artifact_create>.]\n\nUser Request: ${userPrompt}`,
      };
    }

    const selectionBlock = activeWorkspaceSelection
      ? `\n[USER SELECTED LINES ${activeWorkspaceSelection.startLine}-${activeWorkspaceSelection.endLine}]:\n\`\`\`${activeArtifact.language}\n${activeWorkspaceSelection.selectedText}\n\`\`\`\n`
      : "";

    const enrichedUserPrompt = `[ACTIVE WORKSPACE FILE: "${activeArtifact.title}" | Language: ${activeArtifact.language}] \`\`\`${activeArtifact.language} ${activeArtifact.content} \`\`\`${selectionBlock} User Request: ${userPrompt}`;

    return {
      systemDirective: WORKSPACE_SYSTEM_DIRECTIVE,
      enrichedUserPrompt,
    };
  },

  applyModelWorkspaceOutput: async (
    rawAssistantText: string,
    userPrompt = "",
  ) => {
    const { workspaceEnabled, artifacts } = get();
    if (!workspaceEnabled) {
      return {
        cleanedChatText: rawAssistantText,
        appliedCount: 0,
        failedPatches: 0,
      };
    }

    // 1. Unwrap markdown fences around artifact tags & <artifact_content> wrappers
    const normalizedText = rawAssistantText
      .replace(
        /```(?:xml|html|markdown|text)?\s*(<(?:artifact_create|artifact_patch)[\s\S]*?)```/gi,
        "$1",
      )
      .replace(/<artifact_content[^>]*>([\s\S]*?)<\/artifact_content>/gi, "$1");

    let cleanedText = normalizedText;
    let appliedCount = 0;
    let failedPatches = 0;

    // 2. Handle <artifact_create title="..." language="...">...</artifact_create>
    const createRegex =
      /<artifact_create(?:\s+title="([^"]*)")?(?:\s+language="([^"]*)")?>([\s\S]*?)<\/artifact_create>/gi;

    const creations: Array<{
      title: string;
      language: string;
      content: string;
    }> = [];
    let createMatch: RegExpExecArray | null;

    while ((createMatch = createRegex.exec(normalizedText)) !== null) {
      const cleanBody = stripHallucinatedArtifactTags(createMatch[3] || "")
        .replace(/^\n+/, "")
        .replace(/\n+$/, "");

      creations.push({
        title: (
          createMatch[1] ||
          `artifact-${artifacts.length + creations.length + 1}.md`
        ).trim(),
        language: (createMatch[2] || "markdown").trim(),
        content: cleanBody,
      });
    }

    if (creations.length > 0) {
      cleanedText = cleanedText.replace(createRegex, "").trim();
      for (const item of creations) {
        await get().createWorkspaceArtifact(
          item.title,
          item.language,
          item.content,
          "assistant",
        );
        appliedCount++;
      }
    }

    // 3. Handle <artifact_patch><search>...</search><replace>...</replace></artifact_patch>
    const patchRegex = /<artifact_patch>([\s\S]*?)<\/artifact_patch>/gi;
    const patches: Array<{ search: string; replace: string }> = [];
    let patchMatch: RegExpExecArray | null;

    while ((patchMatch = patchRegex.exec(normalizedText)) !== null) {
      const inner = patchMatch[1];
      const searchMatch = /<search>([\s\S]*?)<\/search>/i.exec(inner);
      const replaceMatch = /<replace>([\s\S]*?)<\/replace>/i.exec(inner);

      if (searchMatch && replaceMatch) {
        patches.push({
          search: stripHallucinatedArtifactTags(searchMatch[1])
            .replace(/^\n/, "")
            .replace(/\n$/, ""),
          replace: stripHallucinatedArtifactTags(replaceMatch[1])
            .replace(/^\n/, "")
            .replace(/\n$/, ""),
        });
      }
    }

    if (patches.length > 0) {
      cleanedText = cleanedText.replace(patchRegex, "").trim();
      const latestArtifacts = get().artifacts;
      const target =
        latestArtifacts.find((a) => a.id === get().activeArtifactId) ||
        latestArtifacts[0];

      if (target) {
        let workingContent = target.content;
        let patchAppliedOnTarget = 0;

        for (const p of patches) {
          const res = applySearchReplacePatch(
            workingContent,
            p.search,
            p.replace,
          );
          if (res.matched) {
            workingContent = res.nextContent;
            patchAppliedOnTarget++;
            appliedCount++;
          } else {
            failedPatches++;
          }
        }

        if (patchAppliedOnTarget > 0) {
          const nextVersionNum = target.versions.length + 1;
          const versionEntry: ArtifactVersion = {
            version: nextVersionNum,
            content: workingContent,
            timestamp: Date.now(),
            source: "assistant",
            summary: `Applied ${patchAppliedOnTarget} patch(es)`,
          };

          const updatedArtifact: WorkspaceArtifact = {
            ...target,
            content: workingContent,
            versions: [...target.versions, versionEntry],
            currentVersion: nextVersionNum,
            updatedAt: Date.now(),
          };

          await get().updateWorkspaceArtifact(updatedArtifact);
        }
      } else {
        failedPatches += patches.length;
      }
    }

    // 4. Fallback for 2B models: only route a fenced code block into Canvas
    // when the user explicitly asked to create/edit/write/patch/generate code or a file.
    const wantsArtifactMutation =
      /\b(create|write|edit|update|modify|patch|refactor|generate|draft|build|save)\b.*\b(file|code|script|component|function|html|css|json|markdown|md|canvas|artifact)\b/i.test(
        userPrompt,
      );

    const latestAfterTags = get().artifacts;
    const activeTarget =
      latestAfterTags.find((a) => a.id === get().activeArtifactId) ||
      latestAfterTags[0];

    if (appliedCount === 0 && failedPatches === 0 && wantsArtifactMutation) {
      const fenceRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/;
      const fenceMatch = fenceRegex.exec(cleanedText);

      if (fenceMatch && fenceMatch[2].trim()) {
        const lang = (fenceMatch[1] || "markdown").trim();
        const nextContent = fenceMatch[2].replace(/\n+$/, "");
        cleanedText = cleanedText.replace(fenceRegex, "").trim();

        if (activeTarget) {
          const nextVersionNum = activeTarget.versions.length + 1;
          const versionEntry: ArtifactVersion = {
            version: nextVersionNum,
            content: nextContent,
            timestamp: Date.now(),
            source: "assistant",
            summary: "Updated active file (fallback)",
          };

          const updatedArtifact: WorkspaceArtifact = {
            ...activeTarget,
            content: nextContent,
            versions: [...activeTarget.versions, versionEntry],
            currentVersion: nextVersionNum,
            updatedAt: Date.now(),
          };

          await get().updateWorkspaceArtifact(updatedArtifact);
          appliedCount++;
        } else {
          const ext = getExtensionForLanguage(lang);
          const title = `artifact-${latestAfterTags.length + 1}.${ext}`;
          await get().createWorkspaceArtifact(
            title,
            lang,
            nextContent,
            "assistant",
          );
          appliedCount++;
        }
      }
    }

    // 5. Clean leftover tags/fences so prose stays in the chat bubble
    const finalProse = stripHallucinatedArtifactTags(cleanedText).trim();

    return {
      cleanedChatText: finalProse,
      appliedCount,
      failedPatches,
    };
  },

  openRagCitationInCanvas: async (
    citationIndex: number,
    messageIndex?: number,
  ) => {
    const state = get();
    const targetMsg =
      typeof messageIndex === "number" && state.messages[messageIndex]
        ? state.messages[messageIndex]
        : [...state.messages]
            .reverse()
            .find((m) => m.role === "assistant" && m.citations?.length);

    const citation = targetMsg?.citations?.find(
      (c) => c.citationIndex === citationIndex,
    );
    if (!citation) return;

    // If the chunk came from a Canvas artifact currently loaded, focus it directly
    if (
      citation.artifactId &&
      state.artifacts.some((a) => a.id === citation.artifactId)
    ) {
      set({
        workspaceEnabled: true,
        activeArtifactId: citation.artifactId,
        highlightedCitation: {
          artifactId: citation.artifactId,
          citationIndex: citation.citationIndex,
          title: citation.title,
          text: citation.text,
          chunkIndex: citation.chunkIndex,
          score: citation.score,
          nonce: Date.now(),
        },
      });
      return;
    }

    const sessionId = state.currentSessionId;
    if (!sessionId) return;

    const sourceTitle = `Source ${citation.citationIndex}: ${citation.title}`;
    const sourceContent = [
      `# ${citation.title}`,
      `- **Citation:** [Source ${citation.citationIndex}]`,
      `- **Chunk:** #${citation.chunkIndex + 1}`,
      `- **Relevance Score:** ${(citation.score * 100).toFixed(1)}%`,
      "",
      "---",
      "",
      citation.text,
    ].join("\n");

    const now = Date.now();
    const existingSourceArtifact = state.artifacts.find(
      (a) => a.type === "rag_source" && a.title === sourceTitle,
    );

    if (existingSourceArtifact) {
      const nextVersion = existingSourceArtifact.currentVersion + 1;
      const updatedArtifact: WorkspaceArtifact = {
        ...existingSourceArtifact,
        content: sourceContent,
        currentVersion: nextVersion,
        updatedAt: now,
        versions: [
          ...existingSourceArtifact.versions,
          {
            version: nextVersion,
            content: sourceContent,
            timestamp: now,
            source: "preprocess",
            summary: `Viewed [Source ${citation.citationIndex}] chunk #${citation.chunkIndex + 1}`,
          },
        ],
      };
      await saveArtifact(updatedArtifact);
      set((prev) => ({
        workspaceEnabled: true,
        activeArtifactId: updatedArtifact.id,
        artifacts: prev.artifacts.map((a) =>
          a.id === updatedArtifact.id ? updatedArtifact : a,
        ),
      }));
      return;
    }

    const newSourceArtifact: WorkspaceArtifact = {
      id: crypto.randomUUID(),
      sessionId,
      title: sourceTitle,
      language: "markdown",
      type: "rag_source",
      content: sourceContent,
      versions: [
        {
          version: 1,
          content: sourceContent,
          timestamp: now,
          source: "preprocess",
          summary: `Opened [Source ${citation.citationIndex}] chunk #${citation.chunkIndex + 1}`,
        },
      ],
      currentVersion: 1,
      updatedAt: now,
    };

    await saveArtifact(newSourceArtifact);
    set((prev) => ({
      workspaceEnabled: true,
      activeArtifactId: newSourceArtifact.id,
      artifacts: [...prev.artifacts, newSourceArtifact],
    }));
  },
}));
