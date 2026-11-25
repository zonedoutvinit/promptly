import {
  ChatSession,
  RagChunk,
  RagDocument,
  RagScope,
  WorkspaceArtifact,
} from "@renderer/types";

// src/utils/db.ts
const DB_NAME = "PromptlyLocalDB";
const DB_VERSION = 4;
const STORE_NAME = "chat_sessions";
const ARTIFACT_STORE_NAME = "workspace_artifacts";
const RAG_DOC_STORE_NAME = "rag_documents";
const RAG_CHUNK_STORE_NAME = "rag_chunks";

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
        // Primary key is now an independent session ID
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }

      // Create separate workspace store with sessionId index
      if (!db.objectStoreNames.contains(ARTIFACT_STORE_NAME)) {
        const artifactStore = db.createObjectStore(ARTIFACT_STORE_NAME, {
          keyPath: "id",
        });
        artifactStore.createIndex("sessionId", "sessionId", { unique: false });
      }

      // Phase 3: Local RAG document metadata store
      if (!db.objectStoreNames.contains(RAG_DOC_STORE_NAME)) {
        const ragDocStore = db.createObjectStore(RAG_DOC_STORE_NAME, {
          keyPath: "id",
        });
        ragDocStore.createIndex("sessionId", "sessionId", { unique: false });
        ragDocStore.createIndex("scope", "scope", { unique: false });
      }

      // Phase 3: Local RAG text chunks + embedding vectors store
      if (!db.objectStoreNames.contains(RAG_CHUNK_STORE_NAME)) {
        const ragChunkStore = db.createObjectStore(RAG_CHUNK_STORE_NAME, {
          keyPath: "id",
        });
        ragChunkStore.createIndex("docId", "docId", { unique: false });
        ragChunkStore.createIndex("sessionId", "sessionId", { unique: false });
        ragChunkStore.createIndex("scope", "scope", { unique: false });
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

// Cascade-deletes chat session, associated workspace artifacts, and session-scoped RAG items
export const deleteSessionFromDB = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [
        STORE_NAME,
        ARTIFACT_STORE_NAME,
        RAG_DOC_STORE_NAME,
        RAG_CHUNK_STORE_NAME,
      ],
      "readwrite",
    );
    const sessionStore = transaction.objectStore(STORE_NAME);
    const artifactStore = transaction.objectStore(ARTIFACT_STORE_NAME);
    const ragDocStore = transaction.objectStore(RAG_DOC_STORE_NAME);
    const ragChunkStore = transaction.objectStore(RAG_CHUNK_STORE_NAME);

    const artifactSessionIndex = artifactStore.index("sessionId");
    const ragDocSessionIndex = ragDocStore.index("sessionId");
    const ragChunkSessionIndex = ragChunkStore.index("sessionId");

    sessionStore.delete(id);

    const artifactCursorReq = artifactSessionIndex.openCursor(
      IDBKeyRange.only(id),
    );
    artifactCursorReq.onsuccess = () => {
      const cursor = artifactCursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    const ragDocCursorReq = ragDocSessionIndex.openCursor(IDBKeyRange.only(id));
    ragDocCursorReq.onsuccess = () => {
      const cursor = ragDocCursorReq.result;
      if (cursor) {
        const doc = cursor.value as RagDocument;
        if (doc.scope === "session") {
          cursor.delete();
        }
        cursor.continue();
      }
    };

    const ragChunkCursorReq = ragChunkSessionIndex.openCursor(
      IDBKeyRange.only(id),
    );
    ragChunkCursorReq.onsuccess = () => {
      const cursor = ragChunkCursorReq.result;
      if (cursor) {
        const chunk = cursor.value as RagChunk;
        if (chunk.scope === "session") {
          cursor.delete();
        }
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

// ==========================================
// LOCAL RAG DOCUMENT & CHUNK OPERATIONS
// ==========================================
export const saveRagDocumentWithChunks = async (
  doc: RagDocument,
  chunks: RagChunk[],
): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [RAG_DOC_STORE_NAME, RAG_CHUNK_STORE_NAME],
      "readwrite",
    );
    const docStore = transaction.objectStore(RAG_DOC_STORE_NAME);
    const chunkStore = transaction.objectStore(RAG_CHUNK_STORE_NAME);
    const docIdIndex = chunkStore.index("docId");

    // Remove existing chunks for this document before writing updated ones
    const cursorReq = docIdIndex.openCursor(IDBKeyRange.only(doc.id));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        docStore.put({
          ...doc,
          chunkCount: chunks.length,
        });
        for (const chunk of chunks) {
          chunkStore.put(chunk);
        }
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(new Error("RAG write transaction aborted before commit."));
  });
};

