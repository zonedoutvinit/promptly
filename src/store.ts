import { create } from "zustand";
import {
  getAllSessions,
  saveSession,
  deleteSessionFromDB,
  ChatSession,
  ChatMessage,
} from "./utils/db";

interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  model: string;
  availableModels: string[];

  fetchModels: () => Promise<void>;
  setModel: (model: string) => void;

  createNewSession: () => void;
  selectSession: (id: string) => void;
  deleteSession: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  loadSessionsFromStorage: () => Promise<void>;
}

const OLLAMA_BASE_URL = "http://localhost:11434";

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  isLoading: false,
  model: "",
  availableModels: [],

  fetchModels: async () => {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
      if (!response.ok) throw new Error("Ollama connection down");
      const data = await response.json();
      const models = data.models.map((m: any) => m.name);
      set({ availableModels: models });
      if (models.length > 0 && !get().model) {
        set({ model: models[0] });
      }
    } catch (err) {
      console.error("Could not fetch models directly.", err);
    }
  },

  setModel: (model: string) => {
    set({ model });
    // If inside a session, lock the model selection update to that session meta record
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
    // Generate a fresh session state shell
    const newId = crypto.randomUUID();
    set({
      currentSessionId: newId,
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
      });
    }
  },

  deleteSession: async (id: string) => {
    await deleteSessionFromDB(id);
    await get().loadSessionsFromStorage();

    // Fall back to a new clear screen panel view if the open track was deleted
    if (get().currentSessionId === id) {
      set({ currentSessionId: null, messages: [] });
    }
  },

  sendMessage: async (content: string) => {
    const { model, messages, isLoading, currentSessionId } = get();
    if (!model || isLoading || !content.trim()) return;

    let sessionId = currentSessionId;
    let isBrandNewSession = false;

    // Auto-instantiate a session slot container if none exists yet
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      isBrandNewSession = true;
    }

    const newUserMessage: ChatMessage = {
      role: "user",
      content,
      timestamp: Date.now(),
    };
    const updatedMessagesWithUser = [...messages, newUserMessage];

    // Generate chat channel naming title text layout dynamically based on the first prompt input
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
      const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model,
          messages: updatedMessagesWithUser.map(({ role, content }) => ({
            role,
            content,
          })),
          stream: true,
        }),
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
          if (!line.trim()) continue;
          try {
            const parsedChunk = JSON.parse(line);
            if (parsedChunk.message?.content) {
              assistantTextAccumulator += parsedChunk.message.content;

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
            }
          } catch (e) {}
        }
      }

      set({ isLoading: false });

      // Final write consolidation pass straight into the database store
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
