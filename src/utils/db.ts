// src/utils/db.ts
const DB_NAME = "PromptlyLocalDB";
const DB_VERSION = 2;
const STORE_NAME = "chat_sessions";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  isPinned?: boolean;
  isPruned?: boolean;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface ChatSession {
  id: string; // Unique session UUID or timestamp string
  title: string; // Dynamic conversational title
  model: string; // The last model used inside this thread
  messages: ChatMessage[];
  updatedAt: number;
}

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      // Clear out legacy model-specific stores if they exist
      if (db.objectStoreNames.contains("chat_history")) {
        db.deleteObjectStore("chat_history");
      }
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Primary key is now an independent session ID 🚀
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
};

// Fetch all sessions and sanitize flags for existing items to handle upgrades gracefully
export const getAllSessions = async (): Promise<ChatSession[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    // Guard transactional lifecycle completely
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(new Error("Transaction aborted by database system engine."));

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      // Sort sessions so the most recently updated thread sits at the top
      const sessions = request.result as ChatSession[];

      // Ensure missing metadata fields default cleanly to false for historical records
      const sanitizedSessions = sessions.map((session) => ({
        ...session,
        messages: (session.messages || []).map((msg) => ({
          ...msg,
          isPinned: msg.isPinned ?? false,
          isPruned: msg.isPruned ?? false,
        })),
      }));

      resolve(sanitizedSessions.sort((a, b) => b.updatedAt - a.updatedAt));
    };
  });
};

// Persist or overwrite an active conversation session thread atomically
export const saveSession = async (session: ChatSession): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    // Put mutation payload into operational stream pipeline
    store.put(session);

    // ATOMIC GUARANTEE: Resolve ONLY when data is successfully flushed to disk storage container
    transaction.oncomplete = () => resolve();

    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(
        new Error("Write transaction aborted before commit phase finalized."),
      );
  });
};

// Delete a complete chat session thread permanently
export const deleteSessionFromDB = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    store.delete(id);

    // ATOMIC GUARANTEE: Confirm structural removal integrity safely across layers
    transaction.oncomplete = () => resolve();

    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(new Error("Delete transaction aborted before cleanup executed."));
  });
};
