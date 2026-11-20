// src/utils/db.ts
const DB_NAME = "PromptlyLocalDB";
const DB_VERSION = 3; // Bumped to 3 for workspace_artifacts store
const STORE_NAME = "chat_sessions";
const ARTIFACT_STORE_NAME = "workspace_artifacts";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  thinking?: string;
  isPinned?: boolean;
  isPruned?: boolean;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  artifactSummary?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  model: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface ArtifactVersion {
  version: number;
  content: string;
  timestamp: number;
  source: "user" | "assistant" | "preprocess"; // Ready for Phase 2
  summary?: string;
}

export type ArtifactTabType = "editor" | "rag_source" | "terminal_output";

export interface WorkspaceArtifact {
  id: string;
  sessionId: string;
  title: string;
  language: string;
  type: ArtifactTabType;
  content: string;
  versions: ArtifactVersion[];
  currentVersion: number;
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

      // Create separate workspace store with sessionId index
      if (!db.objectStoreNames.contains(ARTIFACT_STORE_NAME)) {
        const artifactStore = db.createObjectStore(ARTIFACT_STORE_NAME, {
          keyPath: "id",
        });
        artifactStore.createIndex("sessionId", "sessionId", { unique: false });
      }
    };
  });
};

// ==========================================
// CHAT SESSION OPERATIONS
// ==========================================

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

// Cascade-deletes both the chat session and all associated workspace artifacts
export const deleteSessionFromDB = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [STORE_NAME, ARTIFACT_STORE_NAME],
      "readwrite",
    );
    const sessionStore = transaction.objectStore(STORE_NAME);
    const artifactStore = transaction.objectStore(ARTIFACT_STORE_NAME);
    const sessionIndex = artifactStore.index("sessionId");

    sessionStore.delete(id);

    const cursorReq = sessionIndex.openCursor(IDBKeyRange.only(id));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    // ATOMIC GUARANTEE: Confirm structural removal integrity safely across layers
    transaction.oncomplete = () => resolve();

    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(new Error("Delete transaction aborted before cleanup executed."));
  });
};

// ==========================================
// WORKSPACE ARTIFACT OPERATIONS
// ==========================================

export const getArtifactsBySession = async (
  sessionId: string,
): Promise<WorkspaceArtifact[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ARTIFACT_STORE_NAME, "readonly");
    const store = transaction.objectStore(ARTIFACT_STORE_NAME);
    const index = store.index("sessionId");
    const request = index.getAll(IDBKeyRange.only(sessionId));

    transaction.onerror = () => reject(transaction.error);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const items = (request.result as WorkspaceArtifact[]) || [];
      resolve(items.sort((a, b) => a.updatedAt - b.updatedAt));
    };
  });
};

export const saveArtifact = async (
  artifact: WorkspaceArtifact,
): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ARTIFACT_STORE_NAME, "readwrite");
    const store = transaction.objectStore(ARTIFACT_STORE_NAME);

    store.put(artifact);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(new Error("Artifact write transaction aborted."));
  });
};

export const deleteArtifactFromDB = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ARTIFACT_STORE_NAME, "readwrite");
    const store = transaction.objectStore(ARTIFACT_STORE_NAME);

    store.delete(id);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};
