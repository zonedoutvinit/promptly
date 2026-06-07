import { create } from "zustand";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  model: string;
  setModel: (model: string) => void;
  sendMessage: (text: string) => Promise<void>;
  clearHistory: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  model: "llama3.2:3b",

  setModel: (model) => set({ model }),

  clearHistory: () => set({ messages: [] }),

  sendMessage: async (text) => {
    if (!text.trim() || get().isLoading) return;

    const userMessage: Message = { role: "user", content: text };
    const initialAssistantMessage: Message = { role: "assistant", content: "" };

    // 1. Optimistic update: instantly render the user message and a blank space for the AI
    set((state) => ({
      messages: [...state.messages, userMessage, initialAssistantMessage],
      isLoading: true,
    }));

    try {
      // 2. Fetch the stream from the backend wrapper
      const response = await fetch("http://localhost:5001/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Pass the full history minus the empty placeholder we just added
        body: JSON.stringify({
          model: get().model,
          messages: get().messages.slice(0, -1),
        }),
      });

      if (!response.body) throw new Error("No readable stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";

      // 3. Process the backend chunk tokens as they land
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

                // 4. Update the combined state object.
                // Only components watching 'messages' will re-render!
                set((state) => {
                  const updatedMessages = [...state.messages];
                  updatedMessages[updatedMessages.length - 1] = {
                    role: "assistant",
                    content: accumulatedContent,
                  };
                  return { messages: updatedMessages };
                });
              }
            } catch (e) {
              // Handle trailing partial lines silently
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      set((state) => {
        const updatedMessages = [...state.messages];
        updatedMessages[updatedMessages.length - 1] = {
          role: "assistant",
          content: "❌ Error: Failed to fetch local stream.",
        };
        return { messages: updatedMessages };
      });
    } finally {
      set({ isLoading: false });
    }
  },
}));