export const getRagDocumentsForContext = async (
  sessionId?: string | null,
): Promise<RagDocument[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RAG_DOC_STORE_NAME, "readonly");
    const store = transaction.objectStore(RAG_DOC_STORE_NAME);
    const scopeIndex = store.index("scope");
    const sessionIndex = store.index("sessionId");

    const resultsMap = new Map<string, RagDocument>();

    const libraryReq = scopeIndex.getAll(IDBKeyRange.only("library"));
    libraryReq.onsuccess = () => {
      for (const doc of (libraryReq.result as RagDocument[]) || []) {
        resultsMap.set(doc.id, doc);
      }
    };

    if (sessionId) {
      const sessionReq = sessionIndex.getAll(IDBKeyRange.only(sessionId));
      sessionReq.onsuccess = () => {
        for (const doc of (sessionReq.result as RagDocument[]) || []) {
          resultsMap.set(doc.id, doc);
        }
      };
    }

    transaction.oncomplete = () => {
      const merged = Array.from(resultsMap.values()).sort(
        (a, b) => b.updatedAt - a.updatedAt,
      );
      resolve(merged);
    };
    transaction.onerror = () => reject(transaction.error);
  });
};

export const getRagChunksForContext = async (
  sessionId?: string | null,
): Promise<RagChunk[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RAG_CHUNK_STORE_NAME, "readonly");
    const store = transaction.objectStore(RAG_CHUNK_STORE_NAME);
    const scopeIndex = store.index("scope");
    const sessionIndex = store.index("sessionId");

    const resultsMap = new Map<string, RagChunk>();

    const libraryReq = scopeIndex.getAll(IDBKeyRange.only("library"));
    libraryReq.onsuccess = () => {
      for (const chunk of (libraryReq.result as RagChunk[]) || []) {
        resultsMap.set(chunk.id, chunk);
      }
    };

    if (sessionId) {
      const sessionReq = sessionIndex.getAll(IDBKeyRange.only(sessionId));
      sessionReq.onsuccess = () => {
        for (const chunk of (sessionReq.result as RagChunk[]) || []) {
          resultsMap.set(chunk.id, chunk);
        }
      };
    }

    transaction.oncomplete = () => {
      resolve(Array.from(resultsMap.values()));
    };
    transaction.onerror = () => reject(transaction.error);
  });
};

export const updateRagDocumentScope = async (
  docId: string,
  scope: RagScope,
  sessionId: string | null = null,
): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [RAG_DOC_STORE_NAME, RAG_CHUNK_STORE_NAME],
      "readwrite",
    );
    const docStore = transaction.objectStore(RAG_DOC_STORE_NAME);
    const chunkStore = transaction.objectStore(RAG_CHUNK_STORE_NAME);
    const docIdIndex = chunkStore.index("docId");

    const getDocReq = docStore.get(docId);
    getDocReq.onsuccess = () => {
      const existing = getDocReq.result as RagDocument | undefined;
      if (!existing) return;

      const resolvedSessionId =
        scope === "library" ? null : (sessionId ?? existing.sessionId);

      docStore.put({
        ...existing,
        scope,
        sessionId: resolvedSessionId,
        updatedAt: Date.now(),
      });

      const cursorReq = docIdIndex.openCursor(IDBKeyRange.only(docId));
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          const chunk = cursor.value as RagChunk;
          cursor.update({
            ...chunk,
            scope,
            sessionId: resolvedSessionId,
          });
          cursor.continue();
        }
      };
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(new Error("RAG scope update transaction aborted."));
  });
};

export const deleteRagDocumentFromDB = async (docId: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [RAG_DOC_STORE_NAME, RAG_CHUNK_STORE_NAME],
      "readwrite",
    );
    const docStore = transaction.objectStore(RAG_DOC_STORE_NAME);
    const chunkStore = transaction.objectStore(RAG_CHUNK_STORE_NAME);
    const docIdIndex = chunkStore.index("docId");

    docStore.delete(docId);

    const cursorReq = docIdIndex.openCursor(IDBKeyRange.only(docId));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(new Error("RAG delete transaction aborted."));
  });
};
