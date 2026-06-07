import { create } from "zustand";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  model: string;
  availableModels: string[]; // Dynamic system discovery
  setModel: (model: string) => void;
  fetchModels: () => Promise<void>; // Triggers listing API
  sendMessage: (text: string) => Promise<void>;
  clearHistory: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  model: "",
  availableModels: [],

  setModel: (model) => set({ model }),
  clearHistory: () => set({ messages: [] }),

  fetchModels: async () => {
    try {
      const res = await fetch("http://localhost:5001/api/models");
      const data = await res.json();
      const modelNames = data.models.map((m: any) => m.name);

      set({
        availableModels: modelNames,
        model: modelNames.length > 0 ? modelNames[0] : "llama3.2:3b",
      });
    } catch (err) {
      console.error("Failed to load local models:", err);
      set({
        availableModels: ["llama3.2:3b", "qwen2.5:3b"],
        model: "llama3.2:3b",
      });
    }
  },

  sendMessage: async (text) => {
    if (!text.trim() || get().isLoading) return;

    const userMessage: Message = { role: "user", content: text };
    const initialAssistantMessage: Message = { role: "assistant", content: "" };

    set((state) => ({
      messages: [...state.messages, userMessage, initialAssistantMessage],
      isLoading: true,
    }));

    try {
      const response = await fetch("http://localhost:5001/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: get().model,
          messages: get().messages.slice(0, -1),
        }),
      });

      if (!response.body) throw new Error("No readable stream");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const rawChunk = decoder.decode(value);
        const lines = rawChunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.content) {
                accumulatedContent += parsed.content;
                set((state) => {
                  const updatedMessages = [...state.messages];
                  updatedMessages[updatedMessages.length - 1] = {
                    role: "assistant",
                    content: accumulatedContent,
                  };
                  return { messages: updatedMessages };
                });
              }
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      set({ isLoading: false });
    }
  },
}));
