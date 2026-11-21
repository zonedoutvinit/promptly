import {
  buildSuggestedFilename,
  createNormalizedDocument,
  normalizeLineBreaksAndWhitespace,
} from "./normalizeText";
import { NormalizedDocument, PreprocessInput } from "./types";

export interface OcrRecognitionResult {
  /** Extracted raw text with line breaks preserved where possible */
  text: string;
  /** Confidence score normalized to 0..1 */
  confidence?: number;
  /** Optional engine or preprocessing note */
  note?: string;
}

export interface OcrEngineAdapter {
  recognize(source: {
    file?: File | Blob;
    dataUrl?: string;
    sourceName?: string;
  }): Promise<OcrRecognitionResult>;
}

let activeOcrAdapter: OcrEngineAdapter | null = null;

/**
 * Registers or swaps the OCR recognition engine at runtime so `ocrImage`
 * remains stateless and decoupled from heavy OCR dependencies.
 */
export function setOcrEngineAdapter(adapter: OcrEngineAdapter | null): void {
  activeOcrAdapter = adapter;
}

export function getOcrEngineAdapter(): OcrEngineAdapter | null {
  return activeOcrAdapter;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read image blob as Data URL."));
      }
    };
    reader.onerror = () =>
      reject(
        reader.error ?? new Error("FileReader failed while reading image."),
      );
    reader.readAsDataURL(blob);
  });
}

function isImageDataUrl(value: string): boolean {
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(value.trim());
}

/**
 * Cleans typical OCR line noise while preserving stack traces,
 * terminal output, and intentional line breaks.
 */
function cleanOcrText(rawText: string): string {
  const lineNormalized = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    // Collapse horizontal spaces/tabs within a line, but keep leading indentation
    .replace(/([^\n\S]+)[ \t]+/g, "$1")
    .replace(/[ \t]+$/gm, "");

  return normalizeLineBreaksAndWhitespace(lineNormalized);
}

/**
 * Converts a screenshot, error log image, or image Data URL into a
 * `NormalizedDocument` for WorkspaceCanvas review and Phase 3 Local RAG.
 */
export async function ocrImage(
  input: PreprocessInput,
  adapterOverride?: OcrEngineAdapter,
): Promise<NormalizedDocument> {
  const warnings: string[] = [];
  const engine = adapterOverride ?? activeOcrAdapter;

  const dataUrl =
    input.rawText && isImageDataUrl(input.rawText)
      ? input.rawText.trim()
      : input.file
        ? await blobToDataUrl(input.file)
        : undefined;

  const sourceSeed =
    input.sourceName ||
    (input.file instanceof File && input.file.name
      ? input.file.name
      : undefined) ||
    "ocr-capture";

  const suggestedTitle = buildSuggestedFilename(
    sourceSeed,
    "ocr-capture",
    "md",
  );

  if (!input.file && !dataUrl) {
    warnings.push("No image file or image Data URL was provided for OCR.");
    return createNormalizedDocument({
      kind: "image",
      trigger: input.trigger,
      content: "",
      suggestedTitle,
      language: "markdown",
      sourceName: input.sourceName,
      sourceUrl: input.sourceUrl,
      warnings,
    });
  }

  if (!engine) {
    warnings.push(
      "No OCR engine adapter is configured yet. Register an OcrEngineAdapter via setOcrEngineAdapter() to extract text from images.",
    );
    return createNormalizedDocument({
      kind: "image",
      trigger: input.trigger,
      content: "",
      suggestedTitle,
      language: "markdown",
      sourceName: input.sourceName,
      sourceUrl: input.sourceUrl,
      warnings,
    });
  }

  let recognition: OcrRecognitionResult;
  try {
    recognition = await engine.recognize({
      file: input.file,
      dataUrl,
      sourceName: input.sourceName,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error during OCR.";
    warnings.push(`OCR recognition failed: ${message}`);
    return createNormalizedDocument({
      kind: "image",
      trigger: input.trigger,
      content: "",
      suggestedTitle,
      language: "markdown",
      sourceName: input.sourceName,
      sourceUrl: input.sourceUrl,
      warnings,
    });
  }

  if (recognition.note) {
    warnings.push(recognition.note);
  }

  const normalizedConfidence =
    typeof recognition.confidence === "number"
      ? Math.max(0, Math.min(1, recognition.confidence))
      : undefined;

  if (normalizedConfidence !== undefined && normalizedConfidence < 0.7) {
    warnings.push(
      `OCR confidence is ${Math.round(normalizedConfidence * 100)}%. Review identifiers, numbers, and error symbols in Canvas.`,
    );
  }

  const cleanedContent = cleanOcrText(recognition.text || "");
  if (!cleanedContent) {
    warnings.push("No readable text was detected in the image.");
  }

  return createNormalizedDocument({
    kind: "image",
    trigger: input.trigger,
    content: cleanedContent,
    suggestedTitle,
    language: "markdown",
    sourceName: input.sourceName,
    sourceUrl: input.sourceUrl,
    confidence: normalizedConfidence,
    warnings,
  });
}

export function createOcrAdapterChain(
  adapters: OcrEngineAdapter[],
  chainName = "adapter-chain",
): OcrEngineAdapter {
  return {
    async recognize(source) {
      const notes: string[] = [];
      let lastConfidence: number | undefined;

      for (let i = 0; i < adapters.length; i++) {
        const adapter = adapters[i];
        try {
          const res = await adapter.recognize(source);
          if (typeof res?.confidence === "number") {
            lastConfidence = res.confidence;
          }
          if (res?.note) {
            notes.push(res.note);
          }
          if (res?.text && res.text.trim().length > 0) {
            return {
              text: res.text,
              confidence: res.confidence,
              note: notes.length > 0 ? notes.join(" | ") : undefined,
            };
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          notes.push(`tier-${i + 1}: ${msg}`);
          // Continue to next adapter in chain (e.g., lazyTesseractOcrAdapter)
        }
      }

      return {
        text: "",
        confidence: lastConfidence,
        note:
          notes.length > 0
            ? `[${chainName}] ${notes.join(" | ")}`
            : `[${chainName}] No adapter extracted text.`,
      };
    },
  };
}
