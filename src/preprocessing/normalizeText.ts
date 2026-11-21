import {
  NormalizedDocument,
  NormalizedDocumentMetadata,
  PreprocessKind,
  PreprocessTrigger,
} from "./types";

/**
 * Normalizes line endings, trims trailing line spaces, and collapses excessive blank lines
 * without destroying intentional code/markdown structure.
 */
export function normalizeLineBreaksAndWhitespace(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Strips non-printable control characters while preserving tabs and newlines.
 */
export function stripControlCharacters(input: string): string {
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

/**
 * Builds a clean, safe filename from a title/source name and extension.
 */
export function buildSuggestedFilename(
  rawName: string | undefined,
  fallbackBase: string,
  extension: string,
): string {
  const cleanExt = extension.replace(/^\./, "").toLowerCase() || "md";
  const base = (rawName || fallbackBase)
    .replace(/\.[^./\\]+$/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `${base || fallbackBase}.${cleanExt}`;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function createNormalizedDocument(params: {
  kind: PreprocessKind;
  trigger: PreprocessTrigger;
  content: string;
  suggestedTitle: string;
  language?: NormalizedDocument["language"];
  sourceName?: string;
  sourceUrl?: string;
  durationSeconds?: number;
  confidence?: number;
  warnings?: string[];
}): NormalizedDocument {
  const cleaned = normalizeLineBreaksAndWhitespace(
    stripControlCharacters(params.content),
  );

  const metadata: NormalizedDocumentMetadata = {
    kind: params.kind,
    trigger: params.trigger,
    sourceName: params.sourceName,
    sourceUrl: params.sourceUrl,
    charCount: cleaned.length,
    wordCount: countWords(cleaned),
    durationSeconds: params.durationSeconds,
    confidence: params.confidence,
    processedAt: Date.now(),
  };

  return {
    content: cleaned,
    suggestedTitle: params.suggestedTitle,
    language: params.language ?? "markdown",
    warnings: params.warnings ?? [],
    metadata,
  };
}
