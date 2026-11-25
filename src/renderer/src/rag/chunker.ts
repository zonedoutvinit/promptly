// src/rag/chunker.ts
import {
  BuildRagChunksInput,
  ChunkTextOptions,
  RagChunk,
} from "@renderer/types";

function splitLongSegment(
  segment: string,
  maxChunkSize: number,
  overlapSize: number,
): string[] {
  if (segment.length <= maxChunkSize) return [segment];

  // Try splitting into sentences first
  const sentences = segment.match(/[^.!?]+(?:[.!?]+|$)/g);
  if (sentences && sentences.length > 1) {
    const out: string[] = [];
    let buf = "";

    for (const raw of sentences) {
      const s = raw.trim();
      if (!s) continue;

      if (s.length > maxChunkSize) {
        if (buf) {
          out.push(buf.trim());
          buf = "";
        }
        out.push(...hardSlice(s, maxChunkSize, overlapSize));
        continue;
      }

      const next = buf ? `${buf} ${s}` : s;
      if (next.length <= maxChunkSize) {
        buf = next;
      } else {
        if (buf) out.push(buf.trim());
        buf = s;
      }
    }

    if (buf.trim()) out.push(buf.trim());
    return out;
  }

  return hardSlice(segment, maxChunkSize, overlapSize);
}

function hardSlice(
  text: string,
  maxChunkSize: number,
  overlapSize: number,
): string[] {
  const step = Math.max(1, maxChunkSize - overlapSize);
  const slices: string[] = [];

  for (let i = 0; i < text.length; i += step) {
    const piece = text.slice(i, i + maxChunkSize).trim();
    if (piece) slices.push(piece);
    if (i + maxChunkSize >= text.length) break;
  }

  return slices;
}

export function chunkText(
  rawText: string,
  options: ChunkTextOptions = {},
): string[] {
  const maxChunkSize = options.maxChunkSize ?? 280;
  const overlapSize = Math.min(
    options.overlapSize ?? 40,
    Math.floor(maxChunkSize / 3),
  );
  const minPackLength = options.minPackLength ?? 80;

  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  if (!normalized) return [];

  // Split by individual lines so specific lines/bullets/headings become distinct units
  const rawLines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^```[\w-]*$/.test(line));

  const units: string[] = [];
  for (const line of rawLines) {
    units.push(...splitLongSegment(line, maxChunkSize, overlapSize));
  }

  // Only combine short fragments when both are tiny (e.g., short bullets or headers)
  const chunks: string[] = [];
  let current = "";

  for (const unit of units) {
    if (!current) {
      current = unit;
      continue;
    }

    const shouldMergeShortLines =
      current.length < minPackLength &&
      unit.length < minPackLength &&
      current.length + unit.length + 1 <= maxChunkSize;

    if (shouldMergeShortLines) {
      current = `${current}\n${unit}`;
    } else {
      chunks.push(current.trim());
      const tail =
        overlapSize > 0 && current.length > overlapSize
          ? current.slice(-overlapSize).trim()
          : "";
      current =
        tail && tail.length + unit.length + 1 <= maxChunkSize
          ? `${tail}\n${unit}`
          : unit;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

export function buildRagChunks({
  docId,
  sessionId,
  scope,
  title,
  content,
  options,
}: BuildRagChunksInput): RagChunk[] {
  const pieces = chunkText(content, options);
  return pieces.map((text, index) => ({
    id: `${docId}-chunk-${index}`,
    docId,
    sessionId,
    scope,
    title,
    chunkIndex: index,
    text,
  }));
}
