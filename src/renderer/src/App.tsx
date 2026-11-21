// src/renderer/src/App.tsx
import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { FileText, Loader2, MessageSquarePlus, X } from "lucide-react";
import { useChatStore } from "./store";
import { getModelSuggestedPrompts } from "./utils/chatHelpers";
import { htmlToMarkdown } from "@preprocessing/htmlToMarkdown";
import {
  createOcrAdapterChain,
  ocrImage,
  OcrEngineAdapter,
  setOcrEngineAdapter,
} from "@preprocessing/ocrImage";
import {
  AudioEngineAdapter,
  createAudioAdapterChain,
  setAudioEngineAdapter,
  transcribeAudio,
} from "@preprocessing/transcribeAudio";
import { NormalizedDocument, PreprocessTrigger } from "@preprocessing/types";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { ChatWindow } from "./components/ChatWindow";
import { PromptOptions } from "./components/PromptOptions";
import { MessageForm } from "./components/MessageForm";
import { ContextSidebar } from "./components/ContextSidebar";
import { EmptyStateCanvas } from "./components/EmptyStateCanvas";
import { WelcomeModal } from "./components/WelcomeModal";

function isHtmlFile(file: File): boolean {
  return file.type === "text/html" || /\.html?$/i.test(file.name);
}

function isImageFile(file: File): boolean {
  return (
    file.type.startsWith("image/") ||
    /\.(png|jpe?g|webp|bmp|gif|tiff?)$/i.test(file.name)
  );
}

function isAudioFile(file: File): boolean {
  return (
    file.type.startsWith("audio/") ||
    /\.(wav|mp3|m4a|ogg|webm|flac)$/i.test(file.name)
  );
}

function looksLikeHtmlMarkup(text: string): boolean {
  return /<(?:!doctype|html|head|body|main|article|section|div|p|h[1-6]|ul|ol|li|table|pre|code|a|img)\b/i.test(
    text,
  );
}

async function fileToBytes(file: File | Blob): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

async function audioFileTo16kMonoFloat32(
  file: File | Blob,
): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const decodeCtx = new AudioCtx();

  try {
    const decoded = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
    const targetSampleRate = 16_000;
    const length = Math.max(1, Math.ceil(decoded.duration * targetSampleRate));
    const offlineCtx = new OfflineAudioContext(1, length, targetSampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineCtx.destination);
    source.start(0);
    const rendered = await offlineCtx.startRendering();
    return rendered.getChannelData(0);
  } finally {
    await decodeCtx.close().catch(() => {});
  }
}

async function sourceToBytesAndMime(source: {
  file?: File | Blob;
  dataUrl?: string;
}): Promise<{ bytes: Uint8Array; mimeType?: string } | null> {
  if (source.file) {
    return {
      bytes: await fileToBytes(source.file),
      mimeType: source.file.type || "image/png",
    };
  }

  if (source.dataUrl) {
    const match = /^data:([^;]+);base64,(.+)$/i.exec(source.dataUrl.trim());
    if (!match) return null;
    const mimeType = match[1];
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { bytes, mimeType };
  }

  return null;
}

const systemIpcOcrAdapter: OcrEngineAdapter = {
  async recognize(source) {
    const api = (
      window as unknown as {
        electronAPI?: {
          ocrSystem?: (payload: {
            bytes: Uint8Array;
            mimeType?: string;
          }) => Promise<{ text: string; confidence?: number; note?: string }>;
        };
      }
    ).electronAPI;

    if (!api?.ocrSystem) {
      return { text: "" };
    }

    const encoded = await sourceToBytesAndMime(source);
    if (!encoded) {
      return { text: "" };
    }

    return api.ocrSystem(encoded);
  },
};

const lazyTesseractOcrAdapter: OcrEngineAdapter = {
  async recognize(source) {
    const input = source.file ?? source.dataUrl;
    if (!input) {
      return { text: "" };
    }

    const tesseractModule = await import("tesseract.js");
    const recognizeFn =
      tesseractModule.recognize ?? tesseractModule.default?.recognize;

    if (!recognizeFn) {
      throw new Error("tesseract.js recognize API unavailable.");
    }

    const result = await recognizeFn(input, "eng");
    const rawConfidence = result?.data?.confidence;
    const confidence =
      typeof rawConfidence === "number"
        ? Math.max(0, Math.min(1, rawConfidence / 100))
        : undefined;

    return {
      text: result?.data?.text || "",
      confidence,
      note: "Extracted via Tesseract WASM fallback.",
    };
  },
};

