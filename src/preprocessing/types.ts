export type PreprocessKind = "html" | "image" | "audio";

export type PreprocessTrigger = "paste" | "drop" | "picker";

export interface PreprocessInput {
  kind: PreprocessKind;
  trigger: PreprocessTrigger;
  /** Raw HTML string or pasted text when kind === "html" */
  rawText?: string;
  /** File or Blob for pasted/dropped/picked HTML, image, or audio */
  file?: File | Blob;
  /** Optional filename or URL context */
  sourceName?: string;
  sourceUrl?: string;
}

export interface NormalizedDocumentMetadata {
  kind: PreprocessKind;
  trigger: PreprocessTrigger;
  sourceName?: string;
  sourceUrl?: string;
  /** Character count of normalized content */
  charCount: number;
  /** Approximate word count of normalized content */
  wordCount: number;
  /** Optional duration in seconds for audio inputs */
  durationSeconds?: number;
  /** Optional OCR confidence score (0-1) */
  confidence?: number;
  /** Timestamp when normalization completed */
  processedAt: number;
}

export interface NormalizedDocument {
  /** Primary normalized output (Markdown for HTML/docs, clean text for OCR/transcripts) */
  content: string;
  /** Suggested filename for WorkspaceCanvas (e.g. "page-notes.md", "error-log.txt") */
  suggestedTitle: string;
  /** Normalized language key compatible with WorkspaceCanvas language selector */
  language:
    | "markdown"
    | "python"
    | "typescript"
    | "javascript"
    | "json"
    | "html"
    | "sql"
    | "bash";
  /** Non-fatal issues (e.g., stripped scripts, low OCR confidence, empty input) */
  warnings: string[];
  metadata: NormalizedDocumentMetadata;
}
