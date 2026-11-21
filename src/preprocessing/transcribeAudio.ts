import {
  buildSuggestedFilename,
  createNormalizedDocument,
  normalizeLineBreaksAndWhitespace,
} from "./normalizeText";
import { NormalizedDocument, PreprocessInput } from "./types";

export interface AudioTranscriptionResult {
  /** Transcribed speech text */
  text: string;
  /** Optional confidence score normalized to 0..1 */
  confidence?: number;
  /** Optional engine or status note */
  note?: string;
}

export interface AudioEngineAdapter {
  transcribe(source: {
    file?: File | Blob;
    sourceName?: string;
  }): Promise<AudioTranscriptionResult>;
}

let activeAudioAdapter: AudioEngineAdapter | null = null;

export function setAudioEngineAdapter(
  adapter: AudioEngineAdapter | null,
): void {
  activeAudioAdapter = adapter;
}

export function getAudioEngineAdapter(): AudioEngineAdapter | null {
  return activeAudioAdapter;
}

export function createAudioAdapterChain(
  adapters: AudioEngineAdapter[],
  chainName = "audio-adapter-chain",
): AudioEngineAdapter {
  return {
    async transcribe(source) {
      const notes: string[] = [];
      let lastConfidence: number | undefined;

      for (let i = 0; i < adapters.length; i++) {
        const adapter = adapters[i];
        try {
          const res = await adapter.transcribe(source);
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
              note: res.note,
            };
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          notes.push(`tier-${i + 1}: ${msg}`);
        }
      }

      return {
        text: "",
        confidence: lastConfidence,
        note:
          notes.length > 0
            ? `[${chainName}] ${notes.join(" | ")}`
            : `[${chainName}] No audio adapter transcribed speech.`,
      };
    },
  };
}

function cleanTranscriptText(rawText: string): string {
  const normalized = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+$/gm, "");

  return normalizeLineBreaksAndWhitespace(normalized);
}

/**
 * Converts an audio file or Blob into a `NormalizedDocument` for
 * Canvas editing/inspection or prompt insertion without touching `store.ts`.
 */
export async function transcribeAudio(
  input: PreprocessInput,
  adapterOverride?: AudioEngineAdapter,
): Promise<NormalizedDocument> {
  const warnings: string[] = [];
  const engine = adapterOverride ?? activeAudioAdapter;

  const sourceSeed =
    input.sourceName ||
    (input.file instanceof File && input.file.name
      ? input.file.name
      : undefined) ||
    "audio-transcript";

  const suggestedTitle = buildSuggestedFilename(
    sourceSeed,
    "audio-transcript",
    "md",
  );

  if (!input.file) {
    warnings.push("No audio file was provided for transcription.");
    return createNormalizedDocument({
      kind: "audio",
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
      "No audio transcription adapter is configured yet. Register an AudioEngineAdapter via setAudioEngineAdapter() to transcribe audio.",
    );
    return createNormalizedDocument({
      kind: "audio",
      trigger: input.trigger,
      content: "",
      suggestedTitle,
      language: "markdown",
      sourceName: input.sourceName,
      sourceUrl: input.sourceUrl,
      warnings,
    });
  }

  let result: AudioTranscriptionResult;
  try {
    result = await engine.transcribe({
      file: input.file,
      sourceName: input.sourceName,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Unknown error during audio transcription.";
    warnings.push(`Audio transcription failed: ${message}`);
    return createNormalizedDocument({
      kind: "audio",
      trigger: input.trigger,
      content: "",
      suggestedTitle,
      language: "markdown",
      sourceName: input.sourceName,
      sourceUrl: input.sourceUrl,
      warnings,
    });
  }

  if (result.note) {
    warnings.push(result.note);
  }

  const normalizedConfidence =
    typeof result.confidence === "number"
      ? Math.max(0, Math.min(1, result.confidence))
      : undefined;

  if (normalizedConfidence !== undefined && normalizedConfidence < 0.7) {
    warnings.push(
      `Transcription confidence is ${Math.round(normalizedConfidence * 100)}%. Review names and technical terms in Canvas.`,
    );
  }

  const cleanedContent = cleanTranscriptText(result.text || "");
  if (!cleanedContent) {
    warnings.push(
      "No speech or readable transcript was returned from the audio.",
    );
  }

  return createNormalizedDocument({
    kind: "audio",
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