const ipcAudioAdapter: AudioEngineAdapter = {
  async transcribe(source) {
    if (!source.file) {
      return { text: "" };
    }

    const api = (
      window as unknown as {
        electronAPI?: {
          transcribeAudio?: (payload: {
            bytes: Uint8Array;
            mimeType?: string;
            fileName?: string;
          }) => Promise<{ text: string; confidence?: number; note?: string }>;
        };
      }
    ).electronAPI;

    if (!api?.transcribeAudio) {
      return { text: "" };
    }

    const bytes = await fileToBytes(source.file);
    const fileName =
      source.sourceName ||
      (source.file instanceof File ? source.file.name : undefined);

    return api.transcribeAudio({
      bytes,
      mimeType: source.file.type || "audio/wav",
      fileName,
    });
  },
};

let whisperPipelinePromise: Promise<
  (audio: Float32Array) => Promise<{ text?: string } | Array<{ text?: string }>>
> | null = null;

async function getLazyWhisperTranscriber() {
  if (!whisperPipelinePromise) {
    whisperPipelinePromise = (async () => {
      const transformers = await import("@huggingface/transformers");
      const asr = await transformers.pipeline(
        "automatic-speech-recognition",
        "onnx-community/whisper-base.en",
      );
      return async (audio: Float32Array) =>
        (await asr(audio)) as { text?: string } | Array<{ text?: string }>;
    })().catch((err) => {
      whisperPipelinePromise = null;
      throw err;
    });
  }
  return whisperPipelinePromise;
}

const lazyTransformersAudioAdapter: AudioEngineAdapter = {
  async transcribe(source) {
    if (!source.file) {
      return { text: "" };
    }

    const pcm16k = await audioFileTo16kMonoFloat32(source.file);
    const transcriber = await getLazyWhisperTranscriber();
    const raw = await transcriber(pcm16k);
    const text = Array.isArray(raw)
      ? raw.map((item) => item?.text ?? "").join(" ")
      : (raw?.text ?? "");

    return {
      text,
      note: "Transcribed via bundled @huggingface/transformers (whisper-base.en).",
    };
  },
};

