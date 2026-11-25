// src/rag/retriever.ts
import {
  EmbeddingProvider,
  IndexDocumentInput,
  RetrievedChunk,
} from "@renderer/types";
import { getRagChunksForContext, saveRagDocumentWithChunks } from "../utils/db";
import { buildRagChunks } from "./chunker";

let embeddingPipelinePromise: Promise<
  (
    texts: string[],
    options?: { pooling?: "mean" | "cls"; normalize?: boolean },
  ) => Promise<{ tolist: () => number[][] }>
> | null = null;

async function getLazyEmbeddingPipeline() {
  if (!embeddingPipelinePromise) {
    embeddingPipelinePromise = (async () => {
      const transformers = await import("@huggingface/transformers");
      const extractor = await transformers.pipeline(
        "feature-extraction",
        "Xenova/bge-small-en-v1.5",
      );
      return async (
        texts: string[],
        options: { pooling?: "mean" | "cls"; normalize?: boolean } = {
          pooling: "mean",
          normalize: true,
        },
      ) => {
        const out = await extractor(texts, options);
        return out as unknown as { tolist: () => number[][] };
      };
    })().catch((err) => {
      embeddingPipelinePromise = null;
      throw err;
    });
  }
  return embeddingPipelinePromise;
}

export const lazyTransformersEmbeddingProvider: EmbeddingProvider = {
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const extractor = await getLazyEmbeddingPipeline();
    const tensor = await extractor(texts, { pooling: "mean", normalize: true });
    return tensor.tolist();
  },
};

function toVectorArray(vec?: Float32Array | number[]): number[] | null {
  if (!vec) return null;
  if (Array.isArray(vec)) return vec.length > 0 ? vec : null;
  if (vec instanceof Float32Array && vec.length > 0) return Array.from(vec);
  return null;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    const va = a[i];
    const vb = b[i];
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 2),
  );
}

function lexicalOverlapScore(query: string, chunkText: string): number {
  const qTokens = tokenize(query);
  if (qTokens.size === 0) return 0;
  const cTokens = tokenize(chunkText);
  if (cTokens.size === 0) return 0;

  let matches = 0;
  for (const token of qTokens) {
    if (cTokens.has(token)) matches += 1;
  }
  return matches / qTokens.size;
}

/**
 * Chunks a normalized document or Canvas artifact, optionally embeds chunks,
 * and persists both document metadata and chunks into PromptlyLocalDB.
 */
export async function indexRagDocument(
  input: IndexDocumentInput,
): Promise<{ docId: string; chunkCount: number; embedded: boolean }> {
  const chunks = buildRagChunks({
    docId: input.id,
    sessionId: input.scope === "library" ? null : input.sessionId,
    scope: input.scope,
    title: input.title,
    content: input.content,
    options: input.chunkOptions,
  });

  let embedded = false;
  if (chunks.length > 0) {
    const provider =
      input.embeddingProvider ?? lazyTransformersEmbeddingProvider;
    try {
      const vectors = await provider.embed(chunks.map((c) => c.text));
      if (vectors.length === chunks.length) {
        for (let i = 0; i < chunks.length; i++) {
          chunks[i].embedding = vectors[i];
        }
        embedded = true;
      }
    } catch {
      // Keep chunks stored without embeddings so lexical retrieval still works
      embedded = false;
    }
  }

  await saveRagDocumentWithChunks(
    {
      id: input.id,
      sessionId: input.scope === "library" ? null : input.sessionId,
      scope: input.scope,
      title: input.title,
      sourceKind: input.sourceKind,
      artifactId: input.artifactId,
      chunkCount: chunks.length,
      updatedAt: Date.now(),
    },
    chunks,
  );

  return {
    docId: input.id,
    chunkCount: chunks.length,
    embedded,
  };
}

/**
 * Retrieves top-K relevant chunks for `query` across `library` docs and
 * `sessionId` docs stored in PromptlyLocalDB.
 */
export async function retrieveRelevantChunks(
  query: string,
  options: {
    sessionId?: string | null;
    topK?: number;
    embeddingProvider?: EmbeddingProvider;
  } = {},
): Promise<RetrievedChunk[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const topK = options.topK ?? 4;
  const candidates = await getRagChunksForContext(options.sessionId);
  if (candidates.length === 0) return [];

  let queryVector: number[] | null = null;
  const hasAnyVectors = candidates.some((c) =>
    Boolean(toVectorArray(c.embedding)),
  );

  if (hasAnyVectors) {
    const provider =
      options.embeddingProvider ?? lazyTransformersEmbeddingProvider;
    try {
      const [vec] = await provider.embed([trimmedQuery]);
      if (Array.isArray(vec) && vec.length > 0) {
        queryVector = vec;
      }
    } catch {
      queryVector = null;
    }
  }

  const scored = candidates
    .map((chunk) => {
      const lexScore = lexicalOverlapScore(trimmedQuery, chunk.text);
      const chunkVec = toVectorArray(chunk.embedding);
      const vecScore =
        queryVector && chunkVec
          ? cosineSimilarity(queryVector, chunkVec)
          : null;

      // Blend semantic similarity and exact term overlap when both exist
      const finalScore =
        vecScore !== null ? vecScore * 0.8 + lexScore * 0.2 : lexScore;

      return { chunk, score: finalScore };
    })
    .filter((item) => item.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map((item, idx) => ({
    chunk: item.chunk,
    citationIndex: idx + 1,
    score: item.score,
  }));
}

/**
 * Formats retrieved chunks into a compact context block for prompt injection
 * using [cite: N] markers.
 */
export function formatRetrievedContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";

  const entries = chunks
    .map(
      ({ chunk, citationIndex }) =>
        `[cite: ${citationIndex}]: ${chunk.text.trim()}`,
    )
    .join("\n");

  return [
    "Reference notes:",
    entries,
    "",
    "Instructions: Answer the user's question in one short sentence using only the reference notes above. Do not repeat the reference notes. Append at the end of your sentence using the matching source number.",
  ].join("\n");
}