export default function App() {
  const {
    messages,
    isLoading,
    sendMessage,
    model,
    setModel,
    availableModels,
    fetchModels,
    sessions,
    currentSessionId,
    createNewSession,
    selectSession,
    deleteSession,
    loadSessionsFromStorage,
    onUpdateUserMessage,
    onRegenerateFromCheckpoint,
    createWorkspaceArtifact,
  } = useChatStore();

  const [input, setInput] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"dynamic" | "generic">("dynamic");
  const [showWelcome, setShowWelcome] = useState<boolean | null>(null);
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);
  const [isWorkspaceInspectMode, setIsWorkspaceInspectMode] = useState(false);
  const [inspectedArtifactId, setInspectedArtifactId] = useState<string | null>(
    null,
  );
  const [isPreprocessing, setIsPreprocessing] = useState(false);
  const [preprocessingLabel, setPreprocessingLabel] = useState(
    "Processing input...",
  );
  const [pendingDoc, setPendingDoc] = useState<NormalizedDocument | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const isModalBlocking = isPreprocessing || Boolean(pendingDoc);

  // Register OCR and Audio adapter chains once
  useEffect(() => {
    setOcrEngineAdapter(
      createOcrAdapterChain(
        [systemIpcOcrAdapter, lazyTesseractOcrAdapter],
        "promptly-ocr-chain",
      ),
    );
    setAudioEngineAdapter(
      createAudioAdapterChain(
        [ipcAudioAdapter, lazyTransformersAudioAdapter],
        "promptly-audio-chain",
      ),
    );
    return () => {
      setOcrEngineAdapter(null);
      setAudioEngineAdapter(null);
    };
  }, []);

  const openNormalizedInCanvas = useCallback(
    (doc: NormalizedDocument) => {
      const trimmed = doc.content.trim();
      const fallbackWarningContent =
        !trimmed && doc.warnings.length > 0
          ? `> ⚠️ ${doc.warnings.join("\n>\n> ")}`
          : "";

      const finalContent = trimmed || fallbackWarningContent;
      if (!finalContent) return;

      createWorkspaceArtifact?.(
        doc.suggestedTitle,
        doc.language,
        finalContent,
        "user",
      );
      setIsWorkspaceInspectMode(true);
    },
    [createWorkspaceArtifact],
  );

  const handleChoosePendingCanvas = useCallback(() => {
    if (!pendingDoc) return;
    openNormalizedInCanvas(pendingDoc);
    setPendingDoc(null);
  }, [pendingDoc, openNormalizedInCanvas]);

  const handleChoosePendingPrompt = useCallback(() => {
    if (!pendingDoc) return;
    const extracted = pendingDoc.content.trim();
    if (extracted) {
      setInput((prev) => {
        const base = prev.trim();
        return base ? `${base}\n\n${extracted}` : extracted;
      });
    }
    setPendingDoc(null);
  }, [pendingDoc]);

  const handleDismissPendingModal = useCallback(() => {
    setPendingDoc(null);
  }, []);

  const handleHtmlInput = useCallback(
    async (
      trigger: PreprocessTrigger,
      payload: { rawText?: string; file?: File; sourceUrl?: string },
    ) => {
      setPreprocessingLabel(
        payload.file?.name
          ? `Converting ${payload.file.name} to Markdown...`
          : "Converting HTML to Markdown...",
      );
      setIsPreprocessing(true);
      try {
        const doc = await htmlToMarkdown({
          kind: "html",
          trigger,
          rawText: payload.rawText,
          file: payload.file,
          sourceName: payload.file?.name,
          sourceUrl: payload.sourceUrl,
        });
        openNormalizedInCanvas(doc);
      } finally {
        setIsPreprocessing(false);
      }
    },
    [openNormalizedInCanvas],
  );

  const handleImageInput = useCallback(
    async (
      trigger: PreprocessTrigger,
      payload: { file?: File; rawText?: string; sourceName?: string },
    ) => {
      const displayName =
        payload.sourceName ?? payload.file?.name ?? "screenshot/image";
      setPreprocessingLabel(`Running OCR on ${displayName}...`);
      setIsPreprocessing(true);
      try {
        const doc = await ocrImage({
          kind: "image",
          trigger,
          file: payload.file,
          rawText: payload.rawText,
          sourceName: displayName,
        });
        setPendingDoc(doc);
      } finally {
        setIsPreprocessing(false);
      }
    },
    [],
  );

  const handleAudioInput = useCallback(
    async (
      trigger: PreprocessTrigger,
      payload: { file: File; sourceName?: string },
    ) => {
      const displayName = payload.sourceName ?? payload.file.name ?? "audio";
      setPreprocessingLabel(`Transcribing ${displayName}...`);
      setIsPreprocessing(true);
      try {
        const doc = await transcribeAudio({
          kind: "audio",
          trigger,
          file: payload.file,
          sourceName: displayName,
        });
        setPendingDoc(doc);
      } finally {
        setIsPreprocessing(false);
      }
    },
    [],
  );

  const handleSidebarSelectSession = useCallback(
    (sessionId: string) => {
      selectSession(sessionId);
      setIsWorkspaceInspectMode(true);
    },
    [selectSession],
  );

  const handleSidebarSelectArtifact = useCallback((artifactId: string) => {
    setInspectedArtifactId(artifactId);
    setIsWorkspaceInspectMode(true);
  }, []);

  const handleSidebarDeleteSession = useCallback(
    (sessionId: string) => {
      const deletingActive = sessionId === currentSessionId;
      deleteSession(sessionId);
      if (deletingActive) {
        setIsWorkspaceInspectMode(false);
        setInspectedArtifactId(null);
      }
    },
    [currentSessionId, deleteSession],
  );

  const handleSidebarNewChat = useCallback(() => {
    setIsWorkspaceInspectMode(false);
    setInspectedArtifactId(null);
    createNewSession();
  }, [createNewSession]);

  const triggerImportFilePicker = useCallback(() => {
    if (isModalBlocking) return;
    fileInputRef.current?.click();
  }, [isModalBlocking]);

  const handleFilePickerChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      if (isImageFile(file)) {
        await handleImageInput("picker", { file });
        return;
      }

      if (isAudioFile(file)) {
        await handleAudioInput("picker", { file });
        return;
      }

      await handleHtmlInput("picker", { file });
    },
    [handleHtmlInput, handleImageInput, handleAudioInput],
  );

  useEffect(() => {
    if (showWelcome !== false) return;

    const hasRelevantDragPayload = (dt: DataTransfer | null): boolean => {
      if (!dt) return false;
      if (dt.types.includes("Files")) return true;
      if (dt.types.includes("text/html")) return true;
      return false;
    };

    const onDragEnter = (e: DragEvent) => {
      if (isModalBlocking) return;
      if (!hasRelevantDragPayload(e.dataTransfer)) return;
      e.preventDefault();
      dragCounterRef.current += 1;
      setIsDraggingMedia(true);
    };

    const onDragOver = (e: DragEvent) => {
      if (isModalBlocking) return;
      if (!hasRelevantDragPayload(e.dataTransfer)) return;
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
    };

    const onDragLeave = (e: DragEvent) => {
      if (isModalBlocking) return;
      if (!hasRelevantDragPayload(e.dataTransfer)) return;
      e.preventDefault();
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) {
        setIsDraggingMedia(false);
      }
    };

    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDraggingMedia(false);
      if (isModalBlocking) return;

      const dt = e.dataTransfer;
      if (!dt) return;

      const files = Array.from(dt.files || []);

      const imageFile = files.find(isImageFile);
      if (imageFile) {
        await handleImageInput("drop", { file: imageFile });
        return;
      }

      const audioFile = files.find(isAudioFile);
      if (audioFile) {
        await handleAudioInput("drop", { file: audioFile });
        return;
      }

      const htmlFile = files.find(isHtmlFile);
      if (htmlFile) {
        await handleHtmlInput("drop", { file: htmlFile });
        return;
      }

      const droppedHtml = dt.getData("text/html");
      const droppedUri = dt.getData("text/uri-list")?.trim() || undefined;
      if (droppedHtml && looksLikeHtmlMarkup(droppedHtml)) {
        await handleHtmlInput("drop", {
          rawText: droppedHtml,
          sourceUrl: droppedUri,
        });
      }
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [
    showWelcome,
    isModalBlocking,
    handleHtmlInput,
    handleImageInput,
    handleAudioInput,
  ]);

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (isModalBlocking) {
        e.preventDefault();
        return;
      }

      const clipboard = e.clipboardData;
      if (!clipboard) return;

      const pastedFiles = Array.from(clipboard.files || []);

      const imageFile = pastedFiles.find(isImageFile);
      if (imageFile) {
        e.preventDefault();
        await handleImageInput("paste", {
          file: imageFile,
          sourceName: imageFile.name || "pasted-screenshot.png",
        });
        return;
      }

      const audioFile = pastedFiles.find(isAudioFile);
      if (audioFile) {
        e.preventDefault();
        await handleAudioInput("paste", {
          file: audioFile,
          sourceName: audioFile.name,
        });
        return;
      }

      const htmlFile = pastedFiles.find(isHtmlFile);
      if (htmlFile) {
        e.preventDefault();
        await handleHtmlInput("paste", { file: htmlFile });
        return;
      }

      const htmlData = clipboard.getData("text/html");
      if (htmlData && looksLikeHtmlMarkup(htmlData)) {
        e.preventDefault();
        await handleHtmlInput("paste", { rawText: htmlData });
      }
    },
    [isModalBlocking, handleHtmlInput, handleImageInput, handleAudioInput],
  );

  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem(
      "promptly_onboarding_done",
    );
    if (!hasCompletedOnboarding) {
      setShowWelcome(true);
    } else {
      setShowWelcome(false);
    }
  }, []);

  useEffect(() => {
    if (showWelcome === false) {
      fetchModels();
      loadSessionsFromStorage();
    }
  }, [fetchModels, loadSessionsFromStorage, showWelcome]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const hasMessages = messages.length > 0;
  const showActiveWorkspacePane = hasMessages || isWorkspaceInspectMode;
  const lastMessage = hasMessages ? messages[messages.length - 1] : null;
  const showOptions =
    hasMessages && !isLoading && lastMessage?.role === "assistant";

  const isProcessingSuggestions = isLoading && messages.length > 0;

  const dynamicSuggestedPrompts = useMemo(() => {
    if (!showOptions || !lastMessage) return [];
    const data = getModelSuggestedPrompts(lastMessage);
    return data;
  }, [lastMessage, showOptions, currentSessionId]);

  useEffect(() => {
    if (dynamicSuggestedPrompts.length === 0) {
      setActiveTab("generic");
    } else {
      setActiveTab("dynamic");
    }
  }, [dynamicSuggestedPrompts.length]);

  const handleSubmit = (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    if (isModalBlocking) return;
    const textToSend = customText || input;
    if (!textToSend.trim()) return;
    sendMessage(textToSend);
    setInput("");
  };

  const renderFooterContents = () => (
    <>
      {isProcessingSuggestions ? (
        <div className="flex items-center gap-2 animate-pulse px-4 py-2 text-xs text-theme-muted">
          <div className="w-1.5 h-1.5 rounded-full bg-theme-accent" />
          Analyzing path...
        </div>
      ) : showOptions ? (
        <PromptOptions
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          dynamicSuggestedPrompts={dynamicSuggestedPrompts}
          onSubmit={(text) => handleSubmit(undefined, text)}
        />
      ) : null}

      <MessageForm
        input={input}
        setInput={setInput}
        isLoading={isLoading || isModalBlocking}
        onSubmit={(e) => handleSubmit(e)}
        onImportClick={triggerImportFilePicker}
      />
    </>
  );

  const handleOnboardingComplete = () => {
    setShowWelcome(false);
  };

  if (showWelcome === null) {
    return <div className="h-screen w-screen bg-theme-bg" />;
  }

  if (showWelcome === true) {
    return (
      <div className="h-screen w-screen bg-theme-bg flex items-center justify-center relative">
        <WelcomeModal onComplete={handleOnboardingComplete} />
      </div>
    );
  }

  const isAudioDoc = pendingDoc?.metadata?.kind === "audio";
  const hasDocText = Boolean(pendingDoc?.content.trim());
  const docConfidencePct =
    typeof pendingDoc?.metadata?.confidence === "number"
      ? `${Math.round(pendingDoc.metadata.confidence * 100)}%`
      : null;

  const docWarnings = pendingDoc?.warnings ?? [];
  const extractedEngineNote = docWarnings.find(
    (w) =>
      w.toLowerCase().startsWith("extracted via") ||
      w.toLowerCase().startsWith("transcribed via"),
  );
  const usedFallback = docWarnings.some((w) =>
    w.toLowerCase().includes("fallback"),
  );
  const successEngineLabel =
    extractedEngineNote?.replace(/\.$/, "") ||
    (isAudioDoc
      ? "Transcribed via local audio engine"
      : usedFallback
        ? "Extracted via Tesseract WASM fallback"
        : "Extracted via System Tesseract CLI");

  const realWarnings = docWarnings.filter(
    (w) =>
      !w.toLowerCase().startsWith("extracted via") &&
      !w.toLowerCase().startsWith("transcribed via") &&
      !w.toLowerCase().includes("system ocr unavailable/failed") &&
      !w.toLowerCase().includes("no local audio transcription cli found"),
  );

  return (
    <div
      onPaste={handlePaste}
      aria-busy={isModalBlocking}
      className="relative flex h-screen w-screen bg-theme-bg text-theme-text overflow-hidden transition-colors duration-200"
    >
      {isModalBlocking && (
        <div
          role="dialog"
          aria-modal="true"
          aria-live="assertive"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className={`fixed inset-0 z-100 flex items-center justify-center bg-black/65 backdrop-blur-sm select-none ${
            isPreprocessing ? "cursor-wait" : ""
          }`}
        >
          {isPreprocessing ? (
            <div className="max-w-sm w-full mx-4 rounded-2xl bg-theme-panel border-2 border-theme-accent/60 p-6 shadow-2xl flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-theme-accent/15 border border-theme-accent/30 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-theme-accent animate-spin" />
              </div>
              <p className="text-sm font-semibold text-theme-text">
                {preprocessingLabel}
              </p>
              <p className="text-xs text-theme-muted leading-relaxed">
                Please wait while content is processed and prepared for your
                next step.
              </p>
            </div>
          ) : (
            pendingDoc && (
              <div className="max-w-lg w-full mx-4 rounded-2xl bg-theme-panel border-2 border-theme-accent/60 p-6 shadow-2xl flex flex-col gap-4 text-left">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-theme-text">
                      {isAudioDoc
                        ? "Transcript Ready — Choose Destination"
                        : "OCR Ready — Choose Destination"}
                    </p>
                    <p className="text-xs text-theme-muted mt-0.5 font-mono">
                      {pendingDoc.suggestedTitle}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDismissPendingModal}
                    className="p-1.5 rounded-lg text-theme-muted hover:text-theme-text hover:bg-theme-bg/60 transition cursor-pointer"
                    aria-label="Discard result"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {hasDocText && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2 text-xs text-emerald-300">
                    <div className="flex items-center gap-2 font-medium">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-300">
                        ✓
                      </span>
                      <span>{successEngineLabel}</span>
                    </div>
                    {docConfidencePct && (
                      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-200">
                        {docConfidencePct} match
                      </span>
                    )}
                  </div>
                )}

                {realWarnings.length > 0 && (
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3.5 py-2 text-xs text-amber-200 space-y-1">
                    {realWarnings.map((warn, i) => (
                      <p key={i}>⚠️ {warn}</p>
                    ))}
                  </div>
                )}

                <div className="rounded-xl bg-theme-bg border border-theme-border p-3 max-h-48 overflow-y-auto font-mono text-xs whitespace-pre-wrap text-theme-text">
                  {hasDocText
                    ? pendingDoc.content.trim()
                    : isAudioDoc
                      ? "No speech or transcript text detected in audio."
                      : "No text extracted from image."}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleChoosePendingCanvas}
                    className="group flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-theme-bg text-theme-text border border-theme-border hover:bg-theme-accent hover:text-theme-bg hover:border-theme-accent transition cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-theme-muted group-hover:text-theme-bg transition" />
                    <span>Open in Canvas</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleChoosePendingPrompt}
                    disabled={!hasDocText}
                    className="group flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-theme-bg text-theme-text border border-theme-border hover:bg-theme-accent hover:text-theme-bg hover:border-theme-accent transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <MessageSquarePlus className="w-4 h-4 text-theme-muted group-hover:text-theme-bg transition" />
                    <span>Add to Prompt</span>
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".html,.htm,text/html,image/*,audio/*,.wav,.mp3,.m4a,.ogg,.webm,.flac"
        onChange={handleFilePickerChange}
        className="hidden"
      />

      {isDraggingMedia && !isModalBlocking && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-theme-bg/80 backdrop-blur-xs border-2 border-dashed border-theme-accent">
          <div className="rounded-xl bg-theme-panel px-6 py-4 text-center shadow-lg border border-theme-border">
            <p className="text-sm font-medium text-theme-text">
              Drop HTML, image, or audio to preprocess
            </p>
            <p className="text-xs text-theme-muted mt-1">
              Opens in Canvas for review or prepares for prompt
            </p>
          </div>
        </div>
      )}

      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSidebarSelectSession}
        onSelectArtifact={handleSidebarSelectArtifact}
        onDeleteSession={handleSidebarDeleteSession}
        onNewChat={handleSidebarNewChat}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
        />

        <div className="flex-1 flex flex-row overflow-hidden w-full relative">
          {!showActiveWorkspacePane ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 min-w-0 overflow-y-auto">
              <div className="max-w-3xl w-full flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in-95 duration-300">
                <EmptyStateCanvas />
                <div className="w-full bg-theme-bg">
                  {renderFooterContents()}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0 animate-in fade-in duration-200">
              <ChatWindow
                messages={messages}
                isLoading={isLoading}
                messagesEndRef={messagesEndRef}
                onUpdateUserMessage={onUpdateUserMessage}
                onRegenerateFromCheckpoint={onRegenerateFromCheckpoint}
                forceWorkspaceOpen={isWorkspaceInspectMode}
                inspectedArtifactId={inspectedArtifactId}
              />

              <footer className="p-3 max-w-3xl w-full mx-auto space-y-4 shrink-0 bg-theme-bg animate-in slide-in-from-bottom-4 duration-300">
                {renderFooterContents()}
              </footer>
            </div>
          )}

          <ContextSidebar />
        </div>
      </div>
    </div>
  );
}
